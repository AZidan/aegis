import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { getQueueToken } from '@nestjs/bullmq';
import { TenantsController } from '../../src/admin/tenants/tenants.controller';
import { TenantsService } from '../../src/admin/tenants/tenants.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ProvisioningService } from '../../src/provisioning/provisioning.service';
import { AuditService } from '../../src/audit/audit.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import {
  PROVISIONING_QUEUE_NAME,
  PLAN_MAX_SKILLS,
} from '../../src/provisioning/provisioning.constants';

/**
 * Provisioning E2E Tests
 *
 * Tests the full provisioning flow through the HTTP API layer.
 * Uses NestJS testing utilities with mocked PrismaService and BullMQ Queue.
 *
 * Endpoints tested:
 * - POST /admin/tenants       (Create Tenant + provisioning enqueue)
 * - GET  /admin/tenants/:id   (Get Tenant Detail with provisioning state)
 */

// ---------------------------------------------------------------------------
// Mock Data Factories
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

const mockProvisioningQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

// ---------------------------------------------------------------------------
// Mock JWT Guard to inject a platform_admin user
// ---------------------------------------------------------------------------

const mockPlatformAdminUser = {
  id: 'admin-uuid',
  email: 'admin@aegis.ai',
  role: 'platform_admin',
};

