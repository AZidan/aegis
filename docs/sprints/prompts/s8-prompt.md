# Sprint 8: Custom Skills SDK & Network Security

## Sprint Overview

**Goal:** Skill SDK, private registry, network policy enforcement, Phase 2 E2E tests
**Total Points:** 39
**Duration:** 2 weeks
**Prerequisites:** Sprint 7 complete (permission manifests, workflows)

## Context Files to Read First

```
MUST READ:
- docs/sprint-backlog.md          # Full backlog with story details
- docs/api-contract.md            # API specifications
- roadmap.yaml                    # E9 (Security), E10 (Custom Skills) epics

SPRINT 7 OUTPUTS (verify these exist):
- backend/src/skills/manifest-validator.service.ts
- backend/src/workflows/

EXISTING CODE:
- backend/src/skills/             # Skill management
- backend/src/container/          # Container orchestration
- backend/prisma/schema.prisma    # Skill model with manifest
```

---

## Stories

### S8-04: Skill Development SDK (8 pts)
**Scope:** Backend (npm package)

**Task:**
Create `@aegis/skill-sdk` npm package with CLI scaffolding.

**Package Structure:**
```
packages/skill-sdk/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # Main exports
│   ├── types.ts           # TypeScript interfaces
│   ├── manifest.ts        # Manifest helpers
│   ├── tools.ts           # Tool definition helpers
│   └── testing.ts         # Test utilities
├── cli/
│   ├── index.ts           # CLI entry point
│   ├── init.ts            # npx @aegis/skill-sdk init
│   ├── validate.ts        # npx @aegis/skill-sdk validate
│   ├── build.ts           # npx @aegis/skill-sdk build
│   └── publish.ts         # npx @aegis/skill-sdk publish
└── templates/
    ├── skill/
    │   ├── manifest.yaml
    │   ├── index.ts
    │   ├── tools/
    │   └── tests/
    └── README.md
```

**CLI Commands:**
```bash
# Initialize a new skill project
npx @aegis/skill-sdk init my-skill
# Creates: my-skill/ with template files

# Validate manifest
npx @aegis/skill-sdk validate
# Output: ✓ Manifest valid or ✗ Errors found

# Build for distribution
npx @aegis/skill-sdk build
# Creates: dist/my-skill-1.0.0.tar.gz

# Publish to private registry (requires auth)
npx @aegis/skill-sdk publish
# Uploads to tenant's private skill registry
```

**SDK Interfaces:**
```typescript
// src/types.ts
export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  permissions: PermissionBlock;
  tools: ToolDefinition[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  returns: ToolReturn;
  handler: string;  // Path to handler function
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: any;
}

// src/tools.ts
export function defineTool(config: ToolDefinition): ToolDefinition;
export function createToolHandler<T, R>(
  handler: (params: T, context: ToolContext) => Promise<R>
): ToolHandler;
```

**Template Files:**

`templates/skill/manifest.yaml`:
```yaml
name: "{{skillName}}"
version: "1.0.0"
description: "A custom skill for Aegis agents"
author: "{{author}}"

permissions:
  network: []
  files:
    read: []
    write: []
  environment:
    required: []
    optional: []

tools:
  - name: "example_tool"
    description: "An example tool"
    parameters:
      - name: "input"
        type: "string"
        description: "Input parameter"
        required: true
    returns:
      type: "object"
      description: "Result object"
```

`templates/skill/index.ts`:
```typescript
import { defineTool, createToolHandler } from '@aegis/skill-sdk';

export const exampleTool = defineTool({
  name: 'example_tool',
  description: 'An example tool',
  parameters: [
    { name: 'input', type: 'string', description: 'Input', required: true }
  ],
  returns: { type: 'object', description: 'Result' },
  handler: './handlers/example'
});

export const tools = [exampleTool];
```

**Acceptance Criteria:**
- [ ] Create packages/skill-sdk directory
- [ ] Implement `init` command with template generation
- [ ] Implement `validate` command using ManifestValidatorService
- [ ] Implement `build` command to create distributable
- [ ] Implement `publish` command (stubs for now, full in S8-05)
- [ ] Export TypeScript types for type safety
- [ ] Include README with documentation
- [ ] Publish to npm (or local registry for now)
- [ ] Write unit tests for CLI commands

