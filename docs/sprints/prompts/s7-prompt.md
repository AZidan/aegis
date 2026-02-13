# Sprint 7: Communication Dashboard & Security Hardening

## Sprint Overview

**Goal:** Message dashboard, communication graph editor, permission manifests, workflow templates
**Total Points:** 29
**Duration:** 2 weeks
**Prerequisites:** Sprint 6 complete (messaging API, WebSocket feed)

## Context Files to Read First

```
MUST READ:
- docs/sprint-backlog.md          # Full backlog with story details
- docs/api-contract.md            # API specifications
- roadmap.yaml                    # E7 (Communication), E9 (Security) epics

SPRINT 6 OUTPUTS (verify these exist):
- backend/src/messaging/          # MessagingService, MessagingGateway
- backend/src/alerts/             # SecurityAlertService

EXISTING CODE:
- backend/prisma/schema.prisma    # AgentMessage, AgentAllowlist models
- frontend/src/components/        # UI component patterns
- backend/src/skills/             # Skill management (for manifests)
```

---

## Stories

### S7-02: Communication Allowlist Graph Editor (8 pts)
**Scope:** Frontend

**Task:**
Build interactive graph visualization for agent communication allowlists.

**UI Requirements:**
- Agents displayed as nodes (circles with avatar/name)
- Allowlist entries displayed as directed edges (arrows)
- Click agent to select
- Drag from agent to agent to create allowlist entry
- Click edge to delete allowlist entry
- Color coding: PM=blue, Engineering=green, Operations=orange

**Library:** React Flow (recommended)
```bash
npm install @xyflow/react
```

**API Endpoints (may need to create):**
```
GET /api/dashboard/agents/communication-graph
{
  "agents": [
    { "id": "agent-1", "name": "PM Agent", "role": "pm", "x": 100, "y": 100 },
    { "id": "agent-2", "name": "Eng Agent", "role": "engineering", "x": 300, "y": 100 }
  ],
  "allowlist": [
    { "id": "allow-1", "sourceId": "agent-1", "targetId": "agent-2" }
  ]
}

POST /api/dashboard/agents/allowlist
{
  "agentId": "agent-1",
  "allowedAgentId": "agent-2"
}

DELETE /api/dashboard/agents/allowlist/:id
```

**Component Structure:**
```
CommunicationGraph
├── ReactFlow
│   ├── AgentNode (custom node)
│   │   ├── Avatar
│   │   ├── Name
│   │   └── Role badge
│   └── AllowlistEdge (custom edge with delete button)
├── GraphToolbar
│   ├── Add Agent (opens modal)
│   ├── Auto-layout button
│   └── Save positions button
└── GraphLegend
```

**Acceptance Criteria:**
- [ ] Display agents as draggable nodes
- [ ] Display allowlist entries as directed edges
- [ ] Drag from node handle to create new allowlist
- [ ] Click edge delete button to remove allowlist
- [ ] Auto-layout algorithm for initial positioning
- [ ] Save node positions to backend
- [ ] Sync changes to container via ConfigSyncService
- [ ] Loading and error states
- [ ] Responsive (min-width for usability)

**Files to Create:**
- `frontend/src/app/dashboard/agents/communication/page.tsx`
- `frontend/src/components/agents/communication-graph.tsx`
- `frontend/src/components/agents/agent-node.tsx`
- `frontend/src/components/agents/allowlist-edge.tsx`
- `frontend/src/lib/api/communication.ts`
- `frontend/src/lib/hooks/use-communication-graph.ts`

**Backend (if needed):**
- `backend/src/dashboard/agents/agents.controller.ts` (add graph endpoints)
- `backend/src/dashboard/agents/agents.service.ts` (add graph methods)

---

### S7-03: Inter-Agent Message Dashboard (8 pts)
**Scope:** Frontend
**Dependencies:** S6-05, S6-02 (from Sprint 6)

**Task:**
Build message timeline dashboard with real-time updates.

**UI Sections:**
```
Message Dashboard
├── Filters Bar
│   ├── Agent pair selector
│   ├── Message type filter
│   ├── Date range picker
│   └── Search by correlationId
├── Timeline View
│   ├── MessageCard
│   │   ├── Sender → Recipient
│   │   ├── Type badge
│   │   ├── Timestamp
│   │   ├── Payload preview (collapsed)
│   │   └── Expand button
│   └── Real-time indicator ("Live")
├── Flow Diagram (optional toggle)
│   └── Sankey or flow visualization
└── Export Button
```

**Real-Time Updates:**
```typescript
// Connect to WebSocket
const socket = io('/ws/messages', { auth: { token } });

socket.emit('subscribe', { tenantId });

socket.on('message', (message) => {
  // Prepend to timeline
  setMessages(prev => [message, ...prev]);
});
```

**API Endpoints (from Sprint 6):**
```
GET /api/messaging/timeline?tenantId=xxx&from=xxx&to=xxx&type=xxx
GET /api/messaging/conversation/:correlationId
```

