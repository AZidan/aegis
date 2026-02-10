import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { TenantsService } from '../../src/admin/tenants/tenants.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ProvisioningService } from '../../src/provisioning/provisioning.service';
import { AuditService } from '../../src/audit/audit.service';
import { CONTAINER_ORCHESTRATOR } from '../../src/container/container.constants';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

/**
 * Creates a mock tenant matching the Prisma Tenant model shape.
 * The implementation stores resourceLimits and modelDefaults as JSON fields,
 * and uses a containerHealth relation (not flat columns).
 */
const createMockTenant = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'tenant-uuid-1',
  companyName: 'Acme Corp',
  adminEmail: 'admin@acme.com',
  status: 'active',
  plan: 'growth',
  industry: 'Technology',
  expectedAgentCount: 10,
  containerId: 'oclaw-abc123',
  containerUrl: 'https://tenant-uuid-1.containers.aegis.ai',
  resourceLimits: { cpuCores: 4, memoryMb: 4096, diskGb: 25, maxAgents: 10 },
  modelDefaults: { tier: 'sonnet', thinkingMode: 'low' },
  createdAt: new Date('2026-01-15T10:00:00.000Z'),
  updatedAt: new Date('2026-02-05T12:00:00.000Z'),
  _count: { agents: 5 },
  containerHealth: [] as Array<Record<string, unknown>>,
  ...overrides,
});

const createMockAgent = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'agent-uuid-1',
  name: 'Project Manager Bot',
  role: 'pm',
  status: 'active',
  modelTier: 'sonnet',
  lastActive: new Date('2026-02-05T11:30:00.000Z'),
  createdAt: new Date('2026-01-20T09:00:00.000Z'),
  tenantId: 'tenant-uuid-1',
  ...overrides,
});

