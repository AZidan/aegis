# Sprint 5: Audit Trail & Billing APIs

## Sprint Overview

**Goal:** Build audit trail foundation and billing APIs
**Total Points:** 49
**Duration:** 2 weeks
**Prerequisites:** Sprint 4 complete (billing schema, usage tracking in place)

## Context Files to Read First

```
MUST READ:
- docs/sprint-backlog.md          # Full backlog with story details
- docs/pricing-model.md           # Billing requirements
- docs/api-contract.md            # API specifications
- roadmap.yaml                    # E8 (Audit Trail) epic definition

SPRINT 4 OUTPUTS (verify these exist):
- backend/prisma/schema.prisma    # Should have PlanTier, UsageRecord
- backend/src/billing/            # UsageTrackingService from S4

EXISTING CODE:
- backend/src/audit/              # May have basic audit structure
- backend/src/container/          # DockerOrchestratorService
```

---

## Stories

### S5-01: Database Migration for Messaging Tables (3 pts)
**Scope:** Backend
**Priority:** Start first

**Task:**
Ensure AgentMessage and AgentAllowlist models have proper migrations applied.

**Verify Schema (should exist from earlier sprints):**
```prisma
model AgentMessage {
  id            String        @id @default(uuid())
  senderId      String
  sender        Agent         @relation("MessagesSent", fields: [senderId], references: [id], onDelete: Cascade)
  recipientId   String
  recipient     Agent         @relation("MessagesReceived", fields: [recipientId], references: [id], onDelete: Cascade)
  type          MessageType
  payload       Json
  correlationId String?
  status        MessageStatus @default(pending)
  createdAt     DateTime      @default(now())
  deliveredAt   DateTime?

  @@index([senderId, createdAt])
  @@index([recipientId, createdAt])
  @@index([correlationId])
  @@index([type])
  @@map("agent_messages")
}

model AgentAllowlist {
  id             String   @id @default(uuid())
  agentId        String
  agent          Agent    @relation("AllowlistOwner", fields: [agentId], references: [id], onDelete: Cascade)
  allowedAgentId String
  allowedAgent   Agent    @relation("AllowlistTarget", fields: [allowedAgentId], references: [id], onDelete: Cascade)
  createdAt      DateTime @default(now())

  @@unique([agentId, allowedAgentId])
  @@map("agent_allowlists")
}

enum MessageType {
  task_handoff
  status_update
  data_request
  data_response
  escalation
}

enum MessageStatus {
  pending
  delivered
  failed
  blocked
}
```

**Acceptance Criteria:**
- [ ] Verify AgentMessage model exists in schema
- [ ] Verify AgentAllowlist model exists in schema
- [ ] Run `npx prisma migrate dev` to ensure migrations applied
- [ ] Verify indexes are created for query performance

