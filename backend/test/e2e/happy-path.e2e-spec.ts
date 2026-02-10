/**
 * E2E Happy Path Integration Tests
 *
 * These tests prove the full Aegis platform works end-to-end by hitting
 * the real NestJS app with a real database. They are NOT mocked unit tests.
 *
 * Test Suites:
 *   1. Platform Admin Auth Flow
 *   2. Tenant Provisioning Flow
 *   3. Tenant Dashboard Flow (Agent + Skills)
 *   4. Config History & Rollback Flow
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import speakeasy from 'speakeasy';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor';
import { PrismaService } from '../../src/prisma/prisma.service';

jest.setTimeout(90000);

const E2E_TENANT_NAME = 'E2E Test Corp';

let app: INestApplication;
let prisma: PrismaService;

// Shared tokens across suites
let adminAccessToken: string;
let tenantAccessToken: string;

// IDs created during tests (for cleanup)
let createdTenantId: string | null = null;
let createdAgentId: string | null = null;

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

  // Match main.ts configuration exactly
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.init();

  prisma = moduleFixture.get<PrismaService>(PrismaService);

  // Clean up any leftover test tenant from a previous run
  const existingTenant = await prisma.tenant.findUnique({
    where: { companyName: E2E_TENANT_NAME },
  });
  if (existingTenant) {
    // Disable immutability trigger to allow cleanup of audit-referenced data
    await prisma.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER ALL').catch(() => {});
    await prisma.auditLog.deleteMany({ where: { tenantId: existingTenant.id } }).catch(() => {});
    await prisma.skillInstallation.deleteMany({
      where: { agent: { tenantId: existingTenant.id } },
    }).catch(() => {});
    await prisma.agent.deleteMany({ where: { tenantId: existingTenant.id } }).catch(() => {});
    await (prisma as any).containerHealth
      ?.deleteMany({ where: { tenantId: existingTenant.id } })
      .catch(() => {});
    await (prisma as any).tenantConfigHistory
      .deleteMany({ where: { tenantId: existingTenant.id } })
      .catch(() => {});
    await prisma.alert
      .deleteMany({ where: { tenantId: existingTenant.id } })
      .catch(() => {});
    await prisma.tenant.delete({ where: { id: existingTenant.id } }).catch(() => {});
    await prisma.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER ALL').catch(() => {});
  }
}, 30000);

afterAll(async () => {
  // Clean up test data created during tests
  try {
    if (createdAgentId) {
      // Delete skill installations for this agent first
      await prisma.skillInstallation.deleteMany({
        where: { agentId: createdAgentId },
      });
      await prisma.agent.delete({ where: { id: createdAgentId } }).catch(() => {
        // Agent may already be deleted or not exist
      });
    }

    if (createdTenantId) {
      // Clean up config history for test tenant
      await (prisma as any).tenantConfigHistory
        .deleteMany({ where: { tenantId: createdTenantId } })
        .catch(() => {});
      // Clean up alerts for test tenant
      await prisma.alert
        .deleteMany({ where: { tenantId: createdTenantId } })
        .catch(() => {});
      await prisma.tenant.delete({ where: { id: createdTenantId } }).catch(() => {
        // Tenant may already be deleted
      });
    }
  } catch {
    // Swallow cleanup errors
  }

  await app.close();
}, 15000);

// =============================================================================
// Suite 1: Platform Admin Auth Flow
// =============================================================================
describe('Suite 1: Platform Admin Auth Flow', () => {
  it('should return mfaRequired when logging in as platform admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@aegis.ai', password: 'Admin12345!@' })
      .expect(200);

    expect(res.body).toHaveProperty('mfaRequired', true);
    expect(res.body).toHaveProperty('email', 'admin@aegis.ai');
  });

  it('should issue JWT tokens after MFA verification', async () => {
    const totpCode = speakeasy.totp({
      secret: 'JBSWY3DPEHPK3PXP',
      encoding: 'base32',
    });

    const res = await request(app.getHttpServer())
      .post('/api/auth/mfa/verify')
      .send({ email: 'admin@aegis.ai', totpCode })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('expiresIn', 900);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('role', 'platform_admin');
    expect(res.body.user).toHaveProperty('email', 'admin@aegis.ai');

    // Store the token for subsequent tests
    adminAccessToken = res.body.accessToken;
  });

  it('should return user profile via GET /api/auth/me', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('email', 'admin@aegis.ai');
    expect(res.body).toHaveProperty('role', 'platform_admin');
    expect(res.body).toHaveProperty('permissions');
    expect(res.body.permissions).toContain('admin:tenants:read');
  });

  it('should return tenant list via GET /api/admin/tenants', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/tenants')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.meta).toHaveProperty('total');
  });
});

// =============================================================================
// Suite 2: Tenant Provisioning Flow
// =============================================================================
describe('Suite 2: Tenant Provisioning Flow', () => {
  it('should create a new tenant with status "provisioning"', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        companyName: E2E_TENANT_NAME,
        adminEmail: 'e2e-admin@test.com',
        plan: 'growth',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('status', 'provisioning');
    expect(res.body).toHaveProperty('companyName', E2E_TENANT_NAME);
    expect(res.body).toHaveProperty('plan', 'growth');

    createdTenantId = res.body.id;
  });

  it('should complete provisioning and become active', async () => {
    expect(createdTenantId).not.toBeNull();

    // The provisioning pipeline takes ~12 seconds (sum of simulated delays).
    // Poll every 2 seconds, timeout after 45 seconds.
    const maxWait = 45000;
    const pollInterval = 2000;
    const startTime = Date.now();
    let status = 'provisioning';
    let tenantDetail: any = null;

    while (status !== 'active' && Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const res = await request(app.getHttpServer())
        .get(`/api/admin/tenants/${createdTenantId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      tenantDetail = res.body;
      status = tenantDetail.status;

      if (status === 'failed') {
        throw new Error(
          `Provisioning failed: ${tenantDetail.provisioning?.failedReason ?? 'unknown'}`,
        );
      }
    }

    expect(status).toBe('active');
    expect(tenantDetail).toHaveProperty('id', createdTenantId);

    // Once active, verify containerUrl is set via the config.containerEndpoint field
    // The mock orchestrator returns http://localhost:<port>
    expect(tenantDetail.config).toHaveProperty('containerEndpoint');
    expect(tenantDetail.config.containerEndpoint).toMatch(/^https?:\/\//);
  });
});

// =============================================================================
// Suite 3: Tenant Dashboard Flow (Agent + Skills)
// =============================================================================
describe('Suite 3: Tenant Dashboard Flow (Agent + Skills)', () => {
  it('should login as tenant admin and receive JWT directly (no MFA)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'tenant@acme.com', password: 'Tenant12345!@' })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('expiresIn', 900);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('role', 'tenant_admin');
    expect(res.body).not.toHaveProperty('mfaRequired');

    tenantAccessToken = res.body.accessToken;
  });

  it('should return agents list via GET /api/dashboard/agents', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/agents')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should create a new agent via POST /api/dashboard/agents', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/dashboard/agents')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .send({
        name: 'E2E Test Agent',
        role: 'engineering',
        modelTier: 'sonnet',
        thinkingMode: 'standard',
        temperature: 0.5,
        toolPolicy: {
          allow: ['github', 'eslint'],
        },
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name', 'E2E Test Agent');
    expect(res.body).toHaveProperty('role', 'engineering');
    expect(res.body).toHaveProperty('status', 'provisioning');
    expect(res.body).toHaveProperty('modelTier', 'sonnet');
    expect(res.body).toHaveProperty('thinkingMode', 'standard');
    expect(res.body).toHaveProperty('createdAt');

    createdAgentId = res.body.id;
  });

  it('should show the new agent in the agents list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/agents')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .expect(200);

    const newAgent = res.body.data.find(
      (a: { id: string }) => a.id === createdAgentId,
    );
    expect(newAgent).toBeDefined();
    expect(newAgent.name).toBe('E2E Test Agent');
  });

  it('should return skills with data and meta via GET /api/dashboard/skills', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/skills')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.meta).toHaveProperty('page');
    expect(res.body.meta).toHaveProperty('limit');
    expect(res.body.meta).toHaveProperty('total');
    expect(res.body.meta).toHaveProperty('totalPages');
  });

  it('should install a skill on the new agent', async () => {
    // First, get a skill ID from the marketplace
    const skillsRes = await request(app.getHttpServer())
      .get('/api/dashboard/skills')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .expect(200);

    const firstSkill = skillsRes.body.data[0];
    expect(firstSkill).toBeDefined();
    expect(firstSkill).toHaveProperty('id');

    const skillId = firstSkill.id;

    // Install the skill on the newly created agent
    const installRes = await request(app.getHttpServer())
      .post(`/api/dashboard/skills/${skillId}/install`)
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .send({ agentId: createdAgentId })
      .expect(201);

    expect(installRes.body).toHaveProperty('skillId', skillId);
    expect(installRes.body).toHaveProperty('agentId', createdAgentId);
    expect(installRes.body).toHaveProperty('status', 'installing');
  });

  it('should show installed skills via GET /api/dashboard/skills/installed', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/skills/installed')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);

    // Verify that the newly installed skill appears
    const installedOnNewAgent = res.body.data.find(
      (s: { agentId: string }) => s.agentId === createdAgentId,
    );
    expect(installedOnNewAgent).toBeDefined();
  });
});

// =============================================================================
// Suite 4: Config History & Rollback Flow
// =============================================================================
describe('Suite 4: Config History & Rollback Flow', () => {
  let acmeTenantId: string;
  let originalPlan: string;

  it('should find Acme Corp tenant via GET /api/admin/tenants', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/tenants?search=Acme')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    const acme = res.body.data.find(
      (t: { companyName: string }) => t.companyName === 'Acme Corp',
    );
    expect(acme).toBeDefined();
    acmeTenantId = acme.id;

    // Store original plan for later verification
    originalPlan = acme.plan;
  });

  it('should update tenant config via PATCH /api/admin/tenants/:id', async () => {
    // Change plan to enterprise (assuming current plan is growth from seed)
    const newPlan = originalPlan === 'enterprise' ? 'growth' : 'enterprise';

    const res = await request(app.getHttpServer())
      .patch(`/api/admin/tenants/${acmeTenantId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ plan: newPlan })
      .expect(200);

    expect(res.body).toHaveProperty('id', acmeTenantId);
    expect(res.body).toHaveProperty('plan', newPlan);
    expect(res.body).toHaveProperty('updatedAt');
  });

  it('should show config history with at least 1 entry', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/admin/tenants/${acmeTenantId}/config/history`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    // Each entry should have id, config, changedBy, createdAt
    const entry = res.body.data[0];
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('config');
    expect(entry).toHaveProperty('changedBy');
    expect(entry).toHaveProperty('createdAt');
  });

  it('should rollback config to a previous version', async () => {
    // Get config history to find the entry to rollback to
    const historyRes = await request(app.getHttpServer())
      .get(`/api/admin/tenants/${acmeTenantId}/config/history`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    // The first entry (most recent) should contain the original plan
    const historyEntry = historyRes.body.data[0];
    expect(historyEntry).toBeDefined();

    // Rollback to that entry
    const rollbackRes = await request(app.getHttpServer())
      .post(`/api/admin/tenants/${acmeTenantId}/config/rollback`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ historyId: historyEntry.id })
      .expect(200);

    expect(rollbackRes.body).toHaveProperty('id', acmeTenantId);
    expect(rollbackRes.body).toHaveProperty('message');
    expect(rollbackRes.body).toHaveProperty('updatedAt');
  });

  it('should verify the plan was rolled back', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/admin/tenants/${acmeTenantId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    // After rollback, the plan should be back to the original
    expect(res.body).toHaveProperty('plan', originalPlan);
  });

  afterAll(async () => {
    // Restore Acme Corp to its original plan if it was changed
    // to avoid polluting state for future test runs
    if (acmeTenantId && originalPlan) {
      try {
        await prisma.tenant.update({
          where: { id: acmeTenantId },
          data: { plan: originalPlan as any },
        });
        // Clean up config history entries created during this test
        await (prisma as any).tenantConfigHistory
          .deleteMany({ where: { tenantId: acmeTenantId } })
          .catch(() => {});
      } catch {
        // Swallow cleanup errors
      }
    }
  });
});
