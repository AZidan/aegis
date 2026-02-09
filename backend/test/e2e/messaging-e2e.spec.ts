/**
 * E2E Integration Tests: Messaging & Allowlist Flow
 *
 * Tests the full inter-agent messaging pipeline end-to-end:
 *   1. Allowlist enforcement (blocked without allowlist → 403)
 *   2. Allowlist CRUD (set up, verify, communication graph)
 *   3. Message sending (with allowlist → 201)
 *   4. Message querying (agent messages, tenant messages, pagination)
 *
 * Requires: running PostgreSQL + Redis (for BullMQ + cache)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor';
import { PrismaService } from '../../src/prisma/prisma.service';

jest.setTimeout(60000);

let app: INestApplication;
let prisma: PrismaService;
let tenantAccessToken: string;

// IDs created during tests (for cleanup)
let agentAId: string | null = null;
let agentBId: string | null = null;
let sentMessageId: string | null = null;

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
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.init();
  prisma = moduleFixture.get<PrismaService>(PrismaService);
}, 30000);

afterAll(async () => {
  // Clean up test data in reverse dependency order
  try {
    if (sentMessageId) {
      await prisma.agentMessage
        .delete({ where: { id: sentMessageId } })
        .catch(() => {});
    }
    if (agentAId) {
      await prisma.agentAllowlist
        .deleteMany({ where: { agentId: agentAId } })
        .catch(() => {});
      await prisma.agentMessage
        .deleteMany({
          where: { OR: [{ senderId: agentAId }, { recipientId: agentAId }] },
        })
        .catch(() => {});
      await prisma.skillInstallation
        .deleteMany({ where: { agentId: agentAId } })
        .catch(() => {});
      await prisma.agent.delete({ where: { id: agentAId } }).catch(() => {});
    }
    if (agentBId) {
      await prisma.agentAllowlist
        .deleteMany({ where: { agentId: agentBId } })
        .catch(() => {});
      await prisma.agentMessage
        .deleteMany({
          where: { OR: [{ senderId: agentBId }, { recipientId: agentBId }] },
        })
        .catch(() => {});
      await prisma.skillInstallation
        .deleteMany({ where: { agentId: agentBId } })
        .catch(() => {});
      await prisma.agent.delete({ where: { id: agentBId } }).catch(() => {});
    }
  } catch {
    // Swallow cleanup errors
  }

  await app.close();
}, 15000);

// =============================================================================
// Suite: Messaging & Allowlist E2E Flow
// =============================================================================
describe('Suite: Messaging & Allowlist E2E Flow', () => {
  // ---------------------------------------------------------------------------
  // Step 1: Authentication
  // ---------------------------------------------------------------------------
  it('should login as tenant admin and receive JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'tenant@acme.com', password: 'Tenant12345!@' })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user).toHaveProperty('role', 'tenant_admin');

    tenantAccessToken = res.body.accessToken;
  });

  // ---------------------------------------------------------------------------
  // Step 2: Create two test agents
  // ---------------------------------------------------------------------------
  it('should create Agent A (sender)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/dashboard/agents')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .send({
        name: 'E2E Sender Agent',
        role: 'engineering',
        modelTier: 'sonnet',
        thinkingMode: 'standard',
        temperature: 0.5,
        toolPolicy: { allow: [] },
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name', 'E2E Sender Agent');
    agentAId = res.body.id;
  });

  it('should create Agent B (recipient)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/dashboard/agents')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .send({
        name: 'E2E Recipient Agent',
        role: 'support',
        modelTier: 'haiku',
        thinkingMode: 'standard',
        temperature: 0.3,
        toolPolicy: { allow: [] },
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name', 'E2E Recipient Agent');
    agentBId = res.body.id;
  });

  // ---------------------------------------------------------------------------
  // Step 3: Allowlist enforcement — blocked without allowlist
  // ---------------------------------------------------------------------------
  it('should return 403 when sending message without allowlist', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/dashboard/agents/${agentAId}/messages`)
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .send({
        recipientId: agentBId,
        type: 'task_handoff',
        payload: { task: 'blocked message' },
      })
      .expect(403);

    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toContain('not allowed');
  });

  // ---------------------------------------------------------------------------
  // Step 4: Set up allowlist
  // ---------------------------------------------------------------------------
  it('should update allowlist for Agent A (direction: both)', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/dashboard/agents/${agentAId}/allowlist`)
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .send({
        entries: [
          { allowedAgentId: agentBId, direction: 'both' },
        ],
      })
      .expect(200);

    expect(res.body).toHaveProperty('agentId', agentAId);
    expect(res.body).toHaveProperty('entryCount', 1);
  });

  // ---------------------------------------------------------------------------
  // Step 5: Verify allowlist via GET
  // ---------------------------------------------------------------------------
  it('should return allowlist entries for Agent A', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/dashboard/agents/${agentAId}/allowlist`)
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('agentId', agentAId);
    expect(res.body).toHaveProperty('agentName', 'E2E Sender Agent');
    expect(res.body).toHaveProperty('entries');
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0]).toHaveProperty('allowedAgentId', agentBId);
    expect(res.body.entries[0]).toHaveProperty('allowedAgentName', 'E2E Recipient Agent');
    expect(res.body.entries[0]).toHaveProperty('direction', 'both');
  });

  // ---------------------------------------------------------------------------
  // Step 6: Send message (with allowlist → success)
  // ---------------------------------------------------------------------------
  it('should send message from Agent A to Agent B (201)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/dashboard/agents/${agentAId}/messages`)
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .send({
        recipientId: agentBId,
        type: 'task_handoff',
        payload: { task: 'review PR #42', priority: 'high' },
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('senderId', agentAId);
    expect(res.body).toHaveProperty('recipientId', agentBId);
    expect(res.body).toHaveProperty('type', 'task_handoff');
    expect(res.body).toHaveProperty('status', 'pending');
    expect(res.body).toHaveProperty('createdAt');

    sentMessageId = res.body.id;
  });

  // ---------------------------------------------------------------------------
  // Step 7: Get agent messages
  // ---------------------------------------------------------------------------
  it('should return Agent A messages including the sent message', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/dashboard/agents/${agentAId}/messages`)
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const msg = res.body.data.find(
      (m: { id: string }) => m.id === sentMessageId,
    );
    expect(msg).toBeDefined();
    expect(msg.senderId).toBe(agentAId);
    expect(msg.recipientId).toBe(agentBId);
    expect(msg.senderName).toBe('E2E Sender Agent');
    expect(msg.recipientName).toBe('E2E Recipient Agent');
    expect(msg.type).toBe('task_handoff');

    // Meta should have pagination fields
    expect(res.body.meta).toHaveProperty('count');
    expect(res.body.meta).toHaveProperty('hasNextPage');
    expect(res.body.meta).toHaveProperty('nextCursor');
  });

  // ---------------------------------------------------------------------------
  // Step 8: Get tenant messages
  // ---------------------------------------------------------------------------
  it('should return tenant-wide messages including the sent message', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/messages')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);

    const msg = res.body.data.find(
      (m: { id: string }) => m.id === sentMessageId,
    );
    expect(msg).toBeDefined();
    expect(msg.senderId).toBe(agentAId);
    expect(msg.recipientId).toBe(agentBId);
  });

  // ---------------------------------------------------------------------------
  // Step 9: Communication graph
  // ---------------------------------------------------------------------------
  it('should return communication graph with test agents and edges', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/communication-graph')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('nodes');
    expect(res.body).toHaveProperty('edges');
    expect(Array.isArray(res.body.nodes)).toBe(true);
    expect(Array.isArray(res.body.edges)).toBe(true);

    // Should contain our test agents as nodes
    const nodeA = res.body.nodes.find(
      (n: { id: string }) => n.id === agentAId,
    );
    const nodeB = res.body.nodes.find(
      (n: { id: string }) => n.id === agentBId,
    );
    expect(nodeA).toBeDefined();
    expect(nodeA.name).toBe('E2E Sender Agent');
    expect(nodeB).toBeDefined();
    expect(nodeB.name).toBe('E2E Recipient Agent');

    // Should contain the allowlist edge A → B
    const edge = res.body.edges.find(
      (e: { source: string; target: string }) =>
        e.source === agentAId && e.target === agentBId,
    );
    expect(edge).toBeDefined();
    expect(edge.direction).toBe('both');
  });

  // ---------------------------------------------------------------------------
  // Step 10: Message filtering
  // ---------------------------------------------------------------------------
  it('should filter agent messages by type', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/dashboard/agents/${agentAId}/messages?type=task_handoff`)
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    for (const msg of res.body.data) {
      expect(msg.type).toBe('task_handoff');
    }
  });
});
