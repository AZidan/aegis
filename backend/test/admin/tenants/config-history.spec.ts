import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TenantsService } from '../../../src/admin/tenants/tenants.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { ProvisioningService } from '../../../src/provisioning/provisioning.service';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

const createMockTenant = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'tenant-uuid-1',
  companyName: 'Acme Corp',
  adminEmail: 'admin@acme.com',
  status: 'active',
  plan: 'growth',
  industry: 'Technology',
  expectedAgentCount: 10,
  containerUrl: 'https://tenant-uuid-1.containers.aegis.ai',
  resourceLimits: { cpuCores: 4, memoryMb: 4096, diskGb: 25, maxAgents: 10 },
  modelDefaults: { tier: 'sonnet', thinkingMode: 'low' },
  createdAt: new Date('2026-01-15T10:00:00.000Z'),
  updatedAt: new Date('2026-02-05T12:00:00.000Z'),
  _count: { agents: 5 },
  containerHealth: [] as Array<Record<string, unknown>>,
  ...overrides,
});

const createMockHistoryEntry = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'history-uuid-1',
  tenantId: 'tenant-uuid-1',
  config: {
    plan: 'growth',
    resourceLimits: { cpuCores: 4, memoryMb: 4096, diskGb: 25, maxAgents: 10 },
    modelDefaults: { tier: 'sonnet', thinkingMode: 'low' },
  },
  changedBy: 'admin-uuid',
  changeDescription: 'Plan: growth -> enterprise',
  createdAt: new Date('2026-02-05T10:00:00.000Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test Suite: Config History & Rollback
// ---------------------------------------------------------------------------
describe('TenantsService - Config History & Rollback', () => {
  let service: TenantsService;
  let mockPrisma: {
    tenant: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    tenantConfigHistory: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
    };
  };
  let mockProvisioningService: { startProvisioning: jest.Mock };

  beforeEach(async () => {
    mockPrisma = {
      tenant: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      tenantConfigHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
    };

    mockProvisioningService = { startProvisioning: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProvisioningService, useValue: mockProvisioningService },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // updateTenantConfig - History saving
  // =========================================================================
  describe('updateTenantConfig - history saving', () => {
    it('PATCH saves previous config to history before updating', async () => {
      const tenant = createMockTenant();
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.tenantConfigHistory.create.mockResolvedValue(createMockHistoryEntry());
      mockPrisma.tenant.update.mockResolvedValue(
        createMockTenant({ plan: 'enterprise', updatedAt: new Date('2026-02-05T14:00:00.000Z') }),
      );

      await service.updateTenantConfig('tenant-uuid-1', { plan: 'enterprise' }, 'admin-uuid');

      // Verify history was created BEFORE the update
      expect(mockPrisma.tenantConfigHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-uuid-1',
          config: expect.objectContaining({
            plan: 'growth',
            resourceLimits: tenant.resourceLimits,
            modelDefaults: tenant.modelDefaults,
          }),
          changedBy: 'admin-uuid',
          changeDescription: expect.any(String),
        }),
      });

      // Verify the tenant update was also called
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-uuid-1' },
          data: expect.objectContaining({ plan: 'enterprise' }),
        }),
      );
    });

    it('should use "system" as changedBy when userId is not provided', async () => {
      const tenant = createMockTenant();
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.tenantConfigHistory.create.mockResolvedValue(createMockHistoryEntry());
      mockPrisma.tenant.update.mockResolvedValue(
        createMockTenant({ plan: 'enterprise', updatedAt: new Date() }),
      );

      await service.updateTenantConfig('tenant-uuid-1', { plan: 'enterprise' });

      expect(mockPrisma.tenantConfigHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changedBy: 'system',
        }),
      });
    });
  });

  // =========================================================================
  // getConfigHistory
  // =========================================================================
  describe('getConfigHistory', () => {
    it('GET /config/history returns versions in descending chronological order', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(createMockTenant());

      const historyEntries = [
        createMockHistoryEntry({ id: 'h-3', createdAt: new Date('2026-02-05T12:00:00.000Z') }),
        createMockHistoryEntry({ id: 'h-2', createdAt: new Date('2026-02-05T11:00:00.000Z') }),
        createMockHistoryEntry({ id: 'h-1', createdAt: new Date('2026-02-05T10:00:00.000Z') }),
      ];
      mockPrisma.tenantConfigHistory.findMany.mockResolvedValue(historyEntries);
      mockPrisma.tenantConfigHistory.count.mockResolvedValue(3);

      const result = await service.getConfigHistory('tenant-uuid-1');

      expect(result.data).toHaveLength(3);
      expect(result.data[0].id).toBe('h-3');
      expect(result.data[2].id).toBe('h-1');

      // Verify findMany was called with desc ordering
      expect(mockPrisma.tenantConfigHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('GET /config/history returns paginated results', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      mockPrisma.tenantConfigHistory.findMany.mockResolvedValue([
        createMockHistoryEntry({ id: 'h-6' }),
      ]);
      mockPrisma.tenantConfigHistory.count.mockResolvedValue(25);

      const result = await service.getConfigHistory('tenant-uuid-1', 2, 5);

      expect(result.meta).toEqual({
        page: 2,
        limit: 5,
        total: 25,
        totalPages: 5,
      });

      // Verify pagination was applied
      expect(mockPrisma.tenantConfigHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        }),
      );
    });

    it('GET /config/history throws NotFoundException for non-existent tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.getConfigHistory('nonexistent-uuid')).rejects.toThrow(NotFoundException);
      await expect(service.getConfigHistory('nonexistent-uuid')).rejects.toThrow('Tenant not found');
    });

    it('GET /config/history returns correct data shape for each entry', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      mockPrisma.tenantConfigHistory.findMany.mockResolvedValue([createMockHistoryEntry()]);
      mockPrisma.tenantConfigHistory.count.mockResolvedValue(1);

      const result = await service.getConfigHistory('tenant-uuid-1');

      const entry = result.data[0];
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('config');
      expect(entry).toHaveProperty('changedBy');
      expect(entry).toHaveProperty('changeDescription');
      expect(entry).toHaveProperty('createdAt');
      expect(typeof entry.createdAt).toBe('string');
    });
  });

  // =========================================================================
  // rollbackConfig
  // =========================================================================
  describe('rollbackConfig', () => {
    it('POST /config/rollback restores specified version', async () => {
      const tenant = createMockTenant({ plan: 'enterprise' });
      const historyEntry = createMockHistoryEntry({
        config: {
          plan: 'growth',
          resourceLimits: { cpuCores: 4, memoryMb: 4096, diskGb: 25, maxAgents: 10 },
          modelDefaults: { tier: 'sonnet', thinkingMode: 'low' },
        },
      });
      const restoredTenant = createMockTenant({
        plan: 'growth',
        updatedAt: new Date('2026-02-05T15:00:00.000Z'),
      });

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.tenantConfigHistory.findFirst.mockResolvedValue(historyEntry);
      mockPrisma.tenantConfigHistory.create.mockResolvedValue({});
      mockPrisma.tenant.update.mockResolvedValue(restoredTenant);

      const result = await service.rollbackConfig('tenant-uuid-1', 'history-uuid-1', 'admin-uuid');

      expect(result.plan).toBe('growth');
      expect(result.message).toContain('rolled back successfully');

      // Verify the tenant was updated with historical config
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-uuid-1' },
          data: expect.objectContaining({
            plan: 'growth',
          }),
        }),
      );
    });

    it('POST /config/rollback creates a new history entry (audit trail)', async () => {
      const tenant = createMockTenant({ plan: 'enterprise' });
      const historyEntry = createMockHistoryEntry();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.tenantConfigHistory.findFirst.mockResolvedValue(historyEntry);
      mockPrisma.tenantConfigHistory.create.mockResolvedValue({});
      mockPrisma.tenant.update.mockResolvedValue(createMockTenant());

      await service.rollbackConfig('tenant-uuid-1', 'history-uuid-1', 'admin-uuid');

      // Verify a new history entry was created for the rollback (audit trail)
      expect(mockPrisma.tenantConfigHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-uuid-1',
          config: expect.objectContaining({
            plan: tenant.plan,
            resourceLimits: tenant.resourceLimits,
            modelDefaults: tenant.modelDefaults,
          }),
          changedBy: 'admin-uuid',
          changeDescription: expect.stringContaining('Rollback to version from'),
        }),
      });
    });

    it('POST /config/rollback throws NotFoundException for invalid historyId', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      mockPrisma.tenantConfigHistory.findFirst.mockResolvedValue(null);

      await expect(
        service.rollbackConfig('tenant-uuid-1', 'nonexistent-history', 'admin-uuid'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.rollbackConfig('tenant-uuid-1', 'nonexistent-history', 'admin-uuid'),
      ).rejects.toThrow('Config history entry not found');
    });

    it('POST /config/rollback throws NotFoundException for non-existent tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.rollbackConfig('nonexistent-uuid', 'history-uuid-1', 'admin-uuid'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.rollbackConfig('nonexistent-uuid', 'history-uuid-1', 'admin-uuid'),
      ).rejects.toThrow('Tenant not found');
    });

    it('POST /config/rollback uses "system" as changedBy when userId is not provided', async () => {
      const tenant = createMockTenant();
      const historyEntry = createMockHistoryEntry();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.tenantConfigHistory.findFirst.mockResolvedValue(historyEntry);
      mockPrisma.tenantConfigHistory.create.mockResolvedValue({});
      mockPrisma.tenant.update.mockResolvedValue(createMockTenant());

      await service.rollbackConfig('tenant-uuid-1', 'history-uuid-1');

      expect(mockPrisma.tenantConfigHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changedBy: 'system',
        }),
      });
    });
  });

  // =========================================================================
  // buildChangeDescription
  // =========================================================================
  describe('buildChangeDescription', () => {
    it('describes plan changes', () => {
      const tenant = createMockTenant({ plan: 'growth' });
      const dto = { plan: 'enterprise' as const };

      const description = service.buildChangeDescription(tenant, dto);

      expect(description).toContain('Plan: growth -> enterprise');
    });

    it('describes resource limit changes', () => {
      const tenant = createMockTenant();
      const dto = { resourceLimits: { cpuCores: 8 } };

      const description = service.buildChangeDescription(tenant, dto);

      expect(description).toContain('Resource limits updated');
    });

    it('describes model defaults changes', () => {
      const tenant = createMockTenant();
      const dto = { modelDefaults: { tier: 'opus' as const } };

      const description = service.buildChangeDescription(tenant, dto);

      expect(description).toContain('Model defaults updated');
    });

    it('describes multiple changes', () => {
      const tenant = createMockTenant({ plan: 'growth' });
      const dto = {
        plan: 'enterprise' as const,
        resourceLimits: { cpuCores: 8 },
        modelDefaults: { tier: 'opus' as const },
      };

      const description = service.buildChangeDescription(tenant, dto);

      expect(description).toContain('Plan: growth -> enterprise');
      expect(description).toContain('Resource limits updated');
      expect(description).toContain('Model defaults updated');
    });

    it('returns default description when no specific changes detected', () => {
      const tenant = createMockTenant({ plan: 'growth' });
      const dto = { plan: 'growth' as const }; // Same plan, no actual change

      const description = service.buildChangeDescription(tenant, dto);

      expect(description).toBe('Configuration updated');
    });
  });
});
