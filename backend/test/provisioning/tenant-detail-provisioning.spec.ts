import { Test, TestingModule } from '@nestjs/testing';
import { TenantsService } from '../../src/admin/tenants/tenants.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ProvisioningService } from '../../src/provisioning/provisioning.service';

/**
 * Tenant Detail - Provisioning Info Tests
 *
 * Tests that getTenantDetail includes provisioning data in the response
 * when the tenant status is "provisioning" or "failed", as specified in
 * API Contract v1.2.0 Section 3 (Get Tenant Detail).
 */

// ----- Test Data Factory -----

const createMockTenant = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'tenant-uuid-1',
  companyName: 'Acme Corp',
  adminEmail: 'admin@acme.com',
  status: 'active',
  plan: 'growth',
  billingCycle: 'monthly',
  industry: 'Technology',
  companySize: null,
  deploymentRegion: null,
  notes: null,
  expectedAgentCount: 10,
  containerUrl: 'https://tenant-uuid-1.containers.aegis.ai',
  containerId: 'oclaw-abc123',
  resourceLimits: {
    cpuCores: 4,
    memoryMb: 4096,
    diskGb: 25,
    maxAgents: 10,
    maxSkills: 15,
  },
  modelDefaults: { tier: 'sonnet', thinkingMode: 'low' },
  provisioningStep: null,
  provisioningProgress: 0,
  provisioningAttempt: 0,
  provisioningMessage: null,
  provisioningStartedAt: null,
  provisioningFailedReason: null,
  createdAt: new Date('2026-01-15T10:00:00.000Z'),
  updatedAt: new Date('2026-02-05T12:00:00.000Z'),
  _count: { agents: 5 },
  containerHealth: [],
  ...overrides,
});

// ----- Mocks -----