const createMockHealthRecord = (
  overrides: Partial<Record<string, unknown>> = {},
) => ({
  id: 'health-uuid-1',
  tenantId: 'tenant-uuid-1',
  cpuPercent: 45,
  memoryMb: 62,
  diskGb: 30,
  uptime: 864000,
  status: 'healthy',
  timestamp: new Date('2026-02-05T12:00:00.000Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Default resource limits per plan (must match implementation)
// ---------------------------------------------------------------------------
const PLAN_DEFAULTS = {
  starter: { cpuCores: 2, memoryMb: 2048, diskGb: 10, maxAgents: 3, maxSkills: 5 },
  growth: { cpuCores: 4, memoryMb: 4096, diskGb: 25, maxAgents: 10, maxSkills: 15 },
  enterprise: { cpuCores: 8, memoryMb: 8192, diskGb: 50, maxAgents: 50, maxSkills: 50 },
};

const MODEL_DEFAULTS = {
  starter: { tier: 'haiku', thinkingMode: 'off' },
  growth: { tier: 'sonnet', thinkingMode: 'low' },
  enterprise: { tier: 'opus', thinkingMode: 'high' },
};

// ---------------------------------------------------------------------------
// Test Suite: TenantsService
// ---------------------------------------------------------------------------
describe('TenantsService', () => {
  let service: TenantsService;
  let prisma: {
    tenant: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    agent: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
    tenantConfigHistory: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
    };
    containerHealth: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      tenant: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      agent: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      tenantConfigHistory: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      containerHealth: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ProvisioningService,
          useValue: {
            startProvisioning: jest.fn().mockResolvedValue(undefined),
            getProvisioningStatus: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: { logAction: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: CONTAINER_ORCHESTRATOR,
          useValue: {
            restart: jest.fn().mockResolvedValue(undefined),
            getStatus: jest
              .fn()
              .mockResolvedValue({ state: 'running', health: 'healthy', uptimeSeconds: 0 }),
          },
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // listTenants
  // =========================================================================
  describe('listTenants', () => {
    it('should return paginated results with meta', async () => {
      const tenants = [
        createMockTenant(),
        createMockTenant({
          id: 'tenant-uuid-2',
          companyName: 'Beta Inc',
          adminEmail: 'admin@beta.com',
          status: 'provisioning',
          plan: 'starter',
          _count: { agents: 0 },
        }),
      ];
      prisma.tenant.findMany.mockResolvedValue(tenants);
      prisma.tenant.count.mockResolvedValue(2);

      const result = await service.listTenants({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it('should return correct pagination meta for multiple pages', async () => {
      prisma.tenant.findMany.mockResolvedValue([createMockTenant()]);
      prisma.tenant.count.mockResolvedValue(45);

      const result = await service.listTenants({ page: 2, limit: 20 });

      expect(result.meta).toEqual({
        page: 2,
        limit: 20,
        total: 45,
        totalPages: 3,
      });
    });

    it('should return tenant data with correct shape', async () => {
      prisma.tenant.findMany.mockResolvedValue([createMockTenant()]);
      prisma.tenant.count.mockResolvedValue(1);

      const result = await service.listTenants({ page: 1, limit: 20 });

      const tenant = result.data[0];
      expect(tenant).toHaveProperty('id');
      expect(tenant).toHaveProperty('companyName');
      expect(tenant).toHaveProperty('adminEmail');
      expect(tenant).toHaveProperty('status');
      expect(tenant).toHaveProperty('plan');
      expect(tenant).toHaveProperty('agentCount');
      expect(tenant).toHaveProperty('createdAt');
    });

    it('should apply status filter', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      await service.listTenants({ page: 1, limit: 20, status: 'active' });

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
        }),
      );
    });

    it('should apply plan filter', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      await service.listTenants({ page: 1, limit: 20, plan: 'enterprise' });

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ plan: 'enterprise' }),
        }),
      );
    });

    it('should apply health filter via post-query filtering', async () => {
      const tenantWithHealth = createMockTenant({
        containerHealth: [createMockHealthRecord({ status: 'degraded' })],
      });
      const tenantHealthy = createMockTenant({
        id: 'tenant-uuid-2',
        containerHealth: [createMockHealthRecord({ status: 'healthy' })],
      });
      prisma.tenant.findMany.mockResolvedValue([tenantWithHealth, tenantHealthy]);
      prisma.tenant.count.mockResolvedValue(2);

      const result = await service.listTenants({
        page: 1,
        limit: 20,
        health: 'degraded',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('tenant-uuid-1');
    });

    it('should apply search filter on companyName and adminEmail', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      await service.listTenants({ page: 1, limit: 20, search: 'Acme' });

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                companyName: expect.objectContaining({ contains: 'Acme' }),
              }),
              expect.objectContaining({
                adminEmail: expect.objectContaining({ contains: 'Acme' }),
              }),
            ]),
          }),
        }),
      );
    });

    it('should apply sorting by company_name ascending', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      await service.listTenants({ page: 1, limit: 20, sort: 'company_name:asc' });

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.objectContaining({ companyName: 'asc' }),
        }),
      );
    });

    it('should apply sorting by created_at descending', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      await service.listTenants({ page: 1, limit: 20, sort: 'created_at:desc' });

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.objectContaining({ createdAt: 'desc' }),
        }),
      );
    });

    it('should apply correct pagination offset (skip and take)', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      await service.listTenants({ page: 3, limit: 10 });

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('should include health data when include=health', async () => {
      const tenantWithHealth = createMockTenant({
        containerHealth: [
          createMockHealthRecord({ status: 'healthy', cpuPercent: 45, memoryMb: 62, diskGb: 30 }),
        ],
      });
      prisma.tenant.findMany.mockResolvedValue([tenantWithHealth]);
      prisma.tenant.count.mockResolvedValue(1);

      const result = await service.listTenants({
        page: 1,
        limit: 20,
        include: 'health',
      });

      expect(result.data[0]).toHaveProperty('health');
      expect(result.data[0].health).toEqual(
        expect.objectContaining({
          status: expect.any(String),
          cpu: expect.any(Number),
          memory: expect.any(Number),
          disk: expect.any(Number),
        }),
      );
    });

    it('should return empty data array when no tenants match', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      const result = await service.listTenants({ page: 1, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should use count with same where clause for accurate total', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.tenant.count.mockResolvedValue(0);

      await service.listTenants({
        page: 1,
        limit: 20,
        status: 'active',
        plan: 'growth',
      });

      expect(prisma.tenant.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active', plan: 'growth' }),
        }),
      );
    });
  });

  // =========================================================================
  // createTenant
  // =========================================================================
  describe('createTenant', () => {
    it('should create tenant with provisioning status', async () => {
      const newTenant = createMockTenant({
        id: 'new-tenant-uuid',
        companyName: 'New Company',
        adminEmail: 'admin@newcompany.com',
        status: 'provisioning',
        plan: 'growth',
        _count: { agents: 0 },
      });
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue(newTenant);

      const result = await service.createTenant({
        companyName: 'New Company',
        adminEmail: 'admin@newcompany.com',
        plan: 'growth',
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('companyName', 'New Company');
      expect(result).toHaveProperty('adminEmail', 'admin@newcompany.com');
      expect(result).toHaveProperty('status', 'provisioning');
      expect(result).toHaveProperty('inviteLink');
      expect(result).toHaveProperty('createdAt');
    });

    it('should throw ConflictException for duplicate companyName', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());

      await expect(
        service.createTenant({
          companyName: 'Acme Corp',
          adminEmail: 'admin@acme2.com',
          plan: 'starter',
        }),
      ).rejects.toThrow(ConflictException);

      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());

      await expect(
        service.createTenant({
          companyName: 'Acme Corp',
          adminEmail: 'admin@acme2.com',
          plan: 'starter',
        }),
      ).rejects.toThrow('Company name already exists');
    });

    it('should generate invite link', async () => {
      const newTenant = createMockTenant({
        id: 'new-tenant-uuid',
        status: 'provisioning',
      });
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue(newTenant);

      const result = await service.createTenant({
        companyName: 'New Company',
        adminEmail: 'admin@newcompany.com',
        plan: 'starter',
      });

      expect(result.inviteLink).toBeDefined();
      expect(typeof result.inviteLink).toBe('string');
      expect(result.inviteLink.length).toBeGreaterThan(0);
    });

    it('should set default resource limits based on starter plan (as JSON)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue(
        createMockTenant({ status: 'provisioning' }),
      );

      await service.createTenant({
        companyName: 'Starter Company',
        adminEmail: 'admin@starter.com',
        plan: 'starter',
      });

      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resourceLimits: PLAN_DEFAULTS.starter,
          }),
        }),
      );
    });

    it('should set default resource limits based on growth plan (as JSON)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue(
        createMockTenant({ status: 'provisioning' }),
      );

      await service.createTenant({
        companyName: 'Growth Company',
        adminEmail: 'admin@growth.com',
        plan: 'growth',
      });

      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resourceLimits: PLAN_DEFAULTS.growth,
          }),
        }),
      );
    });

    it('should set default resource limits based on enterprise plan (as JSON)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue(
        createMockTenant({ status: 'provisioning' }),
      );

      await service.createTenant({
        companyName: 'Enterprise Company',
        adminEmail: 'admin@enterprise.com',
        plan: 'enterprise',
      });

      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resourceLimits: PLAN_DEFAULTS.enterprise,
          }),
        }),
      );
    });

    it('should use custom resource limits when provided', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue(
        createMockTenant({ status: 'provisioning' }),
      );
      const customLimits = {
        cpuCores: 16,
        memoryMb: 32768,
        diskGb: 200,
        maxAgents: 100,
      };

      await service.createTenant({
        companyName: 'Custom Company',
        adminEmail: 'admin@custom.com',
        plan: 'enterprise',
        resourceLimits: customLimits,
      });

      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resourceLimits: expect.objectContaining(customLimits),
          }),
        }),
      );
    });

    it('should use custom model defaults when provided', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue(
        createMockTenant({ status: 'provisioning' }),
      );

      await service.createTenant({
        companyName: 'Model Company',
        adminEmail: 'admin@model.com',
        plan: 'growth',
        modelDefaults: {
          tier: 'opus',
          thinkingMode: 'high',
        },
      });

      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            modelDefaults: { tier: 'opus', thinkingMode: 'high' },
          }),
        }),
      );
    });

    it('should store optional industry and expectedAgentCount', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue(
        createMockTenant({ status: 'provisioning' }),
      );

      await service.createTenant({
        companyName: 'Full Company',
        adminEmail: 'admin@full.com',
        plan: 'growth',
        industry: 'Healthcare',
        expectedAgentCount: 25,
      });

      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            industry: 'Healthcare',
            expectedAgentCount: 25,
          }),
        }),
      );
    });

    it('should check for existing company name before creating', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue(
        createMockTenant({ status: 'provisioning' }),
      );

      await service.createTenant({
        companyName: 'Unique Company',
        adminEmail: 'admin@unique.com',
        plan: 'starter',
      });

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyName: 'Unique Company' }),
        }),
      );
    });

    it('should set initial status to provisioning', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue(
        createMockTenant({ status: 'provisioning' }),
      );

      await service.createTenant({
        companyName: 'New Company',
        adminEmail: 'admin@new.com',
        plan: 'starter',
      });

      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'provisioning' }),
        }),
      );
    });
  });

  // =========================================================================
  // getTenantDetail
  // =========================================================================
  describe('getTenantDetail', () => {
    it('should return full tenant detail with containerHealth, resourceLimits, and config', async () => {
      const tenant = createMockTenant({
        containerHealth: [
          createMockHealthRecord(),
        ],
      });
      prisma.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.getTenantDetail('tenant-uuid-1');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('companyName');
      expect(result).toHaveProperty('adminEmail');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('plan');
      expect(result).toHaveProperty('agentCount');
      expect(result).toHaveProperty('containerHealth');
      expect(result.containerHealth).toEqual(
        expect.objectContaining({
          status: expect.any(String),
          cpu: expect.any(Number),
          memory: expect.any(Number),
          disk: expect.any(Number),
          uptime: expect.any(Number),
          lastHealthCheck: expect.any(String),
        }),
      );
      expect(result).toHaveProperty('resourceLimits');
      expect(result.resourceLimits).toEqual(
        expect.objectContaining({
          cpuCores: expect.any(Number),
          memoryMb: expect.any(Number),
          diskGb: expect.any(Number),
          maxAgents: expect.any(Number),
        }),
      );
      expect(result).toHaveProperty('config');
      expect(result.config).toHaveProperty('modelDefaults');
      expect(result.config).toHaveProperty('containerEndpoint');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.getTenantDetail('nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.getTenantDetail('nonexistent-uuid'),
      ).rejects.toThrow('Tenant not found');
    });

    it('should call findUnique with the correct tenant id and includes', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());

      await service.getTenantDetail('tenant-uuid-1');

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-uuid-1' },
          include: expect.objectContaining({
            _count: expect.any(Object),
            containerHealth: expect.any(Object),
          }),
        }),
      );
    });

    it('should include agent count in response', async () => {
      const tenant = createMockTenant({ _count: { agents: 7 } });
      prisma.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.getTenantDetail('tenant-uuid-1');

      expect(result.agentCount).toBe(7);
    });

    it('should return dates as ISO 8601 strings', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());

      const result = await service.getTenantDetail('tenant-uuid-1');

      expect(typeof result.createdAt).toBe('string');
      expect(typeof result.updatedAt).toBe('string');
      expect(new Date(result.createdAt as string).toISOString()).toBe(result.createdAt);
      expect(new Date(result.updatedAt as string).toISOString()).toBe(result.updatedAt);
    });
  });

  // =========================================================================
  // updateTenantConfig
  // =========================================================================
  describe('updateTenantConfig', () => {
    it('should update plan and return updated tenant', async () => {
      const updatedTenant = createMockTenant({
        plan: 'enterprise',
        updatedAt: new Date('2026-02-05T14:00:00.000Z'),
      });
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      prisma.tenant.update.mockResolvedValue(updatedTenant);

      const result = await service.updateTenantConfig('tenant-uuid-1', {
        plan: 'enterprise',
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('companyName');
      expect(result).toHaveProperty('plan', 'enterprise');
      expect(result).toHaveProperty('updatedAt');
    });

    it('should update resource limits as nested JSON', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      prisma.tenant.update.mockResolvedValue(
        createMockTenant({
          resourceLimits: { cpuCores: 16, memoryMb: 32768, diskGb: 200, maxAgents: 100 },
        }),
      );

      await service.updateTenantConfig('tenant-uuid-1', {
        resourceLimits: {
          cpuCores: 16,
          memoryMb: 32768,
          diskGb: 200,
          maxAgents: 100,
        },
      });

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-uuid-1' },
          data: expect.objectContaining({
            resourceLimits: expect.objectContaining({
              cpuCores: 16,
              memoryMb: 32768,
              diskGb: 200,
              maxAgents: 100,
            }),
          }),
        }),
      );
    });

    it('should update model defaults as nested JSON', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      prisma.tenant.update.mockResolvedValue(
        createMockTenant({
          modelDefaults: { tier: 'opus', thinkingMode: 'high' },
        }),
      );

      await service.updateTenantConfig('tenant-uuid-1', {
        modelDefaults: {
          tier: 'opus',
          thinkingMode: 'high',
        },
      });

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-uuid-1' },
          data: expect.objectContaining({
            modelDefaults: expect.objectContaining({
              tier: 'opus',
              thinkingMode: 'high',
            }),
          }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTenantConfig('nonexistent-uuid', { plan: 'enterprise' }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.updateTenantConfig('nonexistent-uuid', { plan: 'enterprise' }),
      ).rejects.toThrow('Tenant not found');
    });

    it('should return resourceLimits in response', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      prisma.tenant.update.mockResolvedValue(createMockTenant());

      const result = await service.updateTenantConfig('tenant-uuid-1', {
        plan: 'growth',
      });

      expect(result).toHaveProperty('resourceLimits');
    });

    it('should return modelDefaults in response', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      prisma.tenant.update.mockResolvedValue(createMockTenant());

      const result = await service.updateTenantConfig('tenant-uuid-1', {
        plan: 'growth',
      });

      expect(result).toHaveProperty('modelDefaults');
    });

    it('should handle partial resource limits update (merges with existing)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      prisma.tenant.update.mockResolvedValue(
        createMockTenant({ resourceLimits: { cpuCores: 8, memoryMb: 4096, diskGb: 25, maxAgents: 10 } }),
      );

      await service.updateTenantConfig('tenant-uuid-1', {
        resourceLimits: { cpuCores: 8 },
      });

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resourceLimits: expect.objectContaining({ cpuCores: 8 }),
          }),
        }),
      );
    });

    it('should verify tenant exists before updating', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      prisma.tenant.update.mockResolvedValue(createMockTenant());

      await service.updateTenantConfig('tenant-uuid-1', { plan: 'growth' });

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-uuid-1' },
        }),
      );
    });
  });

  // =========================================================================
  // deleteTenant
  // =========================================================================
  describe('deleteTenant', () => {
    it('should soft delete tenant and return response with gracePeriodEnds', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      prisma.tenant.update.mockResolvedValue(createMockTenant({ status: 'suspended' }));

      const result = await service.deleteTenant('tenant-uuid-1');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status', 'pending_deletion');
      expect(result).toHaveProperty('gracePeriodEnds');
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('Tenant scheduled for deletion');
    });

    it('should set grace period to 7 days from now', async () => {
      const beforeCall = new Date();
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      prisma.tenant.update.mockResolvedValue(createMockTenant({ status: 'suspended' }));

      const result = await service.deleteTenant('tenant-uuid-1');

      const gracePeriod = new Date(result.gracePeriodEnds);
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const diff = gracePeriod.getTime() - beforeCall.getTime();
      expect(diff).toBeGreaterThanOrEqual(sevenDaysMs - 5000);
      expect(diff).toBeLessThanOrEqual(sevenDaysMs + 5000);
    });

    it('should update tenant status to suspended in DB with deletion metadata', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      prisma.tenant.update.mockResolvedValue(createMockTenant({ status: 'suspended' }));

      await service.deleteTenant('tenant-uuid-1');

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-uuid-1' },
          data: expect.objectContaining({
            status: 'suspended',
            resourceLimits: expect.objectContaining({
              _deletionScheduled: true,
              _gracePeriodEnds: expect.any(String),
            }),
          }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteTenant('nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.deleteTenant('nonexistent-uuid'),
      ).rejects.toThrow('Tenant not found');
    });

    it('should verify tenant exists before deletion', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      prisma.tenant.update.mockResolvedValue(createMockTenant({ status: 'suspended' }));

      await service.deleteTenant('tenant-uuid-1');

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-uuid-1' },
        }),
      );
    });
  });

  // =========================================================================
  // restartContainer
  // =========================================================================
  describe('restartContainer', () => {
    it('should return restart confirmation with estimatedDowntime', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());

      const result = await service.restartContainer('tenant-uuid-1');

      expect(result).toHaveProperty('message', 'Container restart initiated');
      expect(result).toHaveProperty('tenantId', 'tenant-uuid-1');
      expect(result).toHaveProperty('estimatedDowntime');
      expect(typeof result.estimatedDowntime).toBe('number');
    });

    it('should return estimatedDowntime within expected range (30-60s)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());

      const result = await service.restartContainer('tenant-uuid-1');

      expect(result.estimatedDowntime).toBeGreaterThanOrEqual(30);
      expect(result.estimatedDowntime).toBeLessThanOrEqual(60);
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.restartContainer('nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.restartContainer('nonexistent-uuid'),
      ).rejects.toThrow('Tenant not found');
    });

    it('should verify tenant exists before initiating restart', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());

      await service.restartContainer('tenant-uuid-1');

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-uuid-1' },
        }),
      );
    });
  });

  // =========================================================================
  // getTenantHealth
  // =========================================================================
  describe('getTenantHealth', () => {
    it('should return current health and 24h history array', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      prisma.containerHealth.findFirst.mockResolvedValue(createMockHealthRecord());
      prisma.containerHealth.findMany.mockResolvedValue([
        createMockHealthRecord(),
        createMockHealthRecord({
          id: 'health-uuid-2',
          timestamp: new Date('2026-02-05T11:55:00.000Z'),
          cpuPercent: 42,
          memoryMb: 60,
        }),
      ]);

      const result = await service.getTenantHealth('tenant-uuid-1');

      expect(result).toHaveProperty('current');
      expect(result.current).toEqual(
        expect.objectContaining({
          status: expect.any(String),
          cpu: expect.any(Number),
          memory: expect.any(Number),
          disk: expect.any(Number),
          uptime: expect.any(Number),
          timestamp: expect.any(String),
        }),
      );
      expect(result).toHaveProperty('history24h');
      expect(Array.isArray(result.history24h)).toBe(true);
    });

    it('should return history data points with correct shape', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      prisma.containerHealth.findFirst.mockResolvedValue(createMockHealthRecord());
      prisma.containerHealth.findMany.mockResolvedValue([
        createMockHealthRecord(),
      ]);

      const result = await service.getTenantHealth('tenant-uuid-1');

      if (result.history24h.length > 0) {
        const point = result.history24h[0];
        expect(point).toHaveProperty('timestamp');
        expect(point).toHaveProperty('cpu');
        expect(point).toHaveProperty('memory');
        expect(point).toHaveProperty('disk');
        expect(point).toHaveProperty('status');
      }
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.getTenantHealth('nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.getTenantHealth('nonexistent-uuid'),
      ).rejects.toThrow('Tenant not found');
    });

    it('should verify tenant exists before fetching health', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      prisma.containerHealth.findFirst.mockResolvedValue(null);
      prisma.containerHealth.findMany.mockResolvedValue([]);

      await service.getTenantHealth('tenant-uuid-1');

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-uuid-1' },
        }),
      );
    });

    it('should return current health from real data when available', async () => {
      const healthRecord = createMockHealthRecord({
        status: 'degraded',
        cpuPercent: 88,
        memoryMb: 92,
        diskGb: 75,
      });
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      prisma.containerHealth.findFirst.mockResolvedValue(healthRecord);
      prisma.containerHealth.findMany.mockResolvedValue([]);

      const result = await service.getTenantHealth('tenant-uuid-1');

      expect(result.current.status).toBe('degraded');
      expect(result.current.cpu).toBe(88);
      expect(result.current.memory).toBe(92);
      expect(result.current.disk).toBe(75);
    });

    it('should return stub data when no health records exist', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      prisma.containerHealth.findFirst.mockResolvedValue(null);
      prisma.containerHealth.findMany.mockResolvedValue([]);

      const result = await service.getTenantHealth('tenant-uuid-1');

      expect(result.current.status).toBe('healthy');
      expect(result.history24h.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // getTenantAgents
  // =========================================================================
  describe('getTenantAgents', () => {
    it('should return agents array with correct data shape', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      (prisma as any).agent.findMany.mockResolvedValue([
        createMockAgent(),
        createMockAgent({
          id: 'agent-uuid-2',
          name: 'Engineering Bot',
          role: 'engineering',
          status: 'idle',
          modelTier: 'opus',
        }),
      ]);

      const result = await service.getTenantAgents('tenant-uuid-1');

      expect(result).toHaveProperty('data');
      expect(result.data).toHaveLength(2);

      const agent = result.data[0];
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('role');
      expect(agent).toHaveProperty('status');
      expect(agent).toHaveProperty('modelTier');
      expect(agent).toHaveProperty('lastActive');
      expect(agent).toHaveProperty('createdAt');
    });

    it('should return agents with valid role values per contract', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      (prisma as any).agent.findMany.mockResolvedValue([
        createMockAgent({ role: 'pm' }),
        createMockAgent({ id: 'agent-2', role: 'engineering' }),
        createMockAgent({ id: 'agent-3', role: 'operations' }),
        createMockAgent({ id: 'agent-4', role: 'custom' }),
      ]);

      const result = await service.getTenantAgents('tenant-uuid-1');

      const validRoles = ['pm', 'engineering', 'operations', 'custom'];
      result.data.forEach((agent: { role: string }) => {
        expect(validRoles).toContain(agent.role);
      });
    });

    it('should return agents with valid status values per contract', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      (prisma as any).agent.findMany.mockResolvedValue([
        createMockAgent({ status: 'active' }),
        createMockAgent({ id: 'agent-2', status: 'idle' }),
        createMockAgent({ id: 'agent-3', status: 'error' }),
      ]);

      const result = await service.getTenantAgents('tenant-uuid-1');

      const validStatuses = ['active', 'idle', 'error'];
      result.data.forEach((agent: { status: string }) => {
        expect(validStatuses).toContain(agent.status);
      });
    });

    it('should return agents with valid modelTier values per contract', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      (prisma as any).agent.findMany.mockResolvedValue([
        createMockAgent({ modelTier: 'haiku' }),
        createMockAgent({ id: 'agent-2', modelTier: 'sonnet' }),
        createMockAgent({ id: 'agent-3', modelTier: 'opus' }),
      ]);

      const result = await service.getTenantAgents('tenant-uuid-1');

      const validTiers = ['haiku', 'sonnet', 'opus'];
      result.data.forEach((agent: { modelTier: string }) => {
        expect(validTiers).toContain(agent.modelTier);
      });
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.getTenantAgents('nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.getTenantAgents('nonexistent-uuid'),
      ).rejects.toThrow('Tenant not found');
    });

    it('should query agents filtered by tenant id', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      (prisma as any).agent.findMany.mockResolvedValue([]);

      await service.getTenantAgents('tenant-uuid-1');

      expect((prisma as any).agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-uuid-1' }),
        }),
      );
    });

    it('should return empty data array when tenant has no agents', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      (prisma as any).agent.findMany.mockResolvedValue([]);

      const result = await service.getTenantAgents('tenant-uuid-1');

      expect(result.data).toEqual([]);
    });

    it('should return lastActive and createdAt as ISO 8601 strings', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      (prisma as any).agent.findMany.mockResolvedValue([createMockAgent()]);

      const result = await service.getTenantAgents('tenant-uuid-1');

      const agent = result.data[0];
      expect(typeof agent.lastActive).toBe('string');
      expect(typeof agent.createdAt).toBe('string');
    });

    it('should verify tenant exists before querying agents', async () => {
      prisma.tenant.findUnique.mockResolvedValue(createMockTenant());
      (prisma as any).agent.findMany.mockResolvedValue([]);

      await service.getTenantAgents('tenant-uuid-1');

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-uuid-1' },
        }),
      );
    });
  });
});
