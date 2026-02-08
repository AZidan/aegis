# Sprint 5: Audit Trail Foundation — Implementation Prompt

**Sprint**: S5 (Phase 2, first sprint)
**Points**: 26
**Scope**: Backend only (no frontend this sprint)
**Branch**: Create `sprint-5/audit-trail` from `master`
**Duration**: 2 weeks

---

## Goal

Implement comprehensive audit logging infrastructure — the NestJS AuditModule, global interceptor for automatic capture, admin/agent action logging, and async BullMQ write pipeline. This is the foundation that **everything in Phase 2 depends on** (inter-agent messaging, channel integration, security alerting, audit viewer).

---

## Prerequisites

- Read `docs/api-contract.md` Section 9 (Tenant: Audit) for the exact API shapes
- Read `docs/phase-2-sprint-plan.yaml` for full acceptance criteria
- The Prisma schema already has: `AuditLog` model, `Alert` model, `AuditActorType`, `AuditTargetType`, `AuditSeverity` enums — you do NOT need to create these, they exist at `backend/prisma/schema.prisma` lines 87-106 and 632-678
- BullMQ is already configured globally in `backend/src/app.module.ts` (forRoot with Redis connection)
- The existing `LoggingInterceptor` at `backend/src/common/interceptors/logging.interceptor.ts` is the pattern reference for NestJS interceptors

---

## Stories (5 stories, implement sequentially)

### Story 1: E8-F1 — Audit Service & Global Interceptor (8 pts)

**Branch**: `sprint-5/audit-trail/1-audit-service`

Create the core AuditModule with AuditService and a global AuditInterceptor that automatically captures all API mutations.

#### Files to Create

```
backend/src/audit/
├── audit.module.ts           # NestJS module (imports BullModule, exports AuditService)
├── audit.service.ts          # Core service: logAction(), queryLogs()
├── audit.processor.ts        # BullMQ processor: writes audit events to DB
├── audit.constants.ts        # Queue name, sanitization field list
├── audit.interceptor.ts      # Global interceptor for POST/PUT/PATCH/DELETE
├── dto/
│   ├── create-audit-log.dto.ts  # DTO for logAction()
│   └── query-audit-log.dto.ts   # DTO for queryLogs() filters
└── interfaces/
    └── audit-event.interface.ts # TypeScript interface for queue job payload
```

#### AuditModule (`audit.module.ts`)

```typescript
// Pattern: follow provisioning.module.ts
// - Import BullModule.registerQueue({ name: 'audit-events' })
// - Provide: AuditService, AuditProcessor
// - Export: AuditService
// - Mark as @Global() so any module can inject AuditService
```

#### AuditService (`audit.service.ts`)

```typescript
// Core methods:

async logAction(event: CreateAuditLogDto): Promise<void>
// - Sanitize the event.details (strip password, token, secret, key, authorization fields)
// - Enqueue to BullMQ 'audit-events' queue (fire-and-forget, DO NOT await DB write)
// - This ensures zero latency impact on API responses

async queryLogs(filters: QueryAuditLogDto): Promise<{ data: AuditLog[]; meta: PaginationMeta }>
// - Prisma query with filters: tenantId, agentId, action, targetType, severity, dateFrom, dateTo
// - Cursor-based pagination (use timestamp + id for stable cursor)
// - Default: 50 per page, max 100
// - Order: timestamp DESC

// Sanitization helper (private):
private sanitizeDetails(details: Record<string, any>): Record<string, any>
// - Deep clone the object
// - Recursively strip keys matching: /password|token|secret|key|authorization|cookie|credential/i
// - Replace values with '[REDACTED]'
```

#### AuditProcessor (`audit.processor.ts`)

```typescript
// BullMQ Processor for 'audit-events' queue
// Pattern: follow provisioning.processor.ts

@Processor('audit-events')
export class AuditProcessor extends WorkerHost {
  async process(job: Job<AuditEventPayload>): Promise<void> {
    // Write to AuditLog table via PrismaService
    // Handle errors gracefully (log, don't throw — audit failures must never crash the app)
  }
}
```

#### AuditInterceptor (`audit.interceptor.ts`)

