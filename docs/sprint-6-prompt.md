# Sprint 6: Messaging, Audit UI & Channel Foundation — Implementation Prompt

**Sprint**: S6 (Phase 2, second sprint)
**Points**: 34
**Scope**: Backend + Full-Stack (4 features)
**Branch**: Create `sprint-6` from `main`
**Duration**: 2 weeks

---

## Goal

Deliver the **core differentiator**: structured inter-agent messaging API with allowlist enforcement, real-time WebSocket message feed, audit log viewer UI, and channel integration data model. This sprint turns the Aegis platform from a single-agent management tool into a **multi-agent coordination platform**.

---

## Prerequisites

- Sprint 5 COMPLETE: AuditModule, AuditService, AuditInterceptor, AuditProcessor all operational
- Prisma schema already has: `AgentMessage`, `AgentAllowlist` models + `MessageType`, `MessageStatus`, `AllowlistDirection` enums (created in S5-Story 4, lines 131-149 and 716-749 of `schema.prisma`)
- BullMQ globally configured in `app.module.ts`
- WebSocket patterns exist in `backend/src/` (health monitoring)
- Read `docs/api-contract.md` Section 9 (Tenant: Audit) and Section 11 (WebSocket Events) for existing shapes
- Read `docs/phase-2-sprint-plan.yaml` for full acceptance criteria per feature

---

## Stories (6 stories, implement sequentially unless noted)

### Story 1: E7-F1a — Messaging Module & Allowlist Service (8 pts)

**Branch**: `sprint-6/1-messaging-module`
**Depends on**: S5 complete

Create the MessagingModule with services for allowlist management and message sending/querying. This is the core backend for inter-agent communication.

#### Files to Create

```
backend/src/messaging/
├── messaging.module.ts              # NestJS module (imports BullModule, exports services)
├── messaging.service.ts             # Core: sendMessage(), getMessages(), getMessagesByTenant()
├── messaging.processor.ts           # BullMQ processor: delivers messages, updates status
├── messaging.constants.ts           # Queue name, payload max size, message type schemas
├── allowlist.service.ts             # CRUD for AgentAllowlist + enforcement checks
├── dto/
│   ├── send-message.dto.ts          # DTO for POST /agents/:id/messages
│   ├── query-messages.dto.ts        # DTO for GET message history (filters + pagination)
│   └── manage-allowlist.dto.ts      # DTO for PUT /agents/:id/allowlist
└── interfaces/
    └── message-event.interface.ts   # TypeScript interface for BullMQ job payload
```

#### MessagingModule (`messaging.module.ts`)

```typescript
// Pattern: follow audit.module.ts
// - Import BullModule.registerQueue({ name: 'agent-messages' })
// - Provide: MessagingService, MessagingProcessor, AllowlistService
// - Export: MessagingService, AllowlistService
// - Import AuditModule (already @Global, but declare dependency)
```

#### AllowlistService (`allowlist.service.ts`)

```typescript
// Core methods:

async getAgentAllowlist(agentId: string, tenantId: string): Promise<AgentAllowlist[]>
// - Returns all allowlist entries for an agent
// - Verify agent belongs to tenant (security check)

async updateAllowlist(agentId: string, entries: ManageAllowlistDto, tenantId: string): Promise<AgentAllowlist[]>
// - Upsert allowlist entries (add/remove allowed agents)
// - Validate all referenced agents belong to same tenant
// - Audit log: 'allowlist_updated' with before/after diff

async canSendMessage(senderId: string, recipientId: string): Promise<boolean>
// - Check if sender has an allowlist entry for recipient
// - Direction must be 'both' or 'send_only' for sender
// - Direction must be 'both' or 'receive_only' for recipient (check reverse entry)
// - Cache result in Redis with 60s TTL for performance

async getCommunicationGraph(tenantId: string): Promise<{ nodes: Agent[]; edges: AllowlistEdge[] }>
// - Returns all agents as nodes and allowlist entries as edges
// - Used by GET /api/dashboard/communication-graph
```

#### MessagingService (`messaging.service.ts`)