**Acceptance Criteria:**
- [ ] Timeline view with message cards
- [ ] Filter by agent pair, type, date range
- [ ] Real-time updates via WebSocket
- [ ] "Live" indicator when connected
- [ ] Expand message to see full payload
- [ ] Thread view for correlated messages
- [ ] Flow diagram visualization (optional)
- [ ] Export to JSON
- [ ] Loading and error states

**Files to Create:**
- `frontend/src/app/dashboard/messages/page.tsx`
- `frontend/src/components/messages/message-timeline.tsx`
- `frontend/src/components/messages/message-card.tsx`
- `frontend/src/components/messages/message-filters.tsx`
- `frontend/src/components/messages/message-flow-diagram.tsx`
- `frontend/src/lib/api/messages.ts`
- `frontend/src/lib/hooks/use-messages.ts`
- `frontend/src/lib/hooks/use-message-socket.ts`

---

### S7-04: Skill Permission Manifests (8 pts)
**Scope:** Full-stack

**Task:**
Implement permission manifest system for skills.

**Manifest Schema:**
```yaml
# skill-manifest.yaml
name: "jira-integration"
version: "1.0.0"
description: "Jira ticket management skill"

permissions:
  network:
    - domain: "*.atlassian.net"
      methods: ["GET", "POST", "PUT"]
    - domain: "api.atlassian.com"
      methods: ["GET", "POST"]

  files:
    read:
      - "~/.jira/config.json"
    write:
      - "~/.jira/cache/"

  environment:
    required:
      - "JIRA_API_TOKEN"
      - "JIRA_BASE_URL"
    optional:
      - "JIRA_PROJECT_KEY"

  tools:
    - name: "jira_create_ticket"
      description: "Create a new Jira ticket"
    - name: "jira_search"
      description: "Search Jira tickets"
```

**Database Changes:**
```prisma
model Skill {
  // ... existing fields ...

  // Permission manifest (NEW)
  permissionManifest Json?   // Parsed manifest
  manifestVersion    String? // Manifest schema version

  // Validation status
  manifestValid      Boolean @default(false)
  manifestErrors     Json?   // Validation errors if any
}
```

**Validation Service:**
```typescript
// backend/src/skills/manifest-validator.service.ts
@Injectable()
export class ManifestValidatorService {
  // Validate manifest against schema
  validateManifest(manifest: SkillManifest): ValidationResult;

  // Check if skill uses only declared permissions at runtime
  async checkRuntimeCompliance(skillId: string, action: RuntimeAction): Promise<boolean>;

  // Log permission usage for auditing
  async logPermissionUsage(skillId: string, permission: string, action: string): Promise<void>;
}
```

**API Endpoints:**
```
POST /api/skills/:id/manifest
Content-Type: application/json
{
  "manifest": { ... }
}

GET /api/skills/:id/manifest
{
  "manifest": { ... },
  "valid": true,
  "errors": []
}

GET /api/skills/:id/permission-usage
{
  "usage": [
    { "permission": "network:*.atlassian.net", "count": 150, "lastUsed": "..." }
  ]
}
```

**Admin Review UI:**
```
SkillReviewPage
├── ManifestViewer
│   ├── NetworkPermissions (table)
│   ├── FilePermissions (table)
│   ├── EnvironmentVariables (table)
│   └── ToolDefinitions (list)
├── ValidationStatus
│   ├── Valid badge or error list
│   └── Re-validate button
├── RuntimeUsageStats
│   └── Permission usage chart
└── ApproveButton / RejectButton
```

**Acceptance Criteria:**
- [ ] Add manifest fields to Skill model
- [ ] Create ManifestValidatorService
- [ ] POST endpoint to upload/update manifest
- [ ] Validate manifest on upload
- [ ] Store validation errors
- [ ] Runtime permission logging (soft enforcement)
- [ ] Admin UI to view manifest and usage
- [ ] Skill review shows manifest details
- [ ] Write unit tests for validator

**Files to Create:**
- `backend/src/skills/manifest-validator.service.ts`
- `backend/src/skills/dto/skill-manifest.dto.ts`
- `backend/src/skills/interfaces/manifest.interface.ts`
- `backend/test/skills/manifest-validator.service.spec.ts`
- `frontend/src/components/admin/skills/manifest-viewer.tsx`
- `frontend/src/components/admin/skills/permission-usage.tsx`

---

### S7-01: Coordination Workflow Templates (5 pts)
**Scope:** Backend

**Task:**
Create predefined workflow templates for common multi-agent coordination patterns.

**Templates:**

**1. Daily Sync**
```typescript
const DAILY_SYNC_TEMPLATE = {
  id: 'daily_sync',
  name: 'Daily Sync',
  description: 'Each agent sends status update to a coordinator',
  schedule: '0 9 * * 1-5',  // 9 AM weekdays
  participants: ['*'],  // All agents in tenant
  coordinator: 'first',  // First agent by creation date
  sequence: [
    { from: '*', to: 'coordinator', type: 'status_update' }
  ]
};
```