**Files to Check:**
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/`

---

### S5-05: Audit Service Core (8 pts)
**Scope:** Backend

**Task:**
Create the core audit infrastructure with global interceptor and async writing.

**Architecture:**
```
Request → NestJS Interceptor → AuditService.logAction() → BullMQ Queue → AuditProcessor → Database
```

**Service Interface:**
```typescript
// backend/src/audit/audit.service.ts
@Injectable()
export class AuditService {
  // Log an admin action (API mutation)
  async logAdminAction(data: {
    actorId: string;
    actorType: 'platform_admin' | 'tenant_admin';
    tenantId?: string;
    action: string;          // e.g., "tenant.create", "agent.update"
    resourceType: string;    // e.g., "tenant", "agent", "skill"
    resourceId: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void>;

  // Log an agent action (tool invocation, message, etc.)
  async logAgentAction(data: {
    agentId: string;
    tenantId: string;
    action: string;          // e.g., "tool.invoke", "message.send"
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, any>;
    status: 'success' | 'failure';
    errorMessage?: string;
  }): Promise<void>;

  // Query audit logs
  async queryLogs(filters: AuditLogFilters): Promise<PaginatedAuditLogs>;
}
```

**Database Model:**
```prisma
model AuditLog {
  id           String   @id @default(uuid())

  // Actor info
  actorId      String
  actorType    ActorType
  tenantId     String?
  tenant       Tenant?  @relation(fields: [tenantId], references: [id], onDelete: SetNull)

  // Action info
  action       String   // e.g., "tenant.create", "agent.tool_invoke"
  resourceType String?
  resourceId   String?
  details      Json?    // Sanitized request/response data

  // Request context
  ipAddress    String?
  userAgent    String?

  // Outcome
  status       AuditStatus @default(success)
  errorMessage String?

  // Timestamps
  createdAt    DateTime @default(now())

  @@index([tenantId, createdAt])
  @@index([actorId, createdAt])
  @@index([action])
  @@index([resourceType, resourceId])
  @@map("audit_logs")
}

enum ActorType {
  platform_admin
  tenant_admin
  tenant_member
  agent
  system
}

enum AuditStatus {
  success
  failure
}
```

**Acceptance Criteria:**
- [ ] Create AuditLog model in Prisma schema
- [ ] Create AuditModule with AuditService
- [ ] Create AuditProcessor for async BullMQ processing
- [ ] Implement logAdminAction and logAgentAction methods
- [ ] Implement queryLogs with filtering and pagination
- [ ] Sanitize sensitive data (passwords, tokens) in details
- [ ] Write 25+ unit tests

**Files to Create:**
- `backend/src/audit/audit.module.ts`
- `backend/src/audit/audit.service.ts`
- `backend/src/audit/audit.processor.ts`
- `backend/src/audit/dto/audit-log.dto.ts`
- `backend/src/audit/interfaces/audit.interface.ts`
- `backend/test/audit/audit.service.spec.ts`

---

### S5-02: Admin Operation Audit Logging (5 pts)
**Scope:** Backend
**Dependencies:** S5-05

**Task:**
Create global interceptor to automatically log all admin API mutations.

**Interceptor:**
```typescript
// backend/src/audit/audit.interceptor.ts
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit mutations (POST, PUT, PATCH, DELETE)
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (response) => this.logSuccess(request, response, startTime),
        error: (error) => this.logFailure(request, error, startTime),
      })
    );
  }
}
```

**Actions to Log:**
- `auth.login` / `auth.logout` / `auth.mfa_verify`
- `tenant.create` / `tenant.update` / `tenant.suspend` / `tenant.delete`
- `agent.create` / `agent.update` / `agent.delete`
- `skill.install` / `skill.uninstall`
- `config.update` / `config.rollback`
- `user.invite` / `user.remove` / `user.role_change`

**Acceptance Criteria:**
- [ ] Create AuditInterceptor as global interceptor
- [ ] Register in AppModule with APP_INTERCEPTOR
- [ ] Log all POST/PUT/PATCH/DELETE requests
- [ ] Capture before/after state for updates (diff)
- [ ] Include IP address and user agent
- [ ] Sanitize sensitive fields (password, token, secret)
- [ ] Write integration tests

**Files to Create/Modify:**
- `backend/src/audit/audit.interceptor.ts`
- `backend/src/app.module.ts` (register interceptor)
- `backend/test/audit/audit.interceptor.spec.ts`

---

### S5-03: Agent Action Audit Logging (5 pts)
**Scope:** Backend
**Dependencies:** S5-05

**Task:**
Log agent actions: tool invocations, status changes, skill operations.

**Integration Points:**
1. **Channel Proxy** - Log inbound/outbound messages
2. **Tool Invocations** - Log when agents use tools
3. **Agent Status Changes** - Log status transitions
4. **Skill Operations** - Log skill install/uninstall per agent

**Example Usage:**
```typescript
// In channel-proxy.processor.ts
await this.auditService.logAgentAction({
  agentId: sessionContext.agentId,
  tenantId: sessionContext.tenantId,
  action: 'message.inbound',
  details: {
    platform: event.platform,
    channelId: event.channelId,
    messageLength: event.text.length,
    // Do NOT log message content for privacy
  },
  status: 'success',
});
```

**Acceptance Criteria:**
- [ ] Add audit logging to ChannelProxyProcessor
- [ ] Add audit logging to agent status changes
- [ ] Add audit logging to skill installation
- [ ] Ensure message content is NOT logged (privacy)
- [ ] Log tool names but sanitize tool parameters
- [ ] Write unit tests

**Files to Modify:**
- `backend/src/channel-proxy/channel-proxy.processor.ts`
- `backend/src/dashboard/agents/agents.service.ts`
- `backend/src/skills/skills.service.ts`

---

### S5-04: Audit Module Unit Tests (5 pts)
**Scope:** Testing
**Dependencies:** S5-02, S5-03

**Task:**
Comprehensive test coverage for audit module.

**Test Coverage:**
```
AuditService
  ├── logAdminAction
  │   ├── should create audit log entry
  │   ├── should sanitize sensitive fields
  │   ├── should handle missing optional fields
  │   └── should queue for async processing
  ├── logAgentAction
  │   ├── should create audit log for tool invocation
  │   ├── should log failure status with error message
  │   └── should not log message content
  └── queryLogs
      ├── should filter by tenantId
      ├── should filter by date range
      ├── should filter by action type
      ├── should paginate results
      └── should order by createdAt desc

