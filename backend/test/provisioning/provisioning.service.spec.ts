import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { ProvisioningService } from '../../src/provisioning/provisioning.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PROVISIONING_QUEUE_NAME } from '../../src/provisioning/provisioning.constants';

// ----- Mocks -----

const mockPrismaService = {
  tenant: {
    update: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn(),
  },
};

const mockProvisioningQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

// ----- Test Suite -----

describe('ProvisioningService', () => {
  let service: ProvisioningService;
  let prisma: typeof mockPrismaService;
  let queue: typeof mockProvisioningQueue;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvisioningService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: getQueueToken(PROVISIONING_QUEUE_NAME),
          useValue: mockProvisioningQueue,
        },
      ],
    }).compile();

    service = module.get<ProvisioningService>(ProvisioningService);
    prisma = module.get(PrismaService);
    queue = module.get(getQueueToken(PROVISIONING_QUEUE_NAME));
  });

  // ============================================================
  // startProvisioning
  // ============================================================
  describe('startProvisioning', () => {
    it('should update tenant with initial provisioning state', async () => {
      await service.startProvisioning('tenant-uuid-1');

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-uuid-1' },
          data: expect.objectContaining({
            provisioningStep: 'creating_namespace',
            provisioningProgress: 0,
            provisioningAttempt: 1,
            provisioningMessage: expect.any(String),
            provisioningStartedAt: expect.any(Date),
            provisioningFailedReason: null,
          }),
        }),
      );
    });

    it('should enqueue a provisioning job to the BullMQ queue', async () => {
      await service.startProvisioning('tenant-uuid-1');

      expect(queue.add).toHaveBeenCalledWith(
        'provision-tenant',
        { tenantId: 'tenant-uuid-1' },
        expect.objectContaining({
          attempts: 1,
          removeOnComplete: expect.any(Object),
          removeOnFail: expect.any(Object),
        }),
      );
    });

    it('should call update before enqueuing the job', async () => {
      const callOrder: string[] = [];
      prisma.tenant.update.mockImplementation(async () => {
        callOrder.push('update');
        return {};
      });
      queue.add.mockImplementation(async () => {
        callOrder.push('enqueue');
        return { id: 'job-1' };
      });

      await service.startProvisioning('tenant-uuid-1');

      expect(callOrder).toEqual(['update', 'enqueue']);
    });

    it('should set provisioningAttempt to 1 on initial start', async () => {
      await service.startProvisioning('tenant-uuid-1');

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provisioningAttempt: 1,
          }),
        }),
      );
    });
  });

  // ============================================================
  // getProvisioningStatus
  // ============================================================
  describe('getProvisioningStatus', () => {
    it('should return provisioning status for a provisioning tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        status: 'provisioning',
        provisioningStep: 'spinning_container',
        provisioningProgress: 30,
        provisioningAttempt: 1,
        provisioningMessage: 'Spinning up container...',
        provisioningStartedAt: new Date('2026-02-07T10:00:00.000Z'),
        provisioningFailedReason: null,
      });

      const result = await service.getProvisioningStatus('tenant-uuid-1');

      expect(result).toEqual({
        step: 'spinning_container',
        progress: 30,
        message: 'Spinning up container...',
        attemptNumber: 1,
        startedAt: '2026-02-07T10:00:00.000Z',
      });
    });

    it('should include failedReason when present', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        status: 'failed',
        provisioningStep: 'failed',
        provisioningProgress: 40,
        provisioningAttempt: 3,
        provisioningMessage: 'Provisioning failed after 3 attempts.',
        provisioningStartedAt: new Date('2026-02-07T10:00:00.000Z'),
        provisioningFailedReason: 'Container creation timeout',
      });

      const result = await service.getProvisioningStatus('tenant-uuid-1');

      expect(result).not.toBeNull();
      expect(result!.failedReason).toBe('Container creation timeout');
    });

    it('should return null for active tenant (not provisioning)', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        status: 'active',
        provisioningStep: 'completed',
        provisioningProgress: 100,
        provisioningAttempt: 1,
        provisioningMessage: 'Done',
        provisioningStartedAt: new Date(),
        provisioningFailedReason: null,
      });

      const result = await service.getProvisioningStatus('tenant-uuid-1');

      expect(result).toBeNull();
    });

    it('should return null for suspended tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        status: 'suspended',
        provisioningStep: null,
        provisioningProgress: 0,
        provisioningAttempt: 0,
        provisioningMessage: null,
        provisioningStartedAt: null,
        provisioningFailedReason: null,
      });

      const result = await service.getProvisioningStatus('tenant-uuid-1');

      expect(result).toBeNull();
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.getProvisioningStatus('nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use correct select fields when querying tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        status: 'provisioning',
        provisioningStep: 'creating_namespace',
        provisioningProgress: 0,
        provisioningAttempt: 1,
        provisioningMessage: 'Starting...',
        provisioningStartedAt: new Date(),
        provisioningFailedReason: null,
      });

      await service.getProvisioningStatus('tenant-uuid-1');

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-uuid-1' },
          select: expect.objectContaining({
            status: true,
            provisioningStep: true,
            provisioningProgress: true,
            provisioningAttempt: true,
            provisioningMessage: true,
            provisioningStartedAt: true,
            provisioningFailedReason: true,
          }),
        }),
      );
    });

    it('should return step defaults when step is null', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        status: 'provisioning',
        provisioningStep: null,
        provisioningProgress: 0,
        provisioningAttempt: 1,
        provisioningMessage: null,
        provisioningStartedAt: null,
        provisioningFailedReason: null,
      });

      const result = await service.getProvisioningStatus('tenant-uuid-1');

      expect(result).not.toBeNull();
      expect(result!.step).toBe('creating_namespace');
      expect(result!.message).toBe('Provisioning in progress...');
      expect(result!.startedAt).toBeDefined();
    });
  });
});