**2. Weekly Standup**
```typescript
const WEEKLY_STANDUP_TEMPLATE = {
  id: 'weekly_standup',
  name: 'Weekly Standup',
  description: 'Structured standup: blockers, accomplishments, plans',
  schedule: '0 10 * * 1',  // Monday 10 AM
  participants: ['*'],
  coordinator: 'first',
  sequence: [
    { from: 'coordinator', to: '*', type: 'data_request', payload: { query: 'weekly_standup' } },
    { from: '*', to: 'coordinator', type: 'data_response', timeout: '2h' }
  ]
};
```

**3. Sprint Handoff**
```typescript
const SPRINT_HANDOFF_TEMPLATE = {
  id: 'sprint_handoff',
  name: 'Sprint Handoff',
  description: 'PM hands off sprint tasks to Engineering',
  trigger: 'manual',
  participants: ['role:pm', 'role:engineering'],
  sequence: [
    { from: 'role:pm', to: 'role:engineering', type: 'task_handoff' }
  ]
};
```

**Database Model:**
```prisma
model WorkflowTemplate {
  id          String   @id @default(uuid())
  templateId  String   @unique  // 'daily_sync', 'weekly_standup', etc.
  name        String
  description String
  config      Json     // Full template configuration
  isBuiltIn   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("workflow_templates")
}

model WorkflowInstance {
  id          String   @id @default(uuid())
  templateId  String
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  status      WorkflowStatus @default(pending)
  startedAt   DateTime?
  completedAt DateTime?
  error       String?
  createdAt   DateTime @default(now())

  @@index([tenantId, createdAt])
  @@map("workflow_instances")
}

enum WorkflowStatus {
  pending
  running
  completed
  failed
  cancelled
}
```

**API Endpoints:**
```
GET /api/workflows/templates
{
  "templates": [
    { "id": "daily_sync", "name": "Daily Sync", ... }
  ]
}

POST /api/workflows/trigger
{
  "templateId": "sprint_handoff",
  "participants": ["agent-pm-1", "agent-eng-1"],
  "payload": { ... }
}

GET /api/workflows/instances?tenantId=xxx
{
  "instances": [...]
}
```

**Acceptance Criteria:**
- [ ] Create WorkflowTemplate and WorkflowInstance models
- [ ] Seed 3 built-in templates
- [ ] GET templates endpoint
- [ ] POST trigger endpoint (manual execution)
- [ ] Track workflow instance status
- [ ] BullMQ processor to execute workflow steps
- [ ] Timeout handling for responses
- [ ] Write unit tests

**Files to Create:**
- `backend/src/workflows/workflows.module.ts`
- `backend/src/workflows/workflows.service.ts`
- `backend/src/workflows/workflows.controller.ts`
- `backend/src/workflows/workflows.processor.ts`
- `backend/src/workflows/templates/` (template definitions)
- `backend/prisma/seed-workflows.ts`
- `backend/test/workflows/workflows.service.spec.ts`

---

## Dependencies Diagram

```
S7-02 (Graph Editor) ────────> (depends on AgentAllowlist from schema)
                               (syncs to container via ConfigSyncService)

S7-03 (Message Dashboard) ───> (depends on S6-05, S6-02 from Sprint 6)

S7-04 (Permission Manifests) ─> (modifies Skill model)
                               (soft enforcement - logging only)

S7-01 (Workflow Templates) ──> (depends on S6-05 messaging from Sprint 6)
```

---

## Sprint Exit Criteria

Before marking Sprint 7 complete, verify:

- [ ] Communication graph displays all agents and allowlists
- [ ] Drag-to-connect creates new allowlist entries
- [ ] Click-to-delete removes allowlist entries
- [ ] Message timeline shows real-time updates
- [ ] Message filters work (agent, type, date)
- [ ] Skills can have permission manifests uploaded
- [ ] Manifest validation catches invalid manifests
- [ ] 3 workflow templates available
- [ ] Workflow trigger executes and tracks status
- [ ] All new code has unit tests
- [ ] No TypeScript errors
- [ ] All existing tests still pass

---

## Technical Notes

### React Flow Setup
```tsx
import { ReactFlow, Controls, Background } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const nodeTypes = {
  agent: AgentNode,
};

const edgeTypes = {
  allowlist: AllowlistEdge,
};

<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
  onConnect={handleConnect}
  onEdgeClick={handleEdgeDelete}
>
  <Controls />
  <Background />
</ReactFlow>
```

### Custom Node Component
```tsx
function AgentNode({ data }: NodeProps<AgentNodeData>) {
  return (
    <div className="agent-node">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <Avatar color={data.avatarColor} />
        <div>
          <div className="font-medium">{data.name}</div>
          <Badge color={ROLE_COLORS[data.role]}>{data.role}</Badge>
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

### Manifest Validation with Zod
```typescript
import { z } from 'zod';

const NetworkPermissionSchema = z.object({
  domain: z.string(),
  methods: z.array(z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])),
});

const ManifestSchema = z.object({
  name: z.string(),
  version: z.string(),
  permissions: z.object({
    network: z.array(NetworkPermissionSchema).optional(),
    files: z.object({
      read: z.array(z.string()).optional(),
      write: z.array(z.string()).optional(),
    }).optional(),
    environment: z.object({
      required: z.array(z.string()).optional(),
      optional: z.array(z.string()).optional(),
    }).optional(),
  }),
});
```