AuditInterceptor
  ├── should skip GET requests
  ├── should log POST requests
  ├── should capture request/response
  ├── should handle errors gracefully
  └── should not block request on audit failure
```

**Acceptance Criteria:**
- [ ] 60+ unit tests for audit module
- [ ] Test coverage > 80%
- [ ] Integration tests for interceptor
- [ ] Mock BullMQ for unit tests

**Files to Create:**
- `backend/test/audit/audit.service.spec.ts`
- `backend/test/audit/audit.interceptor.spec.ts`
- `backend/test/audit/audit.processor.spec.ts`

---

### E12-06: Token Usage Warning System (5 pts)
**Scope:** Backend
**Dependencies:** E12-03 (from Sprint 4)

**Task:**
Implement token usage warnings at 80/100/120/150% thresholds.

**Thresholds (from pricing-model.md):**
| Threshold | Action |
|-----------|--------|
| 80% | Dashboard warning banner + email to tenant admin |
| 100% | Email notification; agent continues (grace zone) |
| 120% | Agent rate-limited (slower responses) |
| 150% | Agent paused; admin must acknowledge to resume |

**Service:**
```typescript
// backend/src/billing/usage-warning.service.ts
@Injectable()
export class UsageWarningService {
  async checkUsageThresholds(tenantId: string): Promise<UsageWarning[]>;

  async sendWarningEmail(tenantId: string, threshold: number): Promise<void>;

  async applyRateLimiting(agentId: string): Promise<void>;

  async pauseAgent(agentId: string, reason: string): Promise<void>;

  async acknowledgeWarning(tenantId: string, adminId: string): Promise<void>;
}
```

**Acceptance Criteria:**
- [ ] Create UsageWarningService
- [ ] Add BullMQ job to check thresholds daily
- [ ] Send email at 80% and 100% thresholds
- [ ] Apply rate limiting at 120%
- [ ] Pause agent at 150%
- [ ] Add acknowledgement endpoint for admin
- [ ] Write unit tests

**Files to Create:**
- `backend/src/billing/usage-warning.service.ts`
- `backend/src/billing/usage-warning.processor.ts`
- `backend/test/billing/usage-warning.service.spec.ts`

---

### E12-07: Overage Billing Toggle API (5 pts)
**Scope:** Backend
**Dependencies:** E12-01 (from Sprint 4)

**Task:**
Allow Growth/Enterprise tenants to enable pay-as-you-go overage.

**API Endpoints:**
```
PUT /api/tenants/:id/billing/overage
{
  "enabled": true
}

GET /api/tenants/:id/billing/overage
{
  "enabled": true,
  "currentOverageTokens": 150000,
  "estimatedOverageCost": 12.40
}
```

**Business Rules:**
- Starter plan CANNOT enable overage (return 403)
- Growth and Enterprise can enable overage
- When enabled, no rate limiting at 120%
- Overage tracked separately in UsageRecord

**Acceptance Criteria:**
- [ ] Add PUT endpoint to toggle overage
- [ ] Add GET endpoint to check overage status
- [ ] Validate plan tier before enabling
- [ ] Return current overage usage and cost estimate
- [ ] Update rate limiting logic to respect overage flag
- [ ] Write unit tests

**Files to Create/Modify:**
- `backend/src/billing/billing.controller.ts`
- `backend/src/billing/billing.service.ts`
- `backend/src/billing/usage-warning.service.ts` (modify)

---

### E12-08: Billing Overview API (8 pts)
**Scope:** Backend
**Dependencies:** E12-03, E12-06, E12-07

**Task:**
Create comprehensive billing overview endpoint.

**API Endpoint:**
```
GET /api/dashboard/billing/overview