**Files to Create:**
- `backend/packages/skill-sdk/package.json`
- `backend/packages/skill-sdk/src/index.ts`
- `backend/packages/skill-sdk/src/types.ts`
- `backend/packages/skill-sdk/src/manifest.ts`
- `backend/packages/skill-sdk/cli/index.ts`
- `backend/packages/skill-sdk/cli/init.ts`
- `backend/packages/skill-sdk/cli/validate.ts`
- `backend/packages/skill-sdk/cli/build.ts`
- `backend/packages/skill-sdk/templates/` (directory)
- `backend/packages/skill-sdk/README.md`

---

### S8-05: Private Skill Registry (8 pts)
**Scope:** Full-stack
**Dependencies:** S8-04

**Task:**
Allow tenants to upload and manage private custom skills.

**Database Model:**
```prisma
model PrivateSkill {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  name        String
  version     String
  description String
  author      String?

  // Manifest and validation
  manifest        Json
  manifestValid   Boolean @default(false)
  validationErrors Json?

  // Storage
  packageUrl      String   // S3 URL or local path
  packageSize     Int      // Bytes
  packageChecksum String   // SHA256

  // Status
  status      PrivateSkillStatus @default(pending_review)
  reviewedBy  String?
  reviewedAt  DateTime?
  reviewNotes String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, name, version])
  @@index([tenantId])
  @@index([status])
  @@map("private_skills")
}

enum PrivateSkillStatus {
  pending_review
  approved
  rejected
  deprecated
}
```

**API Endpoints:**
```
# Upload new skill version
POST /api/skills/private/upload
Content-Type: multipart/form-data
- file: skill-1.0.0.tar.gz
- manifest: JSON string

Response:
{
  "id": "skill-123",
  "name": "my-skill",
  "version": "1.0.0",
  "status": "pending_review"
}

# List tenant's private skills
GET /api/skills/private
{
  "skills": [...]
}

# Get skill details
GET /api/skills/private/:id
{
  "skill": {...},
  "installationCount": 5
}

# Admin: Review skill
PUT /api/admin/skills/private/:id/review
{
  "status": "approved",
  "notes": "Looks good"
}

# Install private skill to agent
POST /api/tenants/:tenantId/agents/:agentId/skills/private
{
  "privateSkillId": "skill-123"
}
```

**Tenant Admin UI:**
```
PrivateSkillsPage
├── UploadSkillButton
│   └── UploadSkillModal
│       ├── FileDropzone
│       ├── ManifestPreview
│       └── SubmitButton
├── PrivateSkillsTable
│   ├── Name, Version, Status
│   ├── Created date
│   └── Actions (view, deprecate)
└── SkillDetailModal
    ├── ManifestViewer
    ├── InstallationList
    └── VersionHistory
```

**Acceptance Criteria:**
- [ ] Create PrivateSkill model
- [ ] Upload endpoint with file storage (S3 or local)
- [ ] Validate manifest on upload
- [ ] Package integrity check (checksum)
- [ ] List/detail endpoints for tenant
- [ ] Admin review workflow
- [ ] Install private skill to agent
- [ ] Version management (allow multiple versions)
- [ ] Tenant admin UI for managing skills
- [ ] Write unit tests

**Files to Create:**
- `backend/src/skills/private-skills.controller.ts`
- `backend/src/skills/private-skills.service.ts`
- `backend/src/skills/dto/upload-skill.dto.ts`
- `backend/src/admin/skills/skill-review.controller.ts`
- `frontend/src/app/dashboard/skills/private/page.tsx`
- `frontend/src/components/skills/upload-skill-modal.tsx`
- `frontend/src/components/skills/private-skills-table.tsx`

---

### S8-06: Network Policy Enforcement (8 pts)
**Scope:** Backend
**Dependencies:** S7-04 (permission manifests)

**Task:**
Generate and enforce network policies based on skill permission manifests.

**Architecture:**
```
Skill Manifest → NetworkPolicyGenerator → Kubernetes NetworkPolicy YAML
                                       → Apply via kubectl
```

