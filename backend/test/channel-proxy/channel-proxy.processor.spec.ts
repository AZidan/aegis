import { Test, TestingModule } from '@nestjs/testing';
import { ChannelProxyProcessor } from '../../src/channel-proxy/channel-proxy.processor';
import { PlatformDispatcherService } from '../../src/channel-proxy/platform-dispatcher.service';
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

  beforeEach(async () => {
    platformDispatcher = { dispatch: jest.fn() };
    mockFetch.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelProxyProcessor,
        {
          provide: PlatformDispatcherService,
          useValue: platformDispatcher,
        },
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

  describe('forward-to-container', () => {
    it('should call fetch with correct URL and payload', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const job = createJob('forward-to-container', forwardJobData);
      await processor.process(job);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://container:8080/hooks/aegis',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"sessionId":"session-1"'),
        }),
      );
    });

    it('should throw on non-OK response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const job = createJob('forward-to-container', forwardJobData);

      await expect(processor.process(job)).rejects.toThrow(
        'Container forward failed: 500 Internal Server Error',
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
      mockFetch.mockResolvedValue({ ok: true });
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