```typescript
// Global NestJS interceptor — captures ALL POST/PUT/PATCH/DELETE requests
// Pattern: follow logging.interceptor.ts but richer

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, body } = request;

    // Skip GET/HEAD/OPTIONS (read-only, no audit needed)
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    // Extract actor from JWT (request.user set by JwtAuthGuard)
    const user = request.user; // { userId, tenantId, role, email }

    // Determine actor type: 'user' for admin/tenant users, 'system' for internal calls
    // Determine target type from URL pattern:
    //   /api/admin/tenants/:id → targetType: 'tenant', targetId: params.id
    //   /api/dashboard/agents/:id → targetType: 'agent', targetId: params.id
    //   /api/dashboard/skills/:id → targetType: 'skill', targetId: params.id
    //   /api/auth/* → targetType: 'user', targetId: user.userId

    // Determine action from method + URL:
    //   POST /api/admin/tenants → action: 'tenant_created'
    //   PUT /api/admin/tenants/:id/config → action: 'tenant_config_updated'
    //   DELETE /api/dashboard/agents/:id → action: 'agent_deleted'

    return next.handle().pipe(
      tap((responseBody) => {
        // On success: enqueue audit event via AuditService.logAction()
        // Include: sanitized request body as details
        // Include: response status from context
      }),
      catchError((error) => {
        // On error: still log the failed attempt with severity 'warning' or 'error'
        throw error; // Re-throw to not swallow the error
      }),
    );
  }
}
```

#### Registration

Register the interceptor globally in `audit.module.ts` using `APP_INTERCEPTOR`:

```typescript
{
  provide: APP_INTERCEPTOR,
  useClass: AuditInterceptor,
}
```

Import `AuditModule` in `app.module.ts` (as a global module, it auto-provides to all).

#### Acceptance Criteria

- [ ] AuditModule registered globally in AppModule
- [ ] AuditService.logAction() enqueues to BullMQ without awaiting DB write
- [ ] AuditProcessor writes events to `audit_logs` table via Prisma
- [ ] AuditInterceptor captures all POST/PUT/PATCH/DELETE automatically
- [ ] Interceptor extracts actor from JWT (userId, role, tenantId)
- [ ] Request body sanitized — passwords, tokens, secrets replaced with `[REDACTED]`
- [ ] Failed requests also logged with severity `warning` or `error`
- [ ] GET/HEAD/OPTIONS requests are NOT logged (skip in interceptor)
- [ ] Interceptor adds < 5ms overhead (measured — it only enqueues, never awaits)

---

### Story 2: E8-F2 — Admin Operation Audit Logging (5 pts)

**Branch**: `sprint-5/audit-trail/2-admin-audit`
**Depends on**: Story 1

Integrate explicit audit calls into auth and admin services for login/logout events and configuration changes where the interceptor alone isn't sufficient (e.g., capturing before/after diffs for config changes, capturing login failure reasons).

#### Integration Points

**`auth.service.ts`** — Add explicit audit calls:

```typescript
// In login() method (line 35):
// After successful login:
await this.auditService.logAction({
  actorType: 'user',
  actorId: user.id,
  actorName: user.email,
  action: 'user_login',
  targetType: 'user',
  targetId: user.id,
  details: { method: 'email_password', mfaRequired: !!user.mfaSecret },
  severity: 'info',
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
  tenantId: user.tenantId || null,
});

// After failed login:
await this.auditService.logAction({
  actorType: 'system',
  actorId: 'auth-service',
  actorName: 'Authentication Service',
  action: 'user_login_failed',
  targetType: 'user',
  targetId: dto.email, // use email since user may not exist
  details: { reason: 'invalid_credentials' },
  severity: 'warning',
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});

// In logout() method (line 238):
await this.auditService.logAction({
  actorType: 'user',
  actorId: user.id,
  actorName: user.email,
  action: 'user_logout',
  targetType: 'user',
  targetId: user.id,
  severity: 'info',
  ipAddress: request.ip,
});

// In verifyMfa() method (line 260):
// Log MFA verification success/failure
```

**`admin/tenants/tenants.service.ts`** — Add config change audit:

```typescript
// For tenant config updates, capture before/after diff:
const beforeConfig = await this.prisma.tenantConfigHistory.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
// ... perform update ...
await this.auditService.logAction({
  action: 'tenant_config_updated',
  details: {
    before: beforeConfig?.config || null,
    after: newConfig,
    changedFields: Object.keys(diff),
  },
});
```

**`admin-auth.controller.ts`** — Admin-specific login:
```typescript
// Same pattern as auth.service.ts but with role: 'platform_admin'
```

#### Acceptance Criteria

- [ ] Login success logged with method, MFA status, IP, user agent
- [ ] Login failure logged with severity `warning`, failed email, IP
- [ ] Logout logged with user identity
- [ ] MFA verification success/failure logged
- [ ] Tenant create/update/delete/suspend logged with full context
- [ ] Config changes include before/after diff in details JSONB
- [ ] Skill install/uninstall logged with agent and skill identifiers
- [ ] All admin audit entries include IP address and user agent
- [ ] Audit entries are immutable after write (no UPDATE/DELETE on `audit_logs` table)

**Immutability enforcement**: Add a PostgreSQL migration with a trigger:

```sql
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs table is append-only: % operations are not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
```

---

### Story 3: E8-F1b — Agent Action Audit Logging (5 pts)

**Branch**: `sprint-5/audit-trail/3-agent-audit`
**Depends on**: Story 1

Integrate audit logging into agent-facing services for tool invocations, status changes, and skill operations.

#### Integration Points

**`dashboard/agents/agents.service.ts`**:

```typescript
// Agent CRUD operations:
// - agent_created: log agent name, role, model tier, tenant
// - agent_updated: log changed fields
// - agent_deleted: log agent name, tenant
// - agent_status_changed: log old status → new status

// For each, use actorType: 'user' (the tenant admin making the change)
```

**`dashboard/skills/skills.service.ts`**:

```typescript
// Skill operations:
// - skill_installed: log agent, skill name, skill version
// - skill_uninstalled: log agent, skill name
// For each, actorType: 'user', targetType: 'skill'
```

**`dashboard/tools/` (if tool policy changes exist)**:

```typescript
// Tool policy changes:
// - tool_policy_updated: log agent, before/after policy diff
```

#### Acceptance Criteria

- [ ] Agent CRUD operations logged (create, update, delete)
- [ ] Agent status transitions logged with old → new status
- [ ] Skill install/uninstall logged with agent + skill metadata
- [ ] Tool policy changes logged with before/after diff
- [ ] All agent audit entries scoped to correct tenantId
- [ ] Logs indexed by tenantId + timestamp for fast queries (already in schema)

---

### Story 4: Database Migration Prep for S6 (3 pts)

**Branch**: `sprint-5/audit-trail/4-s6-db-prep`
**Depends on**: None (can run in parallel with Stories 2-3)

Add Prisma models for `AgentMessage` and `AgentAllowlist` in preparation for Sprint 6 (inter-agent messaging). This is DB-only — no service implementation.

#### Schema Additions to `backend/prisma/schema.prisma`

```prisma
// ============================================================================
// INTER-AGENT MESSAGING (Sprint 6 — E7)
// ============================================================================

enum MessageType {
  task_handoff
  status_update
  data_request
  data_response
  escalation
  notification
}

enum MessageStatus {
  pending
  delivered
  failed
  read
}

enum AllowlistDirection {
  both
  send_only
  receive_only
}

model AgentMessage {
  id            String        @id @default(uuid())
  senderId      String
  sender        Agent         @relation("MessagesSent", fields: [senderId], references: [id], onDelete: Cascade)
  recipientId   String
  recipient     Agent         @relation("MessagesReceived", fields: [recipientId], references: [id], onDelete: Cascade)
  type          MessageType
  payload       Json          // Message content (JSONB)
  correlationId String?       // Links request-response pairs
  status        MessageStatus @default(pending)
  deliveredAt   DateTime?
  createdAt     DateTime      @default(now())

  @@index([senderId, createdAt])
  @@index([recipientId, createdAt])
  @@index([correlationId])
  @@index([type])
  @@map("agent_messages")
}

model AgentAllowlist {
  id             String             @id @default(uuid())
  agentId        String
  agent          Agent              @relation("AllowlistOwner", fields: [agentId], references: [id], onDelete: Cascade)
  allowedAgentId String
  allowedAgent   Agent              @relation("AllowlistTarget", fields: [allowedAgentId], references: [id], onDelete: Cascade)
  direction      AllowlistDirection @default(both)
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  @@unique([agentId, allowedAgentId])
  @@index([allowedAgentId])
  @@map("agent_allowlists")
}
```