```typescript
// Core methods:

async sendMessage(senderId: string, dto: SendMessageDto, tenantId: string): Promise<AgentMessage>
// 1. Validate sender agent exists and belongs to tenant
// 2. Validate recipient agent exists and belongs to tenant
// 3. Check allowlist: await allowlistService.canSendMessage(senderId, recipientId)
//    - If blocked: throw ForbiddenException with reason 'Agent not in allowlist'
// 4. Validate payload size (max 64KB)
// 5. Validate payload against JSON schema for message type (if schema exists)
// 6. Create AgentMessage record with status 'pending'
// 7. Enqueue to BullMQ 'agent-messages' queue for async delivery
// 8. Audit log: 'message_sent' with senderId, recipientId, type
// 9. Return created message

async getAgentMessages(agentId: string, query: QueryMessagesDto, tenantId: string): Promise<{ data: AgentMessage[]; meta: PaginationMeta }>
// - Verify agent belongs to tenant
// - Return messages where agent is sender OR recipient
// - Filters: type, status, correlationId, dateFrom, dateTo
// - Cursor-based pagination (same pattern as AuditService.queryLogs)
// - Order: createdAt DESC

async getTenantMessages(tenantId: string, query: QueryMessagesDto): Promise<{ data: AgentMessage[]; meta: PaginationMeta }>
// - Return ALL messages for agents within the tenant
// - Same filters and pagination as above
// - Join with Agent to get sender/recipient names

async getMessageById(messageId: string, tenantId: string): Promise<AgentMessage>
// - Verify message belongs to an agent in the tenant
```

#### MessagingProcessor (`messaging.processor.ts`)

```typescript
// BullMQ Processor for 'agent-messages' queue
// Pattern: follow audit.processor.ts

@Processor('agent-messages')
export class MessagingProcessor extends WorkerHost {
  async process(job: Job<MessageEventPayload>): Promise<void> {
    // 1. Load the AgentMessage by ID
    // 2. Update status to 'delivered', set deliveredAt timestamp
    // 3. Emit WebSocket event (if WebSocket gateway is available)
    //    - Event: 'message_delivered' with messageId, senderId, recipientId
    // 4. Handle errors: set status to 'failed', log error
  }
}
```

#### SendMessageDto (`dto/send-message.dto.ts`)

```typescript
export class SendMessageDto {
  recipientId: string;              // UUID of recipient agent
  type: MessageType;                // task_handoff | status_update | data_request | etc.
  payload: Record<string, unknown>; // Message content (max 64KB)
  correlationId?: string;           // Optional: links request-response pairs
}
```

#### API Endpoints (add to existing agents controller or create messaging controller)

```
POST   /api/dashboard/agents/:id/messages      → sendMessage()
GET    /api/dashboard/agents/:id/messages      → getAgentMessages()
GET    /api/dashboard/messages                  → getTenantMessages()
PUT    /api/dashboard/agents/:id/allowlist      → updateAllowlist()
GET    /api/dashboard/communication-graph       → getCommunicationGraph()
```

#### Acceptance Criteria

- [ ] MessagingModule registered in AppModule
- [ ] POST endpoint validates allowlist before sending
- [ ] Blocked messages return 403 with clear reason
- [ ] Messages enqueued to BullMQ for async delivery
- [ ] Processor updates message status to 'delivered' or 'failed'
- [ ] Allowlist CRUD with tenant scoping (agents must belong to same tenant)
- [ ] Allowlist direction enforcement (send_only, receive_only, both)
- [ ] Redis-cached allowlist lookups (60s TTL)
- [ ] Payload max size: 64KB enforced
- [ ] All operations audited via AuditService
- [ ] Cursor-based pagination for message queries

---

### Story 2: E7-F5 — WebSocket Real-Time Message Feed (5 pts)

**Branch**: `sprint-6/2-websocket-messages`
**Depends on**: Story 1

Add a WebSocket gateway for real-time inter-agent message streaming, tenant-scoped.

#### Files to Create

```
backend/src/messaging/
├── messaging.gateway.ts            # NestJS WebSocket gateway (/ws/messages)
└── interfaces/
    └── ws-message-event.interface.ts  # WebSocket event payload types
```

