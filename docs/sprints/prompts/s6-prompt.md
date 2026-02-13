# Sprint 6: Messaging, Audit UI & Billing UI

## Sprint Overview

**Goal:** Inter-agent messaging API, audit log viewer, billing dashboard
**Total Points:** 42
**Duration:** 2 weeks
**Prerequisites:** Sprint 5 complete (audit service, billing APIs)

## Context Files to Read First

```
MUST READ:
- docs/sprint-backlog.md          # Full backlog with story details
- docs/api-contract.md            # API specifications
- docs/pricing-model.md           # Billing UI requirements
- roadmap.yaml                    # E7 (Inter-Agent Communication) epic

SPRINT 5 OUTPUTS (verify these exist):
- backend/src/audit/              # AuditService, AuditInterceptor
- backend/src/billing/            # BillingController, UsageTrackingService

EXISTING CODE:
- backend/src/messaging/          # May have basic structure from earlier
- backend/prisma/schema.prisma    # AgentMessage, AgentAllowlist models
- frontend/src/components/        # UI component patterns
```

---

## Stories

### S6-05: Structured Inter-Agent Messaging API (13 pts)
**Scope:** Backend
**Priority:** Critical path - start first

**Task:**
Implement full inter-agent messaging system with allowlist enforcement.

**Message Types:**
```typescript
enum MessageType {
  task_handoff     // Delegate a task to another agent
  status_update    // Inform about progress/completion
  data_request     // Ask for information
  data_response    // Reply to a data request
  escalation       // Escalate to human or higher authority
}
```

**API Endpoints:**
```
POST /api/messaging/send
{
  "senderId": "agent-123",
  "recipientId": "agent-456",
  "type": "task_handoff",
  "payload": {
    "taskId": "task-789",
    "description": "Review PR #123",
    "priority": "high",
    "dueDate": "2026-02-15"
  },
  "correlationId": "conv-001"  // Optional, for threading
}

Response:
{
  "messageId": "msg-abc",
  "status": "delivered",
  "deliveredAt": "2026-02-13T10:30:00Z"
}

GET /api/messaging/inbox/:agentId
{
  "messages": [...],
  "pagination": { "total": 50, "page": 1, "limit": 20 }
}

GET /api/messaging/conversation/:correlationId
{
  "messages": [...],  // All messages in thread
  "participants": ["agent-123", "agent-456"]
}
```

**Allowlist Enforcement:**
```typescript
// Before sending, check allowlist
async canSendMessage(senderId: string, recipientId: string): Promise<boolean> {
  const allowlist = await this.prisma.agentAllowlist.findFirst({
    where: {
      agentId: senderId,
      allowedAgentId: recipientId
    }
  });
  return !!allowlist;
}
```

**Acceptance Criteria:**
- [ ] POST /api/messaging/send with validation
- [ ] GET /api/messaging/inbox/:agentId with pagination
- [ ] GET /api/messaging/conversation/:correlationId
- [ ] Allowlist enforcement (403 if not allowed)
- [ ] Message schema validation per type
- [ ] Correlation ID for threading
- [ ] Delivery status tracking (pending → delivered/failed/blocked)
- [ ] Audit logging for all messages
- [ ] 40+ unit tests

**Files to Create/Modify:**
- `backend/src/messaging/messaging.module.ts`
- `backend/src/messaging/messaging.controller.ts`
- `backend/src/messaging/messaging.service.ts`
- `backend/src/messaging/dto/send-message.dto.ts`
- `backend/src/messaging/validators/message-payload.validator.ts`
- `backend/test/messaging/messaging.service.spec.ts`

---

### S6-02: WebSocket Real-Time Message Feed (5 pts)
**Scope:** Backend
**Dependencies:** S6-05

**Task:**
Add WebSocket endpoint for real-time message streaming.

