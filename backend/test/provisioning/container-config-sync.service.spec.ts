import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ContainerConfigSyncService } from '../../src/provisioning/container-config-sync.service';
import { CONTAINER_CONFIG_QUEUE_NAME } from '../../src/provisioning/container-config.constants';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const AGENT_ID = 'agent-uuid-1';

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

// ---------------------------------------------------------------------------
// Test Suite: ContainerConfigSyncService
// ---------------------------------------------------------------------------
describe('ContainerConfigSyncService', () => {
  let service: ContainerConfigSyncService;
  let queue: typeof mockQueue;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContainerConfigSyncService,
        {
          provide: getQueueToken(CONTAINER_CONFIG_QUEUE_NAME),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<ContainerConfigSyncService>(
      ContainerConfigSyncService,
    );
    queue = module.get(getQueueToken(CONTAINER_CONFIG_QUEUE_NAME));
  });

  // =========================================================================
  // syncAgentConfig
  // =========================================================================
  describe('syncAgentConfig', () => {
    it('should enqueue a job with correct name and data', async () => {
      await service.syncAgentConfig(AGENT_ID);

      expect(queue.add).toHaveBeenCalledWith(
        'sync-agent-config',
        { agentId: AGENT_ID },
        expect.objectContaining({
          attempts: 1,
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 },
        }),
      );
    });

    it('should call queue.add with sync-agent-config job name', async () => {
      await service.syncAgentConfig('another-agent-id');

      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(queue.add.mock.calls[0][0]).toBe('sync-agent-config');
    });

    it('should pass agentId correctly in job data', async () => {
      const specificId = 'specific-agent-uuid-123';
      await service.syncAgentConfig(specificId);

      expect(queue.add.mock.calls[0][1]).toEqual({ agentId: specificId });
    });

    it('should catch errors and not throw', async () => {
      queue.add.mockRejectedValueOnce(new Error('Redis connection failed'));

      // Should not throw
      await expect(
        service.syncAgentConfig(AGENT_ID),
      ).resolves.toBeUndefined();
    });

    it('should log errors on queue failure', async () => {
      const loggerSpy = jest.spyOn(
        (service as any).logger,
        'error',
      );
      queue.add.mockRejectedValueOnce(new Error('Queue unavailable'));

      await service.syncAgentConfig(AGENT_ID);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to enqueue config sync'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(AGENT_ID),
      );
    });
  });
});