#### MessagingGateway (`messaging.gateway.ts`)

```typescript
// Pattern: reference existing WebSocket patterns in the codebase

@WebSocketGateway({ path: '/ws/messages', cors: true })
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {

  // JWT authentication on handshake
  async handleConnection(client: Socket): Promise<void> {
    // 1. Extract token from query params: client.handshake.query.token
    // 2. Verify JWT, extract tenantId
    // 3. Join client to tenant-scoped room: `tenant:${tenantId}:messages`
    // 4. On failure: disconnect with error
  }

  handleDisconnect(client: Socket): void {
    // Clean up room membership
  }

  // Called by MessagingProcessor after message delivery
  emitMessageEvent(tenantId: string, event: WsMessageEvent): void {
    // Emit to tenant room: 'message_sent', 'message_delivered', 'message_failed'
    this.server.to(`tenant:${tenantId}:messages`).emit(event.type, event.data);
  }

  // Reconnection catch-up: client sends 'catch-up' with lastTimestamp
  @SubscribeMessage('catch-up')
  async handleCatchUp(client: Socket, data: { since: string }): Promise<void> {
    // Query messages since `data.since` (max 5 minutes back)
    // Emit missed messages to client
  }
}
```

#### WebSocket Events

```typescript
// Events emitted:
interface WsMessageEvent {
  type: 'message_sent' | 'message_delivered' | 'message_failed';
  data: {
    messageId: string;
    senderId: string;
    senderName: string;
    recipientId: string;
    recipientName: string;
    type: MessageType;
    timestamp: string;
    // payload NOT included in WS event (too large; client fetches via REST if needed)
  };
}
```

#### Integration with MessagingProcessor

Update `messaging.processor.ts` to emit WebSocket events after message delivery:

```typescript
// After status update to 'delivered':
this.messagingGateway.emitMessageEvent(tenantId, {
  type: 'message_delivered',
  data: { messageId, senderId, recipientId, ... }
});
```

#### Acceptance Criteria

- [ ] WebSocket gateway at `/ws/messages`
- [ ] JWT authentication on handshake (reject unauthenticated)
- [ ] Tenant-scoped rooms (tenant A cannot see tenant B messages)
- [ ] Events: `message_sent`, `message_delivered`, `message_failed`
- [ ] Reconnection catch-up: last 5 minutes of missed messages
- [ ] Gateway integrated with MessagingProcessor
- [ ] Events include metadata only (no payload — client fetches via REST)

---

### Story 3: E8-F3a — Audit Log Query API (5 pts)

**Branch**: `sprint-6/3-audit-query-api`
**Depends on**: S5 (AuditService.queryLogs already exists)

Extend the existing audit infrastructure with dedicated controller endpoints for tenant and admin dashboards, plus CSV/JSON export.

#### Files to Create/Modify

```
backend/src/audit/
├── audit.controller.ts             # NEW: Tenant dashboard audit endpoints
├── audit-admin.controller.ts       # NEW: Platform admin audit endpoints
└── dto/
    └── export-audit-log.dto.ts     # NEW: DTO for export filters + format
```

#### AuditController (`audit.controller.ts`) — Tenant Dashboard

```typescript
@Controller('api/dashboard/audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  async getAuditLogs(
    @Query() query: QueryAuditLogDto,
    @Req() req: Request,  // extract tenantId from JWT
  ): Promise<{ data: AuditLog[]; meta: PaginationMeta }> {
    // Force tenantId filter from JWT (tenant can only see own logs)
    return this.auditService.queryLogs({ ...query, tenantId: req.user.tenantId });
  }

  @Get('export')
  async exportAuditLogs(
    @Query() query: ExportAuditLogDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Force tenantId from JWT
    // Stream response: CSV (text/csv) or JSON (application/json)
    // Max 10,000 rows
    // Set Content-Disposition header: attachment; filename="audit-log-{date}.{format}"
  }
}
```

#### AuditAdminController (`audit-admin.controller.ts`) — Platform Admin