**WebSocket Gateway:**
```typescript
// backend/src/messaging/messaging.gateway.ts
@WebSocketGateway({
  namespace: '/ws/messages',
  cors: { origin: '*' }
})
export class MessagingGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  // Client subscribes to agent's inbox
  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, payload: { agentId: string }) {
    // Verify JWT and tenant access
    // Join room: `agent:${agentId}`
  }

  // Broadcast new message to recipient's room
  async notifyNewMessage(message: AgentMessage) {
    this.server.to(`agent:${message.recipientId}`).emit('message', message);
  }
}
```

**Client Usage:**
```typescript
const socket = io('/ws/messages', {
  auth: { token: 'jwt-token' }
});

socket.emit('subscribe', { agentId: 'agent-123' });

socket.on('message', (message) => {
  console.log('New message:', message);
});
```

**Acceptance Criteria:**
- [ ] Create WebSocket gateway at /ws/messages
- [ ] JWT authentication on connection
- [ ] Subscribe to agent inbox by agentId
- [ ] Tenant isolation (can only subscribe to own agents)
- [ ] Broadcast new messages to subscribed clients
- [ ] Handle disconnection gracefully
- [ ] Write integration tests

**Files to Create:**
- `backend/src/messaging/messaging.gateway.ts`
- `backend/test/messaging/messaging.gateway.spec.ts`

---

### S6-04: Audit Log Viewer UI (8 pts)
**Scope:** Full-stack
**Dependencies:** S5-05 (from Sprint 5)

**Task:**
Build audit log viewer for both platform admin and tenant admin dashboards.

**UI Requirements:**
- Table view with columns: Timestamp, Actor, Action, Resource, Status
- Filter by: Date range, Action type, Actor, Resource type
- Expandable rows to show full details JSON
- Export to CSV/JSON button
- Pagination (50 per page)

**API Endpoint (from Sprint 5):**
```
GET /api/audit/logs?tenantId=xxx&action=agent.create&from=2026-02-01&limit=50

Response:
{
  "logs": [
    {
      "id": "log-1",
      "timestamp": "2026-02-13T10:30:00Z",
      "actor": { "id": "user-1", "type": "tenant_admin", "name": "John Doe" },
      "action": "agent.create",
      "resource": { "type": "agent", "id": "agent-123", "name": "PM Agent" },
      "status": "success",
      "details": { ... }
    }
  ],
  "pagination": { "total": 150, "page": 1, "limit": 50 }
}
```

**Components:**
```
AuditLogViewer
├── AuditLogFilters (date picker, dropdowns)
├── AuditLogTable
│   └── AuditLogRow (expandable)
├── AuditLogPagination
└── AuditLogExport (button)
```

**Acceptance Criteria:**
- [ ] Create AuditLogViewer component
- [ ] Implement filters (date range, action, actor, resource)
- [ ] Expandable rows show full details
- [ ] Export to CSV and JSON
- [ ] Platform admin sees all logs
- [ ] Tenant admin sees only their tenant's logs
- [ ] Loading states and error handling
- [ ] Responsive design

**Files to Create:**
- `frontend/src/components/audit/audit-log-viewer.tsx`
- `frontend/src/components/audit/audit-log-filters.tsx`
- `frontend/src/components/audit/audit-log-table.tsx`
- `frontend/src/lib/api/audit.ts`
- `frontend/src/lib/hooks/use-audit-logs.ts`

**Also add to dashboards:**
- `frontend/src/app/admin/audit/page.tsx`
- `frontend/src/app/dashboard/audit/page.tsx`

---

### E12-10: Billing Dashboard UI (8 pts)
**Scope:** Frontend
**Dependencies:** E12-08, E12-09 (from Sprint 5)

**Task:**
Build comprehensive billing dashboard for tenant admins.