Response:
{
  "planTier": "growth",
  "platformFee": 299,
  "includedAgents": 5,
  "currentAgentCount": 7,
  "agents": [
    {
      "id": "agent-1",
      "name": "PM Agent",
      "modelTier": "sonnet",
      "thinkingMode": "low",
      "monthlyFee": 0,        // included
      "isIncluded": true
    },
    {
      "id": "agent-6",
      "name": "Ops Agent",
      "modelTier": "opus",
      "thinkingMode": "high",
      "monthlyFee": 119,      // $99 + $20 thinking
      "isIncluded": false
    }
  ],
  "subtotals": {
    "platformFee": 299,
    "additionalAgents": 238,   // 2 additional agents
    "thinkingSurcharge": 20,
    "overageEstimate": 0
  },
  "totalMonthly": 557,
  "billingCycle": "monthly",
  "nextBillingDate": "2026-03-01"
}
```

**Acceptance Criteria:**
- [ ] Create billing controller with overview endpoint
- [ ] Calculate per-agent costs based on model tier
- [ ] Track included vs additional agents
- [ ] Add thinking mode surcharge (+$20 for high)
- [ ] Calculate overage estimate if enabled
- [ ] Return next billing date
- [ ] Write unit tests

**Files to Create:**
- `backend/src/billing/billing.controller.ts`
- `backend/src/billing/dto/billing-overview.dto.ts`
- `backend/test/billing/billing.controller.spec.ts`

---

### E12-09: Billing Usage API (8 pts)
**Scope:** Backend
**Dependencies:** E12-03, E12-08

**Task:**
Create per-agent token consumption endpoint.

**API Endpoint:**
```
GET /api/dashboard/billing/usage?period=current

Response:
{
  "period": {
    "start": "2026-02-01",
    "end": "2026-02-28"
  },
  "tenantTotal": {
    "inputTokens": 4500000,
    "outputTokens": 1200000,
    "thinkingTokens": 300000,
    "toolInvocations": 15420,
    "estimatedCost": 156.80
  },
  "quota": {
    "total": 5000000,
    "used": 4500000,
    "remaining": 500000,
    "percentUsed": 90
  },
  "agents": [
    {
      "id": "agent-1",
      "name": "PM Agent",
      "usage": {
        "inputTokens": 2000000,
        "outputTokens": 500000,
        "thinkingTokens": 100000,
        "toolInvocations": 8500,
        "estimatedCost": 68.50
      },
      "quota": {
        "total": 2500000,
        "used": 2000000,
        "percentUsed": 80
      },
      "status": "normal"  // normal | warning | limited | paused
    }
  ],
  "dailyBreakdown": [
    { "date": "2026-02-01", "tokens": 150000, "cost": 5.20 },
    { "date": "2026-02-02", "tokens": 180000, "cost": 6.10 }
  ]
}
```

**Acceptance Criteria:**
- [ ] Create usage endpoint with period filter
- [ ] Aggregate usage from UsageRecord table
- [ ] Calculate per-agent breakdown
- [ ] Include daily usage chart data
- [ ] Show quota status per agent
- [ ] Return estimated cost based on model tier
- [ ] Write unit tests

**Files to Create/Modify:**
- `backend/src/billing/billing.controller.ts`
- `backend/src/billing/dto/billing-usage.dto.ts`
- `backend/src/billing/billing.service.ts`

---

## Dependencies Diagram

```
S5-01 (DB Migration) ────────────> (independent, verify first)

S5-05 (Audit Core) ───────┬──> S5-02 (Admin Audit) ───> S5-04 (Tests)
                          └──> S5-03 (Agent Audit) ───┘

E12-06 (Usage Warnings) ──┬──> E12-08 (Billing Overview)
E12-07 (Overage Toggle) ──┴──> E12-09 (Billing Usage)
```

---

## Sprint Exit Criteria

Before marking Sprint 5 complete, verify:

- [ ] All admin mutations logged with actor, timestamp, and details
- [ ] All agent tool invocations logged (without message content)
- [ ] Token usage warnings sent at 80% threshold
- [ ] Overage billing toggle works for Growth/Enterprise
- [ ] Billing overview API returns accurate cost breakdown
- [ ] Billing usage API shows per-agent consumption
- [ ] 60+ audit module tests passing
- [ ] All new code has unit tests
- [ ] No TypeScript errors
- [ ] All existing tests still pass

---

## Technical Notes

### BullMQ Queues
```typescript
// Audit queue for async log writing
@Processor('audit')
export class AuditProcessor extends WorkerHost { }

// Usage warning queue for threshold checks
@Processor('usage-warning')
export class UsageWarningProcessor extends WorkerHost { }
```

### Sanitization Rules
```typescript
const SENSITIVE_FIELDS = [
  'password', 'token', 'secret', 'apiKey', 'accessToken',
  'refreshToken', 'authorization', 'credential'
];

function sanitize(obj: any): any {
  // Recursively replace sensitive fields with '[REDACTED]'
}
```