```typescript
@Controller('api/admin/audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditAdminController {
  constructor(private auditService: AuditService) {}

  @Get()
  async getAuditLogs(
    @Query() query: QueryAuditLogDto,
    @Req() req: Request,
  ): Promise<{ data: AuditLog[]; meta: PaginationMeta }> {
    assertPlatformAdmin(req.user);
    // No tenantId filter forced — admin sees all tenants
    // Optional tenantId filter from query params
    return this.auditService.queryLogs(query);
  }

  @Get('export')
  async exportAuditLogs(
    @Query() query: ExportAuditLogDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    assertPlatformAdmin(req.user);
    // Same streaming export, but cross-tenant
  }
}
```

#### QueryAuditLogDto Enhancement

The existing `QueryAuditLogDto` already has most fields. Add:

```typescript
// Add to existing dto/query-audit-log.dto.ts:
search?: string;  // Full-text search on action and actorName
```

#### ExportAuditLogDto

```typescript
export class ExportAuditLogDto extends QueryAuditLogDto {
  format: 'csv' | 'json';  // Required: export format
}
```

#### Acceptance Criteria

- [ ] `GET /api/dashboard/audit` returns tenant-scoped paginated audit logs
- [ ] `GET /api/admin/audit-logs` returns cross-tenant logs (admin only)
- [ ] `GET /api/dashboard/audit/export` streams CSV or JSON export
- [ ] `GET /api/admin/audit-logs/export` same for admin (cross-tenant)
- [ ] Tenant endpoint forces tenantId from JWT (cannot see other tenants)
- [ ] Full-text search on action and actorName fields
- [ ] Export limited to 10,000 rows
- [ ] Export uses streaming response (not in-memory buffer)
- [ ] All existing audit filters work: agentId, action, targetType, severity, dateFrom, dateTo

---

### Story 4: E8-F3b — Audit Log Viewer UI (3 pts)

**Branch**: `sprint-6/4-audit-viewer-ui`
**Depends on**: Story 3

Build the audit log viewer components for the tenant dashboard frontend.

#### Frontend Files to Create

```
frontend/src/pages/dashboard/audit/
├── AuditLogPage.tsx                # Main audit log page
├── AuditLogTable.tsx               # Table component with sortable columns
├── AuditLogFilters.tsx             # Filter sidebar (agent, action, severity, date range)
├── AuditLogDetail.tsx              # Expandable detail view with JSON viewer
└── AuditLogExport.tsx              # Export dialog (format selection)

frontend/src/hooks/
└── useAuditLogs.ts                 # React Query hook for audit log API
```

#### AuditLogPage Layout

```
┌─────────────────────────────────────────────────────────┐
│ Audit Log                                    [Export ▼] │
├──────────┬──────────────────────────────────────────────┤
│ Filters  │ Table                                        │
│          │ ┌──────┬────────┬────────┬────────┬────────┐ │
│ Agent ▼  │ │ Time │ Actor  │ Action │ Target │ Sev.   │ │
│ Action ▼ │ ├──────┼────────┼────────┼────────┼────────┤ │
│ Severity │ │ ...  │ ...    │ ...    │ ...    │ info   │ │
│ Date     │ │ ...  │ ...    │ ...    │ ...    │ warn   │ │
│ [From]   │ │ ...  │ ...    │ ...    │ ...    │ error  │ │
│ [To]     │ └──────┴────────┴────────┴────────┴────────┘ │
│          │                               < 1 2 3 ... >  │
│ [Clear]  │                                              │
└──────────┴──────────────────────────────────────────────┘
```

#### Key UI Behaviors

- Click a row to expand detail view (JSON viewer for `details` field)
- Severity badges: info (blue), warning (amber), error (red)
- Date range picker for dateFrom/dateTo
- Agent dropdown populated from tenant's agents
- Action dropdown: auto-populated from distinct actions in data
- Export button opens modal with CSV/JSON format selection
- Cursor-based pagination (load more pattern, not page numbers)
- Real-time indication: "Last updated X seconds ago" (auto-refresh every 30s)

#### Acceptance Criteria