const mockJwtGuard = {
  canActivate: jest.fn().mockImplementation((context) => {
    const req = context.switchToHttp().getRequest();
    req.user = mockPlatformAdminUser;
    return true;
  }),
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Provisioning E2E (HTTP API)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        TenantsService,
        ProvisioningService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: { logAction: jest.fn() } },
        {
          provide: getQueueToken(PROVISIONING_QUEUE_NAME),
          useValue: mockProvisioningQueue,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtGuard)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // ==========================================================================
  // POST /admin/tenants - Create Tenant
  // ==========================================================================
  describe('POST /admin/tenants', () => {
    it('should return 201 with status "provisioning" and enqueue provisioning job', async () => {
      // Arrange: no duplicate
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);
      mockPrismaService.tenant.create.mockResolvedValue(
        createMockTenant({
          id: 'new-tenant-uuid',
          companyName: 'New Company',
          adminEmail: 'admin@newcompany.com',
          status: 'provisioning',
          plan: 'growth',
          createdAt: new Date('2026-02-07T12:00:00.000Z'),
        }),
      );
      // startProvisioning calls tenant.update + queue.add
      mockPrismaService.tenant.update.mockResolvedValue({});

      // Act
      const response = await request(app.getHttpServer())
        .post('/admin/tenants')
        .send({
          companyName: 'New Company',
          adminEmail: 'admin@newcompany.com',
          plan: 'growth',
        })
        .expect(HttpStatus.CREATED);

      // Assert
      expect(response.body).toMatchObject({
        id: 'new-tenant-uuid',
        companyName: 'New Company',
        adminEmail: 'admin@newcompany.com',
        status: 'provisioning',
      });
      expect(response.body.inviteLink).toBeDefined();
      expect(response.body.createdAt).toBeDefined();

      // Verify provisioning was started
      expect(mockProvisioningQueue.add).toHaveBeenCalledWith(
        'provision-tenant',
        { tenantId: 'new-tenant-uuid' },
        expect.any(Object),
      );
    });

    it('should store new fields (companySize, deploymentRegion, notes, billingCycle) and return 201', async () => {
      // Arrange
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);
      mockPrismaService.tenant.create.mockResolvedValue(
        createMockTenant({
          id: 'new-uuid',
          companyName: 'Full Company',
          adminEmail: 'admin@full.com',
          status: 'provisioning',
          plan: 'enterprise',
          companySize: '201-500',
          deploymentRegion: 'eu-central-1',
          notes: 'VIP customer',
          billingCycle: 'annual',
          createdAt: new Date('2026-02-07T12:00:00.000Z'),
        }),
      );
      mockPrismaService.tenant.update.mockResolvedValue({});

      // Act
      const response = await request(app.getHttpServer())
        .post('/admin/tenants')
        .send({
          companyName: 'Full Company',
          adminEmail: 'admin@full.com',
          plan: 'enterprise',
          companySize: '201-500',
          deploymentRegion: 'eu-central-1',
          notes: 'VIP customer',
          billingCycle: 'annual',
        })
        .expect(HttpStatus.CREATED);

      // Assert response
      expect(response.body.status).toBe('provisioning');

      // Assert create was called with optional fields
      expect(mockPrismaService.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companySize: '201-500',
            deploymentRegion: 'eu-central-1',
            notes: 'VIP customer',
            billingCycle: 'annual',
          }),
        }),
      );
    });

    it('should apply plan defaults for missing resourceLimits fields (maxAgents, maxSkills, diskGb)', async () => {
      // Arrange
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);
      mockPrismaService.tenant.create.mockResolvedValue(
        createMockTenant({
          id: 'partial-uuid',
          status: 'provisioning',
          plan: 'growth',
          createdAt: new Date('2026-02-07T12:00:00.000Z'),
        }),
      );
      mockPrismaService.tenant.update.mockResolvedValue({});

      // Act: send partial resourceLimits (only maxAgents, maxSkills, diskGb)
      await request(app.getHttpServer())
        .post('/admin/tenants')
        .send({
          companyName: 'Partial Limits Co',
          adminEmail: 'admin@partial.com',
          plan: 'growth',
          resourceLimits: {
            maxAgents: 5,
            maxSkills: 10,
            diskGb: 30,
          },
        })
        .expect(HttpStatus.CREATED);

      // Assert: plan defaults should fill in missing fields
      const createCall = mockPrismaService.tenant.create.mock.calls[0][0];
      const resourceLimits = createCall.data.resourceLimits;
      expect(resourceLimits.maxAgents).toBe(5);
      expect(resourceLimits.maxSkills).toBe(10);
      expect(resourceLimits.diskGb).toBe(30);
    });

    it('should return 409 Conflict for duplicate companyName', async () => {
      // Arrange: company already exists
      mockPrismaService.tenant.findUnique.mockResolvedValue(
        createMockTenant({ companyName: 'Acme Corp' }),
      );

      // Act
      const response = await request(app.getHttpServer())
        .post('/admin/tenants')
        .send({
          companyName: 'Acme Corp',
          adminEmail: 'admin@acme2.com',
          plan: 'starter',
        })
        .expect(HttpStatus.CONFLICT);

      // Assert
      expect(response.body.message).toBe('Company name already exists');
      expect(mockPrismaService.tenant.create).not.toHaveBeenCalled();
    });

    it('should return 422 for invalid data (missing required fields)', async () => {
      // Act: missing companyName and plan
      const response = await request(app.getHttpServer())
        .post('/admin/tenants')
        .send({
          adminEmail: 'admin@test.com',
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);

      // Assert
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
      expect(mockPrismaService.tenant.create).not.toHaveBeenCalled();
    });

    it('should return 422 for invalid email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/tenants')
        .send({
          companyName: 'Test Company',
          adminEmail: 'not-an-email',
          plan: 'starter',
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);

      expect(response.body.message).toBe('Validation failed');
    });

    it('should return 422 for invalid plan value', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/tenants')
        .send({
          companyName: 'Test Company',
          adminEmail: 'admin@test.com',
          plan: 'ultra_premium',
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);

      expect(response.body.message).toBe('Validation failed');
    });
  });

  // ==========================================================================
  // GET /admin/tenants/:id - Get Tenant Detail
  // ==========================================================================
  describe('GET /admin/tenants/:id', () => {
    it('should return 200 with provisioning object during provisioning', async () => {
      // Arrange: tenant in provisioning state
      mockPrismaService.tenant.findUnique.mockResolvedValue(
        createMockTenant({
          status: 'provisioning',
          provisioningStep: 'spinning_container',
          provisioningProgress: 30,
          provisioningAttempt: 1,
          provisioningMessage: 'Spinning up container...',
          provisioningStartedAt: new Date('2026-02-07T10:00:00.000Z'),
        }),
      );

      // Act
      const response = await request(app.getHttpServer())
        .get('/admin/tenants/tenant-uuid-1')
        .expect(HttpStatus.OK);

      // Assert
      expect(response.body.status).toBe('provisioning');
      expect(response.body.provisioning).toBeDefined();
      expect(response.body.provisioning).toEqual({
        step: 'spinning_container',
        progress: 30,
        message: 'Spinning up container...',
        attemptNumber: 1,
        startedAt: '2026-02-07T10:00:00.000Z',
      });
    });

    it('should return 200 with status "active" and no provisioning object after completion', async () => {
      // Arrange: active tenant
      mockPrismaService.tenant.findUnique.mockResolvedValue(
        createMockTenant({
          status: 'active',
          provisioningStep: 'completed',
          provisioningProgress: 100,
        }),
      );

      // Act
      const response = await request(app.getHttpServer())
        .get('/admin/tenants/tenant-uuid-1')
        .expect(HttpStatus.OK);

      // Assert
      expect(response.body.status).toBe('active');
      expect(response.body.provisioning).toBeUndefined();
    });

    it('should return 200 with status "failed" and provisioning.failedReason after failure', async () => {
      // Arrange: failed tenant
      mockPrismaService.tenant.findUnique.mockResolvedValue(
        createMockTenant({
          status: 'failed',
          provisioningStep: 'failed',
          provisioningProgress: 40,
          provisioningAttempt: 3,
          provisioningMessage: 'Provisioning failed after 3 attempts.',
          provisioningStartedAt: new Date('2026-02-07T10:00:00.000Z'),
          provisioningFailedReason: 'Container creation timeout',
        }),
      );

      // Act
      const response = await request(app.getHttpServer())
        .get('/admin/tenants/tenant-uuid-1')
        .expect(HttpStatus.OK);

      // Assert
      expect(response.body.status).toBe('failed');
      expect(response.body.provisioning).toBeDefined();
      expect(response.body.provisioning.failedReason).toBe(
        'Container creation timeout',
      );
      expect(response.body.provisioning.attemptNumber).toBe(3);
    });

    it('should return 404 for non-existent tenant', async () => {
      // Arrange
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      // Act
      const response = await request(app.getHttpServer())
        .get('/admin/tenants/nonexistent-uuid')
        .expect(HttpStatus.NOT_FOUND);

      // Assert
      expect(response.body.message).toBe('Tenant not found');
    });

    it('should include resourceLimits with maxSkills in response', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(
        createMockTenant({
          resourceLimits: {
            cpuCores: 4,
            memoryMb: 4096,
            diskGb: 25,
            maxAgents: 10,
            maxSkills: 15,
          },
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/admin/tenants/tenant-uuid-1')
        .expect(HttpStatus.OK);

      expect(response.body.resourceLimits.maxSkills).toBe(15);
    });

    it('should include billingCycle in response', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(
        createMockTenant({ billingCycle: 'annual' }),
      );

      const response = await request(app.getHttpServer())
        .get('/admin/tenants/tenant-uuid-1')
        .expect(HttpStatus.OK);

      expect(response.body.billingCycle).toBe('annual');
    });

    it('should include optional fields (companySize, deploymentRegion) when present', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(
        createMockTenant({
          companySize: '51-200',
          deploymentRegion: 'eu-west-1',
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/admin/tenants/tenant-uuid-1')
        .expect(HttpStatus.OK);

      expect(response.body.companySize).toBe('51-200');
      expect(response.body.deploymentRegion).toBe('eu-west-1');
    });
  });
});