const mockPrismaService = {
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
  containerHealth: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockProvisioningService = {
  startProvisioning: jest.fn().mockResolvedValue(undefined),
  getProvisioningStatus: jest.fn(),
};

// ----- Test Suite -----

describe('TenantsService - getTenantDetail with provisioning', () => {
  let service: TenantsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProvisioningService, useValue: mockProvisioningService },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  // ============================================================
  // Provisioning info in response
  // ============================================================
  describe('provisioning field in response', () => {
    it('should include provisioning object when status is "provisioning"', async () => {
      const tenant = createMockTenant({
        status: 'provisioning',
        provisioningStep: 'spinning_container',
        provisioningProgress: 30,
        provisioningAttempt: 1,
        provisioningMessage: 'Spinning up container...',
        provisioningStartedAt: new Date('2026-02-07T10:00:00.000Z'),
      });

      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.getTenantDetail('tenant-uuid-1');

      expect(result.provisioning).toBeDefined();
      expect(result.provisioning).toEqual({
        step: 'spinning_container',
        progress: 30,
        message: 'Spinning up container...',
        attemptNumber: 1,
        startedAt: '2026-02-07T10:00:00.000Z',
      });
    });

    it('should include provisioning object when status is "failed"', async () => {
      const tenant = createMockTenant({
        status: 'failed',
        provisioningStep: 'failed',
        provisioningProgress: 40,
        provisioningAttempt: 3,
        provisioningMessage: 'Provisioning failed after 3 attempts.',
        provisioningStartedAt: new Date('2026-02-07T10:00:00.000Z'),
        provisioningFailedReason: 'Container creation timeout',
      });

      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.getTenantDetail('tenant-uuid-1');

      expect(result.provisioning).toBeDefined();
      expect(result.provisioning).toEqual({
        step: 'failed',
        progress: 40,
        message: 'Provisioning failed after 3 attempts.',
        attemptNumber: 3,
        startedAt: '2026-02-07T10:00:00.000Z',
        failedReason: 'Container creation timeout',
      });
    });

    it('should NOT include provisioning object when status is "active"', async () => {
      const tenant = createMockTenant({ status: 'active' });

      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.getTenantDetail('tenant-uuid-1');

      expect(result.provisioning).toBeUndefined();
    });

    it('should NOT include provisioning object when status is "suspended"', async () => {
      const tenant = createMockTenant({ status: 'suspended' });

      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.getTenantDetail('tenant-uuid-1');

      expect(result.provisioning).toBeUndefined();
    });

    it('should not include failedReason when it is null', async () => {
      const tenant = createMockTenant({
        status: 'provisioning',
        provisioningStep: 'configuring',
        provisioningProgress: 50,
        provisioningAttempt: 1,
        provisioningMessage: 'Configuring...',
        provisioningStartedAt: new Date('2026-02-07T10:00:00.000Z'),
        provisioningFailedReason: null,
      });

      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.getTenantDetail('tenant-uuid-1');

      expect(result.provisioning).toBeDefined();
      expect(
        (result.provisioning as Record<string, unknown>).failedReason,
      ).toBeUndefined();
    });
  });

  // ============================================================
  // New fields in response
  // ============================================================
  describe('new fields in response', () => {
    it('should include billingCycle in response', async () => {
      const tenant = createMockTenant({ billingCycle: 'annual' });
      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.getTenantDetail('tenant-uuid-1');

      expect(result.billingCycle).toBe('annual');
    });

    it('should include companySize when present', async () => {
      const tenant = createMockTenant({ companySize: '51-200' });
      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.getTenantDetail('tenant-uuid-1');

      expect(result.companySize).toBe('51-200');
    });

    it('should not include companySize when null', async () => {
      const tenant = createMockTenant({ companySize: null });
      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.getTenantDetail('tenant-uuid-1');

      expect(result.companySize).toBeUndefined();
    });

    it('should include deploymentRegion when present', async () => {
      const tenant = createMockTenant({ deploymentRegion: 'eu-west-1' });
      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.getTenantDetail('tenant-uuid-1');

      expect(result.deploymentRegion).toBe('eu-west-1');
    });

    it('should not include deploymentRegion when null', async () => {
      const tenant = createMockTenant({ deploymentRegion: null });
      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.getTenantDetail('tenant-uuid-1');

      expect(result.deploymentRegion).toBeUndefined();
    });

    it('should include maxSkills in resourceLimits', async () => {
      const tenant = createMockTenant({
        resourceLimits: {
          cpuCores: 4,
          memoryMb: 4096,
          diskGb: 25,
          maxAgents: 10,
          maxSkills: 15,
        },
      });
      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.getTenantDetail('tenant-uuid-1');

      expect(
        (result.resourceLimits as Record<string, number>).maxSkills,
      ).toBe(15);
    });

    it('should default maxSkills from plan when not in resourceLimits', async () => {
      const tenant = createMockTenant({
        plan: 'growth',
        resourceLimits: {
          cpuCores: 4,
          memoryMb: 4096,
          diskGb: 25,
          maxAgents: 10,
          // maxSkills not set
        },
      });
      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.getTenantDetail('tenant-uuid-1');

      // Should default to plan max skills (growth = 15)
      expect(
        (result.resourceLimits as Record<string, number>).maxSkills,
      ).toBe(15);
    });
  });

  // ============================================================
  // createTenant integration with provisioning
  // ============================================================
  describe('createTenant with provisioning', () => {
    it('should call provisioningService.startProvisioning after creating tenant', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);
      mockPrismaService.tenant.create.mockResolvedValue(
        createMockTenant({
          id: 'new-tenant-uuid',
          status: 'provisioning',
        }),
      );

      await service.createTenant({
        companyName: 'New Company',
        adminEmail: 'admin@new.com',
        plan: 'growth',
      });

      expect(mockProvisioningService.startProvisioning).toHaveBeenCalledWith(
        'new-tenant-uuid',
      );
    });

    it('should store companySize in tenant record', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);
      mockPrismaService.tenant.create.mockResolvedValue(
        createMockTenant({ status: 'provisioning' }),
      );

      await service.createTenant({
        companyName: 'Sized Company',
        adminEmail: 'admin@sized.com',
        plan: 'growth',
        companySize: '51-200',
      });

      expect(mockPrismaService.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companySize: '51-200',
          }),
        }),
      );
    });

    it('should store deploymentRegion in tenant record', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);
      mockPrismaService.tenant.create.mockResolvedValue(
        createMockTenant({ status: 'provisioning' }),
      );

      await service.createTenant({
        companyName: 'Regional Company',
        adminEmail: 'admin@regional.com',
        plan: 'enterprise',
        deploymentRegion: 'eu-central-1',
      });

      expect(mockPrismaService.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deploymentRegion: 'eu-central-1',
          }),
        }),
      );
    });

    it('should store notes in tenant record', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);
      mockPrismaService.tenant.create.mockResolvedValue(
        createMockTenant({ status: 'provisioning' }),
      );

      await service.createTenant({
        companyName: 'Noted Company',
        adminEmail: 'admin@noted.com',
        plan: 'starter',
        notes: 'VIP customer',
      });

      expect(mockPrismaService.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: 'VIP customer',
          }),
        }),
      );
    });

    it('should store billingCycle in tenant record', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);
      mockPrismaService.tenant.create.mockResolvedValue(
        createMockTenant({ status: 'provisioning' }),
      );

      await service.createTenant({
        companyName: 'Annual Company',
        adminEmail: 'admin@annual.com',
        plan: 'enterprise',
        billingCycle: 'annual',
      });

      expect(mockPrismaService.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            billingCycle: 'annual',
          }),
        }),
      );
    });

    it('should default billingCycle to monthly', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);
      mockPrismaService.tenant.create.mockResolvedValue(
        createMockTenant({ status: 'provisioning' }),
      );

      await service.createTenant({
        companyName: 'Default Billing Company',
        adminEmail: 'admin@default.com',
        plan: 'starter',
      });

      expect(mockPrismaService.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            billingCycle: 'monthly',
          }),
        }),
      );
    });

    it('should include maxSkills in resourceLimits when creating tenant', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);
      mockPrismaService.tenant.create.mockResolvedValue(
        createMockTenant({ status: 'provisioning' }),
      );

      await service.createTenant({
        companyName: 'Skills Company',
        adminEmail: 'admin@skills.com',
        plan: 'growth',
      });

      expect(mockPrismaService.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resourceLimits: expect.objectContaining({
              maxSkills: expect.any(Number),
            }),
          }),
        }),
      );
    });
  });
});