- [ ] Audit log table with sortable columns
- [ ] Filter sidebar: agent, action type, severity, date range
- [ ] Expandable row detail with JSON viewer for details field
- [ ] Export dialog with CSV/JSON format selection
- [ ] Cursor-based pagination (load more button)
- [ ] Severity color coding (blue/amber/red)
- [ ] Uses real API hooks (no hardcoded mock data)
- [ ] Responsive layout

---

### Story 5: E11-F1 — Channel Data Model & Plugin Skeleton (8 pts)

**Branch**: `sprint-6/5-channel-foundation`
**Depends on**: S5 complete (can run in parallel with Stories 1-4)

Create the Prisma models for channel connections and routing, the ChannelModule with CRUD services, and the aegis OpenClaw plugin skeleton.

#### Prisma Schema Additions (`backend/prisma/schema.prisma`)

```prisma
// ============================================================================
// CHANNEL INTEGRATION (Sprint 6 — E11)
// ============================================================================

enum ChannelPlatform {
  SLACK
  TEAMS
  DISCORD
  GOOGLE_CHAT
  @@map("channel_platform")
}

enum ConnectionStatus {
  pending
  active
  disconnected
  error
  @@map("connection_status")
}

enum RouteType {
  slash_command     // /ask-pm → specific agent
  channel_mapping   // #engineering → engineering agent
  user_mapping      // @john → PM agent
  tenant_default    // fallback → hub agent
  @@map("route_type")
}

model ChannelConnection {
  id              String           @id @default(uuid())
  tenantId        String
  tenant          Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  platform        ChannelPlatform
  workspaceId     String           // Platform workspace ID (e.g., Slack team ID)
  workspaceName   String           // Human-readable name
  credentials     Json             // Encrypted OAuth tokens (JSONB)
  status          ConnectionStatus @default(pending)
  connectedAt     DateTime?
  lastHealthCheck DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  routingRules    ChannelRouting[]

  @@unique([tenantId, platform, workspaceId])
  @@index([tenantId])
  @@index([platform])
  @@map("channel_connections")
}

model ChannelRouting {
  id              String           @id @default(uuid())
  connectionId    String
  connection      ChannelConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  routeType       RouteType
  sourceIdentifier String          // e.g., "/ask-pm", "#engineering", "@john"
  agentId         String
  agent           Agent            @relation(fields: [agentId], references: [id], onDelete: Cascade)
  priority        Int              @default(0) // Lower = higher priority
  isActive        Boolean          @default(true)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@unique([connectionId, routeType, sourceIdentifier])
  @@index([connectionId])
  @@index([agentId])
  @@map("channel_routing")
}
```

Also add reverse relations to existing models:

```prisma
// Add to Tenant model:
channelConnections ChannelConnection[]

// Add to Agent model:
channelRouting     ChannelRouting[]
```

#### Backend Files to Create

```
backend/src/channels/
├── channels.module.ts              # NestJS module
├── channel-connection.service.ts   # CRUD for ChannelConnection
├── channel-routing.service.ts      # CRUD for ChannelRouting + resolution logic
├── channels.controller.ts          # REST endpoints for tenant dashboard
├── dto/
│   ├── create-connection.dto.ts    # DTO for creating channel connection
│   ├── update-connection.dto.ts    # DTO for updating connection
│   ├── create-routing.dto.ts       # DTO for creating routing rule
│   └── update-routing.dto.ts       # DTO for updating routing rule
└── interfaces/
    └── channel.interface.ts        # TypeScript interfaces for channel types
```

#### API Endpoints

Per `docs/phase-2-sprint-plan.yaml` API contract additions:

```
GET    /api/v1/tenant/channels                    → list connections
POST   /api/v1/tenant/channels                    → create connection
GET    /api/v1/tenant/channels/:id                → get connection
PATCH  /api/v1/tenant/channels/:id                → update connection
DELETE /api/v1/tenant/channels/:id                → delete connection
GET    /api/v1/tenant/channels/:id/routing        → list routing rules
POST   /api/v1/tenant/channels/:id/routing        → create routing rule
PATCH  /api/v1/tenant/channels/:id/routing/:ruleId → update routing rule
DELETE /api/v1/tenant/channels/:id/routing/:ruleId → delete routing rule
```