**UI Sections (from pricing-model.md §5.3):**
```
Billing Overview
├── Plan Card (Growth - $299/mo)
├── Agent Costs
│   ├── Included agents: 5 Sonnet (no extra charge)
│   └── Additional agents: 2 Opus x $99 = $198/mo
├── Surcharges
│   └── Thinking mode: 1 agent x High = $20/mo
├── Overage (if opted in)
│   └── Current month: $12.40
├── Total: $529.40/mo
└── Next billing: March 1, 2026

Usage Dashboard
├── Token Usage Chart (daily breakdown)
├── Per-Agent Usage Table
│   ├── Agent name
│   ├── Model tier
│   ├── Tokens used / quota
│   ├── Status (normal/warning/limited)
│   └── Estimated cost
└── Export usage report
```

**Components:**
```
BillingDashboard
├── BillingOverviewCard
├── AgentCostsTable
├── UsageChart (recharts or similar)
├── AgentUsageTable
├── OverageToggle (for Growth+)
└── ExportUsageButton
```

**Acceptance Criteria:**
- [ ] Billing overview with cost breakdown
- [ ] Token usage chart (line chart, daily data)
- [ ] Per-agent usage table with status indicators
- [ ] Overage toggle for Growth/Enterprise plans
- [ ] Export usage report as CSV
- [ ] Warning badges at 80%+ usage
- [ ] Responsive design
- [ ] Loading and error states

**Files to Create:**
- `frontend/src/app/dashboard/billing/page.tsx`
- `frontend/src/components/billing/billing-overview-card.tsx`
- `frontend/src/components/billing/agent-costs-table.tsx`
- `frontend/src/components/billing/usage-chart.tsx`
- `frontend/src/components/billing/agent-usage-table.tsx`
- `frontend/src/lib/api/billing.ts`
- `frontend/src/lib/hooks/use-billing.ts`

---

### S6-03: Security Event Alerting (5 pts)
**Scope:** Backend
**Dependencies:** S5-05 (from Sprint 5)

**Task:**
Implement security alert rules and notification delivery.

**Alert Rules:**
| Rule | Trigger | Severity |
|------|---------|----------|
| Failed logins | 5+ in 5 minutes | warning |
| Cross-tenant access | Any attempt | critical |
| Tool policy violation | Any blocked tool | warning |
| Agent paused (150% usage) | Automatic | info |
| Suspicious IP | New IP from new location | warning |

**Service:**
```typescript
// backend/src/alerts/security-alert.service.ts
@Injectable()
export class SecurityAlertService {
  async checkFailedLogins(userId: string): Promise<void>;
  async checkCrossTenantAccess(actorId: string, targetTenantId: string): Promise<void>;
  async checkToolPolicyViolation(agentId: string, toolName: string): Promise<void>;

  async createAlert(data: {
    type: AlertType;
    severity: 'info' | 'warning' | 'critical';
    tenantId?: string;
    actorId?: string;
    details: Record<string, any>;
  }): Promise<Alert>;

  async sendAlertNotification(alert: Alert): Promise<void>;
}
```

**Notification Channels:**
- Email to tenant admin
- Webhook (configurable URL)
- In-app notification (for dashboard)

**Database Model:**
```prisma
model Alert {
  id         String      @id @default(uuid())
  type       AlertType
  severity   AlertSeverity
  tenantId   String?
  tenant     Tenant?     @relation(fields: [tenantId], references: [id])
  actorId    String?
  details    Json
  resolved   Boolean     @default(false)
  resolvedAt DateTime?
  resolvedBy String?
  createdAt  DateTime    @default(now())

  @@index([tenantId, createdAt])
  @@index([type])
  @@index([resolved])
  @@map("alerts")
}

enum AlertType {
  failed_login_threshold
  cross_tenant_access
  tool_policy_violation
  usage_threshold
  suspicious_activity
}

enum AlertSeverity {
  info
  warning
  critical
}
```

**Acceptance Criteria:**
- [ ] Create Alert model in schema
- [ ] Create SecurityAlertService
- [ ] Implement failed login detection (5 in 5 min)
- [ ] Implement tool policy violation detection
- [ ] Send email notifications for critical alerts
- [ ] Support webhook notifications
- [ ] Alert history endpoint: GET /api/alerts
- [ ] Resolve alert endpoint: PUT /api/alerts/:id/resolve
- [ ] Write unit tests