Also add the reverse relations to the existing `Agent` model:

```prisma
// Add to existing Agent model:
messagesSent     AgentMessage[]    @relation("MessagesSent")
messagesReceived AgentMessage[]    @relation("MessagesReceived")
allowlistOwner   AgentAllowlist[]  @relation("AllowlistOwner")
allowlistTarget  AgentAllowlist[]  @relation("AllowlistTarget")
```

#### Steps

1. Add models + enums to `schema.prisma`
2. Add relations to `Agent` model
3. Run `npx prisma generate` to regenerate client
4. Run `npx prisma migrate dev --name add-agent-messaging` to create migration
5. Verify migration applies cleanly
6. Verify existing tests still pass (no breaking changes)

#### Acceptance Criteria

- [ ] AgentMessage model created with all fields and indexes
- [ ] AgentAllowlist model created with unique constraint and indexes
- [ ] New enums (MessageType, MessageStatus, AllowlistDirection) created
- [ ] Agent model has reverse relations for messages and allowlists
- [ ] Migration applies cleanly on fresh database AND on existing database
- [ ] All existing tests pass (no regressions)

---

### Story 5: Testing (5 pts)

**Branch**: `sprint-5/audit-trail/5-testing`
**Depends on**: Stories 1-4

Comprehensive unit and integration tests for the audit module.

#### Test Files to Create

```
backend/test/audit/
├── audit.service.spec.ts       # Unit tests for AuditService
├── audit.processor.spec.ts     # Unit tests for AuditProcessor
├── audit.interceptor.spec.ts   # Unit tests for AuditInterceptor
└── audit.integration.spec.ts   # Integration tests (full pipeline)
```

#### Test Coverage Requirements

**AuditService tests** (`audit.service.spec.ts`, ~15 tests):
- `logAction()` enqueues a job to BullMQ queue
- `logAction()` sanitizes details before enqueuing
- `logAction()` does not throw on queue error (graceful failure)
- `queryLogs()` returns paginated results
- `queryLogs()` filters by tenantId correctly
- `queryLogs()` filters by agentId, action, severity, dateRange
- `queryLogs()` respects cursor-based pagination
- `queryLogs()` defaults to 50 per page, max 100
- Sanitization strips `password`, `token`, `secret`, `key`, `authorization` fields
- Sanitization handles nested objects
- Sanitization handles null/undefined details

**AuditProcessor tests** (`audit.processor.spec.ts`, ~8 tests):
- Writes audit event to database via Prisma
- Handles Prisma errors gracefully (logs error, does not throw)
- Writes all required fields (actor, action, target, details, severity, etc.)
- Handles missing optional fields (ipAddress, userAgent, agentId, userId)

**AuditInterceptor tests** (`audit.interceptor.spec.ts`, ~15 tests):
- Skips GET requests (no audit logged)
- Skips HEAD requests
- Skips OPTIONS requests
- Captures POST request with actor from JWT
- Captures PUT request with target from URL params
- Captures PATCH request
- Captures DELETE request
- Extracts tenantId from JWT
- Extracts IP address and user agent
- Logs failed requests with severity 'warning'
- Does not block response (async enqueue)
- Handles missing user on request (unauthenticated endpoints like login)
- Maps URL patterns to correct action names
- Maps URL patterns to correct target types

**Integration tests** (`audit.integration.spec.ts`, ~20 tests):
- Full pipeline: HTTP request → interceptor → queue → processor → DB
- Login success creates audit entry with correct fields
- Login failure creates audit entry with severity warning
- Tenant creation creates audit entry
- Agent creation creates audit entry
- Skill install creates audit entry
- Config update includes before/after diff
- Sanitized fields show `[REDACTED]` in stored audit log
- Multiple rapid requests don't lose audit entries (queue reliability)
- Audit entries are tenant-scoped (tenant A can't see tenant B's logs)

**Target: 60+ tests total**