#### ChannelRoutingService — Resolution Logic

```typescript
// Priority-based agent resolution (used by proxy in S7):
async resolveAgent(
  tenantId: string,
  platform: ChannelPlatform,
  context: { slashCommand?: string; channelId?: string; userId?: string },
): Promise<Agent | null> {
  // Resolution order (highest to lowest priority):
  // 1. Slash command mapping (/ask-pm → PM agent)
  // 2. Channel mapping (#engineering → Engineering agent)
  // 3. User mapping (@john → PM agent)
  // 4. Tenant default (fallback → hub agent)
  // Return first match, or null if no route
}
```

#### OpenClaw Plugin Skeleton

```
packages/openclaw-channel-plugin/     # OR backend/src/channels/plugin/
├── package.json                      # @aegis/openclaw-channel-plugin
├── tsconfig.json
├── src/
│   ├── index.ts                      # Plugin entry: register hooks
│   ├── inbound.ts                    # Webhook listener at /hooks/aegis
│   ├── outbound.ts                   # HTTP POST to Aegis proxy
│   └── types.ts                      # Shared types (metadata, message format)
└── README.md                         # Plugin usage guide
```

The plugin is a TypeScript npm package that OpenClaw containers load:

```typescript
// inbound.ts — receives messages from users via platform webhook
// OpenClaw calls this when a message arrives via the registered channel
export async function handleInbound(message: InboundMessage): Promise<void> {
  // Forward to OpenClaw's standard message processing
  // The proxy will have already routed to the correct container
}

// outbound.ts — sends messages from agents to the Aegis proxy
export async function sendOutbound(payload: OutboundPayload): Promise<void> {
  // HTTP POST to AEGIS_PROXY_URL/api/v1/channel/outbound
  // Bearer token: AEGIS_CONTAINER_TOKEN (per-tenant)
  // Metadata: agentId, sessionKey, targetType (reply|proactive), messageType
  // Retry with exponential backoff (3 attempts)
}
```

#### Acceptance Criteria

- [ ] ChannelConnection + ChannelRouting Prisma models with migration
- [ ] Enums: ChannelPlatform, ConnectionStatus, RouteType
- [ ] Reverse relations on Tenant and Agent models
- [ ] ChannelModule with connection/routing CRUD services
- [ ] REST endpoints for connections and routing rules (tenant-scoped)
- [ ] Priority-based agent resolution logic in ChannelRoutingService
- [ ] All mutations audited via AuditService
- [ ] Plugin skeleton: package.json, inbound handler, outbound handler
- [ ] Plugin carries metadata: agentId, sessionKey, targetType, messageType
- [ ] Plugin auth: Bearer token per tenant container
- [ ] All existing tests pass (no regressions)

---

### Story 6: Testing (5 pts)

**Branch**: `sprint-6/6-testing`
**Depends on**: Stories 1-5

Comprehensive unit and integration tests for all Sprint 6 features.

#### Test Files to Create

```
backend/test/messaging/
├── messaging.service.spec.ts        # Unit tests for MessagingService
├── allowlist.service.spec.ts        # Unit tests for AllowlistService
├── messaging.processor.spec.ts      # Unit tests for MessagingProcessor
├── messaging.gateway.spec.ts        # Unit tests for WebSocket gateway
└── messaging.integration.spec.ts    # Integration tests (send → deliver → WS)

backend/test/audit/
├── audit.controller.spec.ts         # Unit tests for AuditController
└── audit-admin.controller.spec.ts   # Unit tests for AuditAdminController

backend/test/channels/
├── channel-connection.service.spec.ts  # Unit tests for connection CRUD
├── channel-routing.service.spec.ts     # Unit tests for routing CRUD + resolution
└── channels.integration.spec.ts        # Integration tests for channel endpoints
```

#### Test Coverage Requirements