**Files to Create:**
- `backend/src/alerts/alerts.module.ts`
- `backend/src/alerts/security-alert.service.ts`
- `backend/src/alerts/alerts.controller.ts`
- `backend/test/alerts/security-alert.service.spec.ts`

---

### S6-01: Audit Log Retention Job (3 pts)
**Scope:** Backend
**Dependencies:** S5-05

**Task:**
Create scheduled job to archive old audit logs.

**Retention Policy:**
- Hot storage (PostgreSQL): 90 days
- Cold storage (S3 or file): 1 year
- Delete after 1 year

**Job:**
```typescript
// backend/src/audit/audit-retention.processor.ts
@Processor('audit-retention')
export class AuditRetentionProcessor extends WorkerHost {
  @Cron('0 2 * * *')  // Daily at 2 AM
  async handleRetention() {
    const cutoffDate = subDays(new Date(), 90);

    // Archive logs older than 90 days
    const logsToArchive = await this.prisma.auditLog.findMany({
      where: { createdAt: { lt: cutoffDate } },
      take: 1000
    });

    await this.archiveToS3(logsToArchive);

    await this.prisma.auditLog.deleteMany({
      where: { id: { in: logsToArchive.map(l => l.id) } }
    });
  }
}
```

**Acceptance Criteria:**
- [ ] Create retention processor with daily cron
- [ ] Archive logs to S3 (or local file for dev)
- [ ] Delete archived logs from PostgreSQL
- [ ] Process in batches (1000 at a time)
- [ ] Log retention stats (archived count, errors)
- [ ] Write unit tests

**Files to Create:**
- `backend/src/audit/audit-retention.processor.ts`
- `backend/test/audit/audit-retention.processor.spec.ts`

---

## Dependencies Diagram

```
S6-05 (Messaging API) ──────> S6-02 (WebSocket Feed)
         │
         └──────────────────> (audit logging integrated)

S6-04 (Audit Log UI) ────────> (depends on S5-05 from Sprint 5)

E12-10 (Billing UI) ─────────> (depends on E12-08, E12-09 from Sprint 5)

S6-03 (Security Alerts) ─────> (depends on S5-05 from Sprint 5)

S6-01 (Retention Job) ───────> (depends on S5-05 from Sprint 5)
```

---

## Sprint Exit Criteria

Before marking Sprint 6 complete, verify:

- [ ] Agents can send messages to allowed peers
- [ ] Messages blocked when not in allowlist (403)
- [ ] WebSocket feed delivers messages in real-time
- [ ] Audit log viewer works in both dashboards
- [ ] Billing dashboard shows accurate cost breakdown
- [ ] Token usage chart displays daily data
- [ ] Security alerts trigger on failed logins
- [ ] Audit retention job runs daily
- [ ] All new code has unit tests
- [ ] No TypeScript errors
- [ ] All existing tests still pass

---

## Technical Notes

### WebSocket Authentication
```typescript
// Verify JWT in handshake
@WebSocketGateway()
export class MessagingGateway {
  handleConnection(client: Socket) {
    const token = client.handshake.auth.token;
    const payload = this.jwtService.verify(token);
    client.data.userId = payload.sub;
    client.data.tenantId = payload.tenantId;
  }
}
```

### Message Payload Schemas
```typescript
// task_handoff payload
interface TaskHandoffPayload {
  taskId: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  context?: Record<string, any>;
}

// data_request payload
interface DataRequestPayload {
  query: string;
  dataSource?: string;
  format?: 'json' | 'text' | 'table';
}
```

### Chart Library
```bash
npm install recharts
```

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

<LineChart data={dailyUsage}>
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="tokens" stroke="#6366f1" />
</LineChart>
```