#### Test Patterns

Follow existing test patterns in `backend/test/`:
- Use `PrismaService` mock for unit tests
- Use `Test.createTestingModule()` for integration tests
- Use `BullMQ` mock (jest mock the queue's `add()` method)
- Use the existing test helpers for creating mock users and tenants

---

## Technical Reference

### Existing Codebase Patterns to Follow

| Pattern | Reference File | What to Copy |
|---------|---------------|--------------|
| BullMQ module setup | `provisioning/provisioning.module.ts` | Queue registration, processor pattern |
| BullMQ processor | `provisioning/provisioning.processor.ts` | `WorkerHost` extension, job processing |
| NestJS interceptor | `common/interceptors/logging.interceptor.ts` | ExecutionContext, tap/catchError |
| Global module | Import pattern in `app.module.ts` | Module imports |
| Prisma service usage | Any `*.service.ts` | `this.prisma.auditLog.create()` |
| Test patterns | `test/auth/auth.service.spec.ts` | Mock setup, test structure |

### Prisma Schema (Already Exists — DO NOT recreate)

The following already exist in `backend/prisma/schema.prisma`:

```
Lines 87-91:   enum AuditActorType { user, agent, system }
Lines 93-100:  enum AuditTargetType { agent, skill, tenant, user, team_member, api_key }
Lines 102-106: enum AuditSeverity { info, warning, error }
Lines 108-112: enum AlertSeverity { info, warning, critical }
Lines 603-623: model Alert { ... }
Lines 632-678: model AuditLog { ... }
```

### Key Architecture Decisions

1. **Async writes only**: AuditInterceptor NEVER awaits the DB write. It enqueues to BullMQ and returns immediately. The processor handles the write asynchronously. This is critical — audit must add < 5ms overhead.

2. **Global interceptor**: Using `APP_INTERCEPTOR` provider makes the interceptor apply to ALL controllers automatically. No manual decoration needed.

3. **Explicit + automatic**: The interceptor captures everything automatically, but some operations need EXPLICIT audit calls (login failures, config diffs, MFA events) because the interceptor can't infer rich context.

4. **Sanitization at enqueue time**: Details are sanitized BEFORE enqueuing to BullMQ, not at write time. This ensures sensitive data never enters the queue.

5. **Immutable audit log**: PostgreSQL trigger prevents UPDATE/DELETE on `audit_logs`. This is a compliance requirement.

6. **Tenant scoping**: All audit queries filter by `tenantId`. Platform admins can query cross-tenant by omitting the filter. The interceptor extracts `tenantId` from the JWT.

### Import Path for PrismaClient

```typescript
// CORRECT:
import { PrismaService } from '../prisma/prisma.service';

// WRONG (do not use):
// import { PrismaClient } from '@prisma/client';
```

### BullMQ Queue Name

```typescript
// audit.constants.ts
export const AUDIT_QUEUE_NAME = 'audit-events';
```

---

## Sprint 5 DoD (Definition of Done)

- [ ] All 5 stories implemented and merged to `sprint-5/audit-trail`
- [ ] 60+ tests passing
- [ ] All existing tests still pass (no regressions)
- [ ] AuditModule globally registered
- [ ] Every POST/PUT/PATCH/DELETE endpoint automatically captured
- [ ] Login/logout/MFA explicitly logged with IP + user agent
- [ ] Config changes include before/after diff
- [ ] Passwords/tokens/secrets never appear in audit details
- [ ] `audit_logs` table is append-only (trigger enforced)
- [ ] AgentMessage + AgentAllowlist models migrated (prep for S6)
- [ ] Audit write adds < 5ms overhead to API responses (BullMQ async)
- [ ] No P0/P1 bugs

---

## What This Unlocks (Sprint 6)

Sprint 5 completion enables:
- **E7-F1**: Inter-agent messaging (uses AgentMessage/AgentAllowlist models + audit logging)
- **E8-F3**: Audit log viewer UI (queries the audit data we write this sprint)
- **E8-F4**: Security alerting (consumes audit events from the queue)
- **E11-F1**: Channel data model (depends on audit module for logging channel operations)

Sprint 5 is the **critical path foundation** — everything else in Phase 2 blocks on it.