**MessagingService tests** (~15 tests):
- `sendMessage()` validates allowlist before sending
- `sendMessage()` rejects blocked agents with 403
- `sendMessage()` enqueues to BullMQ on success
- `sendMessage()` enforces payload max size (64KB)
- `sendMessage()` validates sender/recipient belong to same tenant
- `sendMessage()` creates AgentMessage with status 'pending'
- `sendMessage()` logs audit event
- `getAgentMessages()` returns paginated results
- `getAgentMessages()` filters by type, status, correlationId
- `getTenantMessages()` returns all tenant messages
- `getMessageById()` validates tenant ownership

**AllowlistService tests** (~12 tests):
- `updateAllowlist()` adds new entries
- `updateAllowlist()` removes entries
- `updateAllowlist()` validates agents belong to same tenant
- `updateAllowlist()` logs audit event with before/after diff
- `canSendMessage()` returns true when allowed (direction: both)
- `canSendMessage()` returns true for send_only direction
- `canSendMessage()` returns false when not in allowlist
- `canSendMessage()` returns false for wrong direction (receive_only vs send attempt)
- `getCommunicationGraph()` returns correct nodes and edges
- Redis cache hit/miss behavior

**MessagingProcessor tests** (~6 tests):
- Updates message status to 'delivered'
- Sets deliveredAt timestamp
- Handles delivery failure (status: 'failed')
- Emits WebSocket event on delivery
- Logs error on failure

**MessagingGateway tests** (~8 tests):
- Authenticates on handshake with JWT
- Rejects invalid token
- Joins tenant-scoped room
- Emits events only to correct tenant room
- Handles catch-up with missed messages (last 5 min)
- Handles disconnect cleanly

**AuditController tests** (~8 tests):
- Tenant endpoint forces tenantId from JWT
- Admin endpoint requires platform admin role
- Export returns CSV with correct Content-Type
- Export returns JSON with correct Content-Type
- Export respects 10,000 row limit
- Filters pass through correctly

**ChannelConnection/Routing tests** (~12 tests):
- CRUD operations for connections
- CRUD operations for routing rules
- Tenant scoping enforced
- Priority-based agent resolution (slash cmd > channel > user > default)
- Resolution returns null when no route matches
- All mutations audit logged

**Target: 60+ tests total**

#### Test Patterns

Follow existing patterns from `backend/test/`:
- Use `PrismaService` mock for unit tests
- Use `Test.createTestingModule()` for all test modules
- Mock BullMQ queue's `add()` method
- Mock Redis for allowlist cache tests
- Use existing test helpers for mock users and tenants
- Follow the pattern established in `test/audit/` from Sprint 5

---

## API Contract Updates Required

Before implementation, update `docs/api-contract.md` to add:

### New Sections to Add

**Section 13: Inter-Agent Messaging**
```
POST   /api/dashboard/agents/:id/messages      → Send message
GET    /api/dashboard/agents/:id/messages      → Get agent messages
GET    /api/dashboard/messages                  → Get all tenant messages
PUT    /api/dashboard/agents/:id/allowlist      → Update allowlist
GET    /api/dashboard/communication-graph       → Get communication graph
```

**Section 14: Channels**
```
GET    /api/v1/tenant/channels                    → List connections
POST   /api/v1/tenant/channels                    → Create connection
GET    /api/v1/tenant/channels/:id                → Get connection
PATCH  /api/v1/tenant/channels/:id                → Update connection
DELETE /api/v1/tenant/channels/:id                → Delete connection
GET    /api/v1/tenant/channels/:id/routing        → List routing rules
POST   /api/v1/tenant/channels/:id/routing        → Create routing rule
PATCH  /api/v1/tenant/channels/:id/routing/:ruleId → Update rule
DELETE /api/v1/tenant/channels/:id/routing/:ruleId → Delete rule
```

**Section 11 Update: Add WebSocket Events**
```
Event: message.sent
Event: message.delivered
Event: message.failed
```

---

## Technical Reference

### Existing Codebase Patterns to Follow

