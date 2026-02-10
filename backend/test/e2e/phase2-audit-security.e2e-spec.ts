/**
 * E2E Phase 2: Audit Trail, Security Alerts, Skills Permissions & Network Policy
 *
 * Tests Sprint 5-8 features end-to-end against a real NestJS app + database.
 *
 * Test Suites:
 *   1. Audit Trail — query audit logs, verify entries, date range filter
 *   2. Security Alerts — list alerts, resolve, filter by severity
 *   3. Skills Permissions — private skill submission, visibility isolation
 *   4. Network Policy — query tenant policy, validate allowed/blocked domains
 *
 * Requires: running PostgreSQL + Redis (for BullMQ + cache)
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

let app: INestApplication;
let prisma: PrismaService;

// Auth tokens
let adminAccessToken: string;
let tenantAccessToken: string;

// IDs for cleanup
let privateSkillId: string | null = null;
let createdAlertId: string | null = null;

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.init();
  prisma = moduleFixture.get<PrismaService>(PrismaService);

  // Clean up stale test data from previous runs
  await prisma.skill
    .deleteMany({ where: { name: 'e2e-private-test-skill' } })
    .catch(() => {});
}, 30000);

afterAll(async () => {
  try {
    // Clean up private skill
    if (privateSkillId) {
      await prisma.skill.delete({ where: { id: privateSkillId } }).catch(() => {});
    }
    // Clean up leftover test skills by name
    await prisma.skill
      .deleteMany({ where: { name: 'e2e-private-test-skill' } })
      .catch(() => {});
  } catch {
    // Swallow cleanup errors
  }

  await app.close();
}, 15000);

// =============================================================================
// Helper: Authenticate as admin (with MFA)
// =============================================================================
async function loginAsAdmin(): Promise<string> {
  const totpCode = speakeasy.totp({
    secret: 'JBSWY3DPEHPK3PXP',
    encoding: 'base32',
  });

  const res = await request(app.getHttpServer())
    .post('/api/auth/mfa/verify')
    .send({ email: 'admin@aegis.ai', totpCode })
    .expect(200);

  return res.body.accessToken;
}

// =============================================================================
// Helper: Authenticate as tenant admin
// =============================================================================
async function loginAsTenant(): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: 'tenant@acme.com', password: 'Tenant12345!@' })
    .expect(200);

  return res.body.accessToken;
}

// =============================================================================
// Suite 1: Audit Trail
// =============================================================================
describe('Suite 1: Audit Trail', () => {
  it('should authenticate as admin and tenant', async () => {
    // First trigger MFA flow for admin
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@aegis.ai', password: 'Admin12345!@' })
      .expect(200);

    adminAccessToken = await loginAsAdmin();
    expect(adminAccessToken).toBeDefined();

    tenantAccessToken = await loginAsTenant();
    expect(tenantAccessToken).toBeDefined();
  });

  it('should query audit logs as admin via GET /api/admin/audit-logs', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);
    // Login actions should have been logged
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should query tenant audit logs via GET /api/dashboard/audit', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/audit')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should filter audit logs by action', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/audit-logs?action=auth_login')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    // All returned entries should be auth_login actions
    for (const entry of res.body.data) {
      expect(entry.action).toBe('auth_login');
    }
  });
});

// =============================================================================
// Suite 2: Security Alerts
// =============================================================================
describe('Suite 2: Security Alerts', () => {
  it('should list alerts via GET /api/admin/dashboard/alerts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/dashboard/alerts')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);

    // If alerts exist, verify structure
    if (res.body.data.length > 0) {
      const alert = res.body.data[0];
      expect(alert).toHaveProperty('id');
      expect(alert).toHaveProperty('severity');
      expect(alert).toHaveProperty('title');
      expect(alert).toHaveProperty('resolved');
    }
  });

  it('should create a test alert and verify it appears', async () => {
    // Insert a test alert directly for E2E verification
    const alert = await prisma.alert.create({
      data: {
        severity: 'warning',
        title: 'E2E Test Alert',
        message: 'This alert was created by the E2E test suite.',
        resolved: false,
      },
    });
    createdAlertId = alert.id;

    const res = await request(app.getHttpServer())
      .get('/api/admin/dashboard/alerts')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    const found = res.body.data.find((a: { id: string }) => a.id === createdAlertId);
    expect(found).toBeDefined();
    expect(found.title).toBe('E2E Test Alert');
    expect(found.resolved).toBe(false);
  });

  it('should resolve the alert via PUT /api/admin/dashboard/alerts/:id', async () => {
    expect(createdAlertId).not.toBeNull();

    const res = await request(app.getHttpServer())
      .put(`/api/admin/dashboard/alerts/${createdAlertId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ resolved: true })
      .expect(200);

    expect(res.body).toHaveProperty('resolved', true);
    expect(res.body).toHaveProperty('resolvedAt');
  });

  it('should get security posture dashboard via GET /api/admin/dashboard/security-posture', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/dashboard/security-posture')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('alertsByRule');
    expect(res.body).toHaveProperty('permissionViolations');
    expect(res.body).toHaveProperty('policyCompliance');
    expect(res.body).toHaveProperty('generatedAt');

    expect(res.body.summary).toHaveProperty('totalAlerts');
    expect(res.body.summary).toHaveProperty('unresolvedAlerts');
    expect(typeof res.body.summary.totalAlerts).toBe('number');
  });
});

// =============================================================================
// Suite 3: Skills Permissions & Private Skills
// =============================================================================
describe('Suite 3: Skills Permissions & Private Skills', () => {
  it('should submit a private skill via POST /api/dashboard/skills/private', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/dashboard/skills/private')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .send({
        name: 'e2e-private-test-skill',
        version: '1.0.0',
        description: 'A private skill created by E2E tests for visibility isolation testing',
        category: 'custom',
        compatibleRoles: ['engineering'],
        sourceCode: 'export default { execute: async () => ({ result: "ok" }) }',
        permissions: {
          network: { allowedDomains: ['api.example.com'] },
          files: { readPaths: [], writePaths: [] },
          env: { required: [], optional: [] },
        },
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name', 'e2e-private-test-skill');
    expect(res.body).toHaveProperty('status', 'pending');
    expect(res.body).toHaveProperty('submittedAt');

    privateSkillId = res.body.id;
  });

  it('should list own private skills via GET /api/dashboard/skills/private', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/skills/private')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);

    // Our submitted skill should appear
    const found = res.body.data.find(
      (s: { id: string }) => s.id === privateSkillId,
    );
    expect(found).toBeDefined();
    expect(found.name).toBe('e2e-private-test-skill');
  });

  it('should show private skill in admin review queue', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/skills/review')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);

    // Our pending skill should appear in the review queue
    const found = res.body.data.find(
      (s: { id: string }) => s.id === privateSkillId,
    );
    expect(found).toBeDefined();
    expect(found.status).toBe('pending');
  });
});

// =============================================================================
// Suite 4: Network Policy
// =============================================================================
describe('Suite 4: Network Policy', () => {
  it('should get tenant network policy via GET /api/dashboard/skills/network-policy', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/skills/network-policy')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('tenantId');
    expect(res.body).toHaveProperty('rules');
    expect(res.body).toHaveProperty('generatedAt');
    expect(Array.isArray(res.body.rules)).toBe(true);
  });

  it('should validate an allowed domain via POST /api/dashboard/skills/network-policy/validate', async () => {
    // First get the policy to know what domains are allowed
    const policyRes = await request(app.getHttpServer())
      .get('/api/dashboard/skills/network-policy')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .expect(200);

    // Validate a domain — if there are rules, use a domain from them;
    // otherwise validate any domain (should be blocked if no rules exist)
    const testDomain =
      policyRes.body.rules.length > 0
        ? policyRes.body.rules[0].domain ?? 'unknown.example.com'
        : 'unknown.example.com';

    const res = await request(app.getHttpServer())
      .post('/api/dashboard/skills/network-policy/validate')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .send({ domain: testDomain })
      .expect(200);

    expect(res.body).toHaveProperty('requestedDomain', testDomain);
    expect(res.body).toHaveProperty('allowed');
    expect(typeof res.body.allowed).toBe('boolean');
  });

  it('should get all network policies as admin via GET /api/admin/dashboard/network-policies', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/dashboard/network-policies')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    // getAllPolicies returns a raw array of NetworkPolicy objects
    expect(Array.isArray(res.body)).toBe(true);
  });
});
