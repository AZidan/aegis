/**
 * E2E Config Lifecycle Tests
 *
 * Tests config update → history → rollback → sync flow.
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

const CONFIG_TENANT = 'E2E Config Corp';

let app: INestApplication;
let prisma: PrismaService;
let adminAccessToken: string;
let testTenantId: string | null = null;

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

  // Clean up test tenant from previous run
  const existing = await prisma.tenant.findUnique({
    where: { companyName: CONFIG_TENANT },
  });
  if (existing) {
    await prisma.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER ALL').catch(() => {});
    await prisma.auditLog.deleteMany({ where: { tenantId: existing.id } }).catch(() => {});
    await prisma.skillInstallation.deleteMany({ where: { agent: { tenantId: existing.id } } }).catch(() => {});
    await prisma.agent.deleteMany({ where: { tenantId: existing.id } }).catch(() => {});
    await (prisma as any).tenantConfigHistory?.deleteMany({ where: { tenantId: existing.id } }).catch(() => {});
    await (prisma as any).usageRecord?.deleteMany({ where: { tenantId: existing.id } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: existing.id } }).catch(() => {});
    await prisma.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER ALL').catch(() => {});
  }

  // Authenticate as platform admin (matches seed data)
  const totpCode = speakeasy.totp({
    secret: 'JBSWY3DPEHPK3PXP',
    encoding: 'base32',
  });
  const mfaRes = await request(app.getHttpServer())
    .post('/api/auth/mfa/verify')
    .send({ email: 'admin@aegis.ai', totpCode });
  adminAccessToken = mfaRes.body.accessToken;
});

afterAll(async () => {
  if (testTenantId) {
    await prisma.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER ALL').catch(() => {});
    await prisma.auditLog.deleteMany({ where: { tenantId: testTenantId } }).catch(() => {});
    await prisma.skillInstallation.deleteMany({ where: { agent: { tenantId: testTenantId } } }).catch(() => {});
    await prisma.agent.deleteMany({ where: { tenantId: testTenantId } }).catch(() => {});
    await (prisma as any).tenantConfigHistory?.deleteMany({ where: { tenantId: testTenantId } }).catch(() => {});
    await (prisma as any).usageRecord?.deleteMany({ where: { tenantId: testTenantId } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
    await prisma.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER ALL').catch(() => {});
  }
  await app.close();
});

// ==========================================================================
// Suite: Config Update → History → Rollback
// ==========================================================================

describe('Config Lifecycle', () => {
  it('should create a test tenant', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        companyName: CONFIG_TENANT,
        adminEmail: 'config-test@test.com',
        plan: 'growth',
        billingCycle: 'monthly',
        resourceLimits: { maxAgents: 10, maxSkills: 50, diskGb: 50 },
      });

    expect(res.status).toBe(201);
    testTenantId = res.body.id;
  });

  it('should update tenant config and create history entry', async () => {
    if (!testTenantId) return;

    const res = await request(app.getHttpServer())
      .patch(`/api/admin/tenants/${testTenantId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        plan: 'enterprise',
        resourceLimits: { maxAgents: 50 },
      });

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('enterprise');
  });

  it('should have a config history entry after update', async () => {
    if (!testTenantId) return;

    const res = await request(app.getHttpServer())
      .get(`/api/admin/tenants/${testTenantId}/config/history`)
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    // First history entry should capture the "before" state (growth plan)
    const entry = res.body.data[0];
    expect(entry.config).toBeDefined();
    expect(entry.changeDescription).toBeDefined();
    expect(entry.changedBy).toBeDefined();
  });

  it('should rollback config to previous state', async () => {
    if (!testTenantId) return;

    // Get history
    const historyRes = await request(app.getHttpServer())
      .get(`/api/admin/tenants/${testTenantId}/config/history`)
      .set('Authorization', `Bearer ${adminAccessToken}`);

    const historyEntry = historyRes.body.data[0];

    // Rollback (POST with historyId in body)
    const rollbackRes = await request(app.getHttpServer())
      .post(`/api/admin/tenants/${testTenantId}/config/rollback`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ historyId: historyEntry.id });

    expect(rollbackRes.status).toBe(200);
    // After rollback, plan should be back to growth
    expect(rollbackRes.body.plan).toBe('growth');
  });

  it('should have two history entries after update + rollback', async () => {
    if (!testTenantId) return;

    const res = await request(app.getHttpServer())
      .get(`/api/admin/tenants/${testTenantId}/config/history`)
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
    // At least 2: one for update-to-enterprise, one for rollback-to-growth
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should verify tenant billing fields set on creation', async () => {
    if (!testTenantId) return;
    const tenant = await prisma.tenant.findUnique({
      where: { id: testTenantId },
    });
    expect(tenant).toBeDefined();
    expect(tenant!.overageBillingEnabled).toBeDefined();
  });
});