**NetworkPolicy Generator:**
```typescript
// backend/src/container/network-policy.service.ts
@Injectable()
export class NetworkPolicyService {
  // Generate NetworkPolicy YAML from tenant's installed skills
  async generateNetworkPolicy(tenantId: string): Promise<string> {
    const installedSkills = await this.getInstalledSkills(tenantId);
    const allowedDomains = this.extractAllowedDomains(installedSkills);

    return this.generatePolicyYaml(tenantId, allowedDomains);
  }

  // Apply policy to Kubernetes
  async applyNetworkPolicy(tenantId: string): Promise<void>;

  // Log blocked request (for soft enforcement mode)
  async logBlockedRequest(tenantId: string, destination: string): Promise<void>;
}
```

**Generated NetworkPolicy:**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: tenant-{{tenantId}}-egress
  namespace: aegis-tenants
spec:
  podSelector:
    matchLabels:
      tenant: {{tenantId}}
  policyTypes:
    - Egress
  egress:
    # Allow DNS
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: UDP
          port: 53
    # Allow internal platform services
    - to:
        - podSelector:
            matchLabels:
              app: aegis-api
    # Allowed external domains (from skill manifests)
    {{#each allowedDomains}}
    - to:
        - ipBlock:
            cidr: {{this.cidr}}
      ports:
        - protocol: TCP
          port: 443
    {{/each}}
```

**DNS-Level Enforcement (Optional):**
For more granular domain-based enforcement, use CoreDNS policy:
```typescript
// Generate CoreDNS ConfigMap entry
async generateDnsPolicy(tenantId: string): Promise<string>;
```

**Blocked Request Logging:**
```prisma
model BlockedNetworkRequest {
  id              String   @id @default(uuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  agentId         String?
  sourceIp        String
  destinationHost String
  destinationPort Int
  protocol        String
  reason          String   // "not_in_allowlist", "skill_not_installed"
  createdAt       DateTime @default(now())

  @@index([tenantId, createdAt])
  @@map("blocked_network_requests")
}
```

**Acceptance Criteria:**
- [ ] Create NetworkPolicyService
- [ ] Generate NetworkPolicy YAML from skill manifests
- [ ] Apply policy via kubectl (or K8s API)
- [ ] Update policy when skills installed/uninstalled
- [ ] Log blocked requests for monitoring
- [ ] Admin dashboard shows blocked request logs
- [ ] Soft enforcement mode (log only, don't block)
- [ ] Hard enforcement mode (actually block)
- [ ] Write unit tests

**Files to Create:**
- `backend/src/container/network-policy.service.ts`
- `backend/src/container/network-policy.generator.ts`
- `backend/src/container/dto/blocked-request.dto.ts`
- `backend/test/container/network-policy.service.spec.ts`

---

### S8-01: Skill Validation & Dry-Run (5 pts)
**Scope:** Backend
**Dependencies:** S8-04

**Task:**
Add static analysis and sandbox testing for skills before approval.

**Static Analysis:**
```typescript
// backend/src/skills/skill-analyzer.service.ts
@Injectable()
export class SkillAnalyzerService {
  // Check for dangerous patterns in code
  async analyzeCode(skillPackage: Buffer): Promise<AnalysisResult> {
    return {
      issues: [
        { severity: 'error', message: 'eval() usage detected', line: 42 },
        { severity: 'warning', message: 'Hardcoded API key found', line: 87 }
      ],
      score: 75  // Security score 0-100
    };
  }

  // Verify declared permissions match actual usage
  async verifyPermissions(skillPackage: Buffer, manifest: SkillManifest): Promise<VerificationResult> {
    return {
      undeclaredNetworkCalls: ['api.example.com'],
      undeclaredFileAccess: ['/etc/passwd'],
      valid: false
    };
  }
}
```

**Dry-Run Sandbox:**
```typescript
// backend/src/skills/skill-sandbox.service.ts
@Injectable()
export class SkillSandboxService {
  // Execute skill in isolated container with monitoring
  async dryRun(skillPackage: Buffer, testInput: any): Promise<DryRunResult> {
    // 1. Spin up isolated Docker container
    // 2. Install skill
    // 3. Execute with test input
    // 4. Monitor network calls, file access
    // 5. Compare against manifest
    // 6. Return results

    return {
      success: true,
      output: {...},
      networkCalls: [...],
      fileAccess: [...],
      executionTime: 1234,
      memoryUsage: 128000000
    };
  }
}
```

**Security Checklist:**
```typescript
const SECURITY_CHECKLIST = [
  { id: 'no_eval', description: 'No eval() or Function() usage', severity: 'error' },
  { id: 'no_hardcoded_secrets', description: 'No hardcoded API keys/passwords', severity: 'error' },
  { id: 'declared_network', description: 'All network calls declared in manifest', severity: 'error' },
  { id: 'declared_files', description: 'All file access declared in manifest', severity: 'error' },
  { id: 'no_shell_exec', description: 'No shell command execution', severity: 'warning' },
  { id: 'input_validation', description: 'Tool inputs are validated', severity: 'warning' },
];
```

**Acceptance Criteria:**
- [ ] Create SkillAnalyzerService for static analysis
- [ ] Detect dangerous patterns (eval, hardcoded secrets)
- [ ] Create SkillSandboxService for dry-run
- [ ] Compare actual vs declared permissions
- [ ] Generate security score (0-100)
- [ ] Show results in admin review UI
- [ ] Block approval if critical issues found
- [ ] Write unit tests

**Files to Create:**
- `backend/src/skills/skill-analyzer.service.ts`
- `backend/src/skills/skill-sandbox.service.ts`
- `backend/src/skills/interfaces/analysis.interface.ts`
- `backend/test/skills/skill-analyzer.service.spec.ts`

---

### S8-02: Security Posture Dashboard (5 pts)
**Scope:** Frontend

**Task:**
Build admin dashboard showing overall platform security status.

**UI Sections:**
```
SecurityPostureDashboard
├── OverallScore (gauge 0-100)
├── MetricsCards
│   ├── Active Alerts (critical/warning/info)
│   ├── Blocked Network Requests (24h)
│   ├── Policy Violations (24h)
│   └── Skills Pending Review
├── ComplianceChecklist
│   ├── All tenants have network policies ✓/✗
│   ├── All skills have manifests ✓/✗
│   ├── Audit logging enabled ✓/✗
│   ├── MFA enabled for all admins ✓/✗
│   └── No critical alerts open ✓/✗
├── RecentAlerts (table)
└── BlockedRequestsChart (24h timeline)
```

**API Endpoint:**
```
GET /api/admin/security/posture
{
  "overallScore": 85,
  "metrics": {
    "activeAlerts": { "critical": 0, "warning": 2, "info": 5 },
    "blockedRequests24h": 12,
    "policyViolations24h": 3,
    "skillsPendingReview": 2
  },
  "compliance": {
    "networkPolicies": { "compliant": 8, "total": 10 },
    "skillManifests": { "compliant": 45, "total": 50 },
    "auditLogging": true,
    "mfaAdmins": { "enabled": 5, "total": 5 }
  },
  "recentAlerts": [...],
  "blockedRequestsTimeline": [...]
}
```

**Acceptance Criteria:**
- [ ] Create security posture API endpoint
- [ ] Overall security score calculation
- [ ] Compliance checklist with status
- [ ] Metrics cards with counts
- [ ] Recent alerts table
- [ ] Blocked requests timeline chart
- [ ] Drill-down links to detailed pages
- [ ] Auto-refresh every 60 seconds

**Files to Create:**
- `frontend/src/app/admin/security/page.tsx`
- `frontend/src/components/admin/security/security-score-gauge.tsx`
- `frontend/src/components/admin/security/compliance-checklist.tsx`
- `frontend/src/components/admin/security/blocked-requests-chart.tsx`
- `backend/src/admin/security/security-posture.controller.ts`
- `backend/src/admin/security/security-posture.service.ts`

---

### S8-03: E2E Phase 2 Tests (5 pts)
**Scope:** Testing

**Task:**
Comprehensive E2E tests covering all Phase 2 features.

**Test Scenarios:**

**Audit Trail:**
```typescript
describe('Audit Trail E2E', () => {
  it('should log admin actions', async () => {
    // Create tenant → Check audit log entry
  });

  it('should log agent actions', async () => {
    // Send message → Check audit log entry
  });

  it('should filter logs by date range', async () => {});
  it('should export logs to CSV', async () => {});
});
```

**Inter-Agent Messaging:**
```typescript
describe('Messaging E2E', () => {
  it('should allow message between allowed agents', async () => {
    // Create allowlist → Send message → Verify delivery
  });

  it('should block message to non-allowed agent', async () => {
    // No allowlist → Send message → Verify 403
  });

  it('should receive message via WebSocket', async () => {
    // Connect WS → Send message → Verify received
  });
});
```

**Skills & Security:**
```typescript
describe('Skills E2E', () => {
  it('should upload and validate private skill', async () => {});
  it('should reject skill with invalid manifest', async () => {});
  it('should install private skill to agent', async () => {});
});

describe('Security E2E', () => {
  it('should log blocked network requests', async () => {});
  it('should trigger alert on failed logins', async () => {});
  it('should show security posture dashboard', async () => {});
});
```

**Billing:**
```typescript
describe('Billing E2E', () => {
  it('should show correct billing overview', async () => {});
  it('should track token usage', async () => {});
  it('should warn at 80% usage', async () => {});
});
```

**Acceptance Criteria:**
- [ ] E2E tests for audit trail (5+ tests)
- [ ] E2E tests for messaging (5+ tests)
- [ ] E2E tests for skills (5+ tests)
- [ ] E2E tests for security (5+ tests)
- [ ] E2E tests for billing (5+ tests)
- [ ] Tests run in CI pipeline
- [ ] All tests passing
- [ ] Test coverage report generated

**Files to Create:**
- `backend/test/e2e/audit.e2e-spec.ts`
- `backend/test/e2e/messaging.e2e-spec.ts`
- `backend/test/e2e/skills.e2e-spec.ts`
- `backend/test/e2e/security.e2e-spec.ts`
- `backend/test/e2e/billing.e2e-spec.ts`

---

## Dependencies Diagram

```
S8-04 (Skill SDK) ────────> S8-05 (Private Registry)
        │                          │
        └──────────────────────────┼──> S8-01 (Validation)
                                   │
S7-04 (Manifests) ─────────────────┼──> S8-06 (Network Policies)
                                   │
                                   └──> S8-02 (Security Dashboard)

S8-03 (E2E Tests) ─────────────────────> (depends on all above)
```

---

## Sprint Exit Criteria

Before marking Sprint 8 (and Phase 2) complete, verify:

- [ ] `npx @aegis/skill-sdk init` scaffolds new skill project
- [ ] `npx @aegis/skill-sdk validate` validates manifest
- [ ] Tenants can upload private skills
- [ ] Admin can review and approve/reject skills
- [ ] Network policies generated from skill manifests
- [ ] Blocked network requests logged
- [ ] Security posture dashboard shows overall score
- [ ] Static analysis catches dangerous patterns
- [ ] Phase 2 E2E test suite passes (25+ tests)
- [ ] All new code has unit tests
- [ ] No TypeScript errors
- [ ] All existing tests still pass

---

## Phase 2 Complete Checklist

After Sprint 8, the following capabilities should be fully functional:

### Audit & Compliance
- [x] All admin actions logged
- [x] All agent actions logged
- [x] Audit log viewer in dashboards
- [x] Log retention and archival
- [x] Security alerts

### Inter-Agent Communication
- [x] Structured messaging API
- [x] Allowlist enforcement
- [x] Real-time WebSocket feed
- [x] Message dashboard
- [x] Communication graph editor
- [x] Workflow templates

### Billing & Usage
- [x] Plan tier enforcement
- [x] Token usage tracking
- [x] Usage warnings
- [x] Billing dashboard
- [x] Overage handling

### Security
- [x] Permission manifests
- [x] Network policy enforcement
- [x] Skill validation
- [x] Security posture dashboard

### Custom Skills
- [x] Skill SDK
- [x] Private skill registry
- [x] Version management
- [x] Review workflow

---

## Technical Notes

### NPM Package Publishing
```bash
# For local development
npm link

# For npm registry
npm publish --access public
```

### K8s NetworkPolicy Application
```typescript
import * as k8s from '@kubernetes/client-node';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

await networkingApi.createNamespacedNetworkPolicy(
  'aegis-tenants',
  policyObject
);
```

### Security Score Calculation
```typescript
function calculateSecurityScore(metrics: SecurityMetrics): number {
  let score = 100;

  // Deduct for issues
  score -= metrics.criticalAlerts * 20;
  score -= metrics.warningAlerts * 5;
  score -= metrics.skillsWithoutManifests * 2;
  score -= metrics.blockedRequests24h * 0.5;

  // Bonus for good practices
  if (metrics.mfaEnabled) score += 5;
  if (metrics.auditLoggingEnabled) score += 5;

  return Math.max(0, Math.min(100, score));
}
```