| Pattern | Reference File | What to Copy |
|---------|---------------|--------------|
| BullMQ module setup | `audit/audit.module.ts` | Queue registration, processor pattern |
| BullMQ processor | `audit/audit.processor.ts` | `WorkerHost` extension, job processing |
| Global interceptor | `audit/audit.interceptor.ts` | ExecutionContext, RxJS tap/catchError |
| Audit logging | `audit/audit.service.ts` | `logAction()` pattern, sanitization |
| NestJS controller | `admin/tenants/tenants.controller.ts` | Guards, decorators, DTOs |
| Prisma service usage | `dashboard/agents/agents.service.ts` | CRUD patterns, tenant scoping |
| Test patterns | `test/audit/audit.service.spec.ts` | Mock setup, test structure |
| WebSocket | `app.module.ts` (existing WS config) | Gateway registration |

### Prisma Schema (Already Exists — DO NOT recreate)

The following already exist in `backend/prisma/schema.prisma` from S5-Story 4:

```
Lines 131-138: enum MessageType { task_handoff, status_update, ... }
Lines 140-145: enum MessageStatus { pending, delivered, failed, read }
Lines 147-151: enum AllowlistDirection { both, send_only, receive_only }
Lines 716-734: model AgentMessage { ... }
Lines 736-749: model AgentAllowlist { ... }
```

**DO** create: ChannelPlatform, ConnectionStatus, RouteType enums + ChannelConnection, ChannelRouting models.

### Key Architecture Decisions

1. **Allowlist enforcement is synchronous**: `canSendMessage()` is called inline before enqueuing. This is a security boundary — messages MUST NOT be sent without allowlist check.

2. **Message delivery is async**: After allowlist check, the message is created with status 'pending' and enqueued to BullMQ. The processor handles delivery asynchronously.

3. **WebSocket is fire-and-forget**: If no clients are connected, events are simply not delivered. Clients use catch-up on reconnect.

4. **Channel routing is priority-based**: Slash command > channel mapping > user mapping > tenant default. First match wins.

5. **Plugin is a separate npm package**: The OpenClaw plugin lives in its own directory with its own `package.json`. It's installed into tenant OpenClaw containers.

6. **NEVER share OpenClaw across tenants**: Each tenant gets its own container. The plugin uses a per-tenant bearer token.

7. **Audit log export uses streaming**: Large exports use Node.js streams, not in-memory buffers. This prevents OOM on 10K-row exports.

### Import Path for PrismaClient

```typescript
// CORRECT:
import { PrismaService } from '../prisma/prisma.service';

// WRONG (do not use):
// import { PrismaClient } from '@prisma/client';
```

### Queue Names

```typescript
// messaging.constants.ts
export const MESSAGING_QUEUE_NAME = 'agent-messages';
export const MESSAGE_MAX_PAYLOAD_SIZE = 64 * 1024; // 64KB
```

---

## Sprint 6 DoD (Definition of Done)

- [ ] All 6 stories implemented and merged to main
- [ ] 60+ tests passing (target)
- [ ] All existing tests still pass (683+ total, 0 regressions)
- [ ] Inter-agent messaging API fully functional (send, receive, filter, paginate)
- [ ] Allowlist enforcement blocks unauthorized agent communication
- [ ] WebSocket real-time message feed operational
- [ ] Audit log viewer in tenant dashboard with filters, search, and export
- [ ] Admin audit log viewer (cross-tenant)
- [ ] CSV + JSON export with streaming (max 10K rows)
- [ ] Channel data model migrated (ChannelConnection, ChannelRouting)
- [ ] Channel CRUD endpoints operational (tenant-scoped)
- [ ] OpenClaw plugin skeleton with inbound/outbound handlers
- [ ] API contract updated with new endpoints
- [ ] No P0/P1 bugs

---

## What This Unlocks (Sprint 7)

Sprint 6 completion enables:
- **E7-F4**: Agent communication allowlist graph editor (uses communication-graph API + allowlist CRUD)
- **E7-F3**: Inter-agent message dashboard (uses messaging API + WebSocket feed)
- **E7-F2**: Coordination workflow templates (uses messaging API for workflow execution)
- **E11-F2**: Channel proxy core (uses ChannelConnection/Routing models + plugin)
- **E9-F1**: Skill permission manifests (uses audit infrastructure)
- **E8-F4**: Security event alerting (uses audit events stream)

Sprint 6 is the **platform transformation** — from single-agent management to multi-agent coordination.
