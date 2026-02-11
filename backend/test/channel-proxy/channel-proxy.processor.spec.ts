import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ChannelProxyProcessor } from '../../src/channel-proxy/channel-proxy.processor';
import { PlatformDispatcherService } from '../../src/channel-proxy/platform-dispatcher.service';
import { SecretsManagerService } from '../../src/container/secrets-manager.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { CHANNEL_PROXY_QUEUE_NAME } from '../../src/channel-proxy/channel-proxy.constants';
import {
  ForwardToContainerJob,
  DispatchToPlatformJob,
} from '../../src/channel-proxy/interfaces/channel-proxy.interface';
import { Job } from 'bullmq';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('ChannelProxyProcessor', () => {
  let processor: ChannelProxyProcessor;
  let platformDispatcher: { dispatch: jest.Mock };
  let secretsManager: { getGatewayTokenForTenant: jest.Mock };
  let prisma: { channelConnection: { findFirst: jest.Mock } };
  let proxyQueue: { add: jest.Mock };

  beforeEach(async () => {
    platformDispatcher = { dispatch: jest.fn() };
    secretsManager = {
      getGatewayTokenForTenant: jest.fn().mockReturnValue('gw-token-123'),
    };
    prisma = {
      channelConnection: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'conn-1',
          credentials: { token: 'xoxb-fake' },
        }),
      },
    };
    proxyQueue = { add: jest.fn().mockResolvedValue({}) };
    mockFetch.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelProxyProcessor,
        { provide: PlatformDispatcherService, useValue: platformDispatcher },
        { provide: SecretsManagerService, useValue: secretsManager },
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(CHANNEL_PROXY_QUEUE_NAME), useValue: proxyQueue },
      ],
    }).compile();

    processor = module.get(ChannelProxyProcessor);
  });

  const createJob = <T>(name: string, data: T) =>
    ({ name, data }) as unknown as Job<T>;

  const forwardJobData: ForwardToContainerJob = {
    sessionContext: {
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      platform: 'SLACK',
      workspaceId: 'ws-1',
      channelId: 'ch-1',
      userId: 'user-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastActivityAt: '2026-01-01T00:00:00.000Z',
    },
    event: {
      platform: 'SLACK',
      workspaceId: 'ws-1',
      channelId: 'ch-1',
      userId: 'user-1',
      text: 'Hello',
      threadId: 'thread-1',
      timestamp: '2026-01-01T00:00:00.000Z',
    },
    containerUrl: 'http://container:8080',
  };

  const dispatchJobData: DispatchToPlatformJob = {
    message: {
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      platform: 'SLACK',
      workspaceId: 'ws-1',
      channelId: 'ch-1',
      text: 'Agent reply',
    },
    connectionId: 'conn-1',
    credentials: { token: 'xoxb-fake' },
  };

  const mockResponsesApiResult = {
    output: [
      {
        content: [
          { type: 'output_text', text: 'The capital of France is Paris.' },
        ],
      },
    ],
    usage: { input_tokens: 10, output_tokens: 8 },
  };

  describe('forward-to-container', () => {
    it('should call /v1/responses with Bearer auth and correct payload', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponsesApiResult),
      });

      const job = createJob('forward-to-container', forwardJobData);
      await processor.process(job);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://container:8080/v1/responses',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer gw-token-123',
          },
          body: expect.stringContaining('"input":"Hello"'),
        }),
      );
    });

    it('should derive gateway token from tenant ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponsesApiResult),
      });

      const job = createJob('forward-to-container', forwardJobData);
      await processor.process(job);

      expect(secretsManager.getGatewayTokenForTenant).toHaveBeenCalledWith(
        'tenant-1',
      );
    });

    it('should enqueue dispatch-to-platform with agent response text', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponsesApiResult),
      });

      const job = createJob('forward-to-container', forwardJobData);
      await processor.process(job);

      expect(proxyQueue.add).toHaveBeenCalledWith(
        'dispatch-to-platform',
        expect.objectContaining({
          message: expect.objectContaining({
            tenantId: 'tenant-1',
            agentId: 'agent-1',
            platform: 'SLACK',
            text: 'The capital of France is Paris.',
            threadId: 'thread-1',
          }),
          connectionId: 'conn-1',
        }),
      );
    });

    it('should not enqueue dispatch when no active connection found', async () => {
      prisma.channelConnection.findFirst.mockResolvedValueOnce(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponsesApiResult),
      });

      const job = createJob('forward-to-container', forwardJobData);
      await processor.process(job);

      expect(proxyQueue.add).not.toHaveBeenCalled();
    });

    it('should not enqueue dispatch when agent response is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ output: [] }),
      });

      const job = createJob('forward-to-container', forwardJobData);
      await processor.process(job);

      expect(proxyQueue.add).not.toHaveBeenCalled();
    });

    it('should throw on non-OK response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('error body'),
      });

      const job = createJob('forward-to-container', forwardJobData);

      await expect(processor.process(job)).rejects.toThrow(
        'Container forward failed: 500 Internal Server Error',
      );
    });

    it('should concatenate multiple output_text blocks', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            output: [
              {
                content: [
                  { type: 'output_text', text: 'Line 1' },
                  { type: 'output_text', text: 'Line 2' },
                ],
              },
            ],
          }),
      });

      const job = createJob('forward-to-container', forwardJobData);
      await processor.process(job);

      expect(proxyQueue.add).toHaveBeenCalledWith(
        'dispatch-to-platform',
        expect.objectContaining({
          message: expect.objectContaining({
            text: 'Line 1\nLine 2',
          }),
        }),
      );
    });
  });

  describe('dispatch-to-platform', () => {
    it('should call platformDispatcher.dispatch', async () => {
      platformDispatcher.dispatch.mockResolvedValue({
        success: true,
        messageId: 'msg-1',
      });

      const job = createJob('dispatch-to-platform', dispatchJobData);
      await processor.process(job);

      expect(platformDispatcher.dispatch).toHaveBeenCalledWith(
        dispatchJobData.message,
        dispatchJobData.credentials,
      );
    });

    it('should throw when dispatch fails', async () => {
      platformDispatcher.dispatch.mockResolvedValue({ success: false });

      const job = createJob('dispatch-to-platform', dispatchJobData);

      await expect(processor.process(job)).rejects.toThrow(
        'Platform dispatch failed for SLACK',
      );
    });
  });

  describe('error handling', () => {
    it('should re-throw errors for BullMQ retry', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const job = createJob('forward-to-container', forwardJobData);

      await expect(processor.process(job)).rejects.toThrow('Network error');
    });

    it('should dispatch to correct handler by job name', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponsesApiResult),
      });
      platformDispatcher.dispatch.mockResolvedValue({
        success: true,
        messageId: 'msg-1',
      });

      // forward job
      const fwdJob = createJob('forward-to-container', forwardJobData);
      await processor.process(fwdJob);
      expect(mockFetch).toHaveBeenCalled();
      expect(platformDispatcher.dispatch).not.toHaveBeenCalled();

      mockFetch.mockReset();

      // dispatch job
      const dispJob = createJob('dispatch-to-platform', dispatchJobData);
      await processor.process(dispJob);
      expect(platformDispatcher.dispatch).toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
