# Sprint 4: Config, Skills & Billing Foundation

## Sprint Overview

**Goal:** Complete MVP polish, add billing infrastructure, and core skill auto-installation
**Total Points:** 41
**Duration:** 2 weeks
**Status:** Ready to start

## Context Files to Read First

Before starting, read these files to understand the codebase:

```
MUST READ:
- docs/sprint-backlog.md          # Full backlog with all stories
- docs/pricing-model.md           # Billing requirements (source for E12 stories)
- docs/api-contract.md            # API specifications
- project-context.md              # Business context and architecture
- roadmap.yaml                    # Epic and feature definitions

SCHEMA & MODELS:
- backend/prisma/schema.prisma    # Current database schema

EXISTING IMPLEMENTATIONS (for reference):
- backend/src/provisioning/       # Provisioning system (for E4-F4, S4-04)
- backend/src/dashboard/agents/   # Agent creation wizard (for E12-05)
- frontend/src/components/dashboard/agents/  # Agent UI components
```

---

## Stories

### E12-01: Plan Tier Schema Migration (3 pts)
**Scope:** Backend
**Priority:** Start first (blocks other E12 stories)

**Task:**
Add billing-related fields to the Prisma schema for Tenant and Agent models.

**Schema Changes Required:**
```prisma
// Add to Tenant model
model Tenant {
  // ... existing fields ...

  // Billing fields (NEW)
  planTier              PlanTier    @default(starter)
  overageBillingEnabled Boolean     @default(false)
  monthlyTokenQuota     BigInt?     // Derived from plan + agent count
}

enum PlanTier {
  starter
  growth
  enterprise
}
```

**Acceptance Criteria:**
- [ ] Add `planTier` enum field to Tenant (default: starter)
- [ ] Add `overageBillingEnabled` boolean to Tenant (default: false)
- [ ] Add `monthlyTokenQuota` BigInt field to Tenant (nullable)
- [ ] Create and run Prisma migration
- [ ] Update CreateTenantDto and UpdateTenantDto to include planTier
- [ ] Update tenant provisioning wizard to set plan tier

**Files to Modify:**
- `backend/prisma/schema.prisma`
- `backend/src/admin/tenants/dto/create-tenant.dto.ts`
- `backend/src/admin/tenants/dto/update-tenant.dto.ts`

---

### E12-02: Agent Token Tracking Fields (3 pts)
**Scope:** Backend
**Priority:** Start first (blocks E12-03)

**Task:**
Add token usage tracking fields to the Agent model.

**Schema Changes Required:**
```prisma
// Add to Agent model
model Agent {
  // ... existing fields ...

  // Token tracking (NEW)
  monthlyTokensUsed      BigInt    @default(0)
  monthlyTokenQuotaOverride BigInt? // For enterprise custom limits
  tokenQuotaResetAt      DateTime? // When to reset monthly counter
}
```

**Acceptance Criteria:**
- [ ] Add `monthlyTokensUsed` BigInt field to Agent (default: 0)
- [ ] Add `monthlyTokenQuotaOverride` BigInt field (nullable, for enterprise)
- [ ] Add `tokenQuotaResetAt` DateTime field (nullable)
- [ ] Create and run Prisma migration
- [ ] No API changes needed yet (internal tracking)

**Files to Modify:**
- `backend/prisma/schema.prisma`

---

### E12-03: UsageRecord Table & Tracking Service (5 pts)
**Scope:** Backend
**Dependencies:** E12-01, E12-02

**Task:**
Create UsageRecord table and a service to track token consumption per agent.

**How Token Tracking Works:**
We capture token usage from LLM responses in the Channel Proxy - NOT by querying containers separately.

All major LLM providers return usage in their responses (field names vary):

| Provider | Input Tokens | Output Tokens |
|----------|--------------|---------------|
| Anthropic | `usage.input_tokens` | `usage.output_tokens` |
| OpenAI | `usage.prompt_tokens` | `usage.completion_tokens` |
| Google Gemini | `usageMetadata.promptTokenCount` | `usageMetadata.candidatesTokenCount` |
| Qwen/Kimi | `usage.input_tokens` or `usage.prompt_tokens` | varies |

**Provider-Agnostic Usage Extractor:**
```typescript
// backend/src/billing/usage-extractor.service.ts
export interface NormalizedUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
  cacheReadTokens?: number;
  provider: LlmProvider;
  model: string;
}

export enum LlmProvider {
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
  GOOGLE = 'google',
  QWEN = 'qwen',
  KIMI = 'kimi',
}

@Injectable()
export class UsageExtractorService {
  /**
   * Extract normalized usage from any LLM provider response.
   * The provider is determined by the model string or response structure.
   */
  extractUsage(response: any, model: string): NormalizedUsage | null {
    const provider = this.detectProvider(model);

    switch (provider) {
      case LlmProvider.ANTHROPIC:
        return this.extractAnthropicUsage(response, model);
      case LlmProvider.OPENAI:
        return this.extractOpenAIUsage(response, model);
      case LlmProvider.GOOGLE:
        return this.extractGoogleUsage(response, model);
      default:
        return this.extractGenericUsage(response, model, provider);
    }
  }

  private extractAnthropicUsage(response: any, model: string): NormalizedUsage {
    const usage = response.usage;
    return {
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
      thinkingTokens: usage?.thinking_tokens ?? 0,
      cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
      provider: LlmProvider.ANTHROPIC,
      model,
    };
  }

  private extractOpenAIUsage(response: any, model: string): NormalizedUsage {
    const usage = response.usage;
    return {
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
      provider: LlmProvider.OPENAI,
      model,
    };
  }

  private extractGoogleUsage(response: any, model: string): NormalizedUsage {
    const usage = response.usageMetadata;
    return {
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
      provider: LlmProvider.GOOGLE,
      model,
    };
  }

  private detectProvider(model: string): LlmProvider {
    if (model.includes('claude') || model.includes('anthropic')) return LlmProvider.ANTHROPIC;
    if (model.includes('gpt') || model.includes('openai')) return LlmProvider.OPENAI;
    if (model.includes('gemini') || model.includes('google')) return LlmProvider.GOOGLE;
    if (model.includes('qwen')) return LlmProvider.QWEN;
    if (model.includes('moonshot') || model.includes('kimi')) return LlmProvider.KIMI;
    return LlmProvider.ANTHROPIC; // Default
  }
}
```

**Integration Point - Modify ChannelProxyProcessor:**
```typescript
// backend/src/channel-proxy/channel-proxy.processor.ts
private async handleForwardToContainer(job: Job<ForwardToContainerJob>): Promise<void> {
  // ... existing code to call OpenClaw ...

  const response = await fetch(url, { ... });
  const data = await response.json();

  // Extract normalized usage (works with any LLM provider)
  const usage = this.usageExtractor.extractUsage(data, model);
  if (usage) {
    await this.usageTrackingService.recordUsage(sessionContext.agentId, {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      thinkingTokens: usage.thinkingTokens,
      provider: usage.provider,
      model: usage.model,
    });
  }

  // ... rest of processing ...
}
```

**Schema:**
```prisma
model UsageRecord {
  id              String   @id @default(uuid())

  agentId         String
  agent           Agent    @relation(fields: [agentId], references: [id], onDelete: Cascade)

  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  date            DateTime @db.Date  // Day of usage

  // Token counts (provider-agnostic normalized values)
  inputTokens     BigInt   @default(0)
  outputTokens    BigInt   @default(0)
  thinkingTokens  BigInt   @default(0)
  cacheReadTokens BigInt   @default(0)
  toolInvocations Int      @default(0)

  // Provider info (for cost calculation - different providers have different pricing)
  provider        String   @default("anthropic")  // anthropic, openai, google, qwen, kimi
  model           String?  // e.g., "claude-sonnet-4-5", "gpt-4o", "gemini-pro"

  // Cost (calculated based on provider pricing)
  estimatedCostUsd Decimal @db.Decimal(10, 4)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([agentId, date, provider])  // Allow multiple providers per day
  @@index([tenantId, date])
  @@index([provider])
  @@map("usage_records")
}

// Provider pricing configuration (seed data or config)
model ProviderPricing {
  id              String   @id @default(uuid())
  provider        String   // anthropic, openai, google, etc.
  model           String   // claude-sonnet-4-5, gpt-4o, etc.
  inputPer1M      Decimal  @db.Decimal(10, 4)  // Cost per 1M input tokens
  outputPer1M     Decimal  @db.Decimal(10, 4)  // Cost per 1M output tokens
  thinkingPer1M   Decimal? @db.Decimal(10, 4)  // Cost per 1M thinking tokens (if different)
  effectiveFrom   DateTime @default(now())
  effectiveTo     DateTime?

  @@unique([provider, model, effectiveFrom])
  @@map("provider_pricing")
}
```

**Service Requirements:**
```typescript
// backend/src/billing/usage-tracking.service.ts
@Injectable()
export class UsageTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: ProviderPricingService,
  ) {}

  // Record token usage (called after each agent interaction)
  async recordUsage(agentId: string, usage: {
    inputTokens: number;
    outputTokens: number;
    thinkingTokens?: number;
    cacheReadTokens?: number;
    toolInvocations?: number;
    provider: string;  // 'anthropic', 'openai', 'google', etc.
    model: string;     // 'claude-sonnet-4-5', 'gpt-4o', etc.
  }): Promise<void>;

  // Get usage for an agent (current billing period)
  async getAgentUsage(agentId: string): Promise<AgentUsageSummary>;

  // Get usage for a tenant (all agents, all providers)
  async getTenantUsage(tenantId: string): Promise<TenantUsageSummary>;

  // Reset monthly counters (BullMQ scheduled job)
  async resetMonthlyCounters(): Promise<void>;
}

// backend/src/billing/provider-pricing.service.ts
@Injectable()
export class ProviderPricingService {
  // Calculate cost based on provider pricing
  async calculateCost(usage: {
    inputTokens: number;
    outputTokens: number;
    thinkingTokens?: number;
    provider: string;
    model: string;
  }): Promise<number>;

  // Get current pricing for a provider/model
  async getPricing(provider: string, model: string): Promise<ProviderPricing>;
}
```

**Acceptance Criteria:**
- [ ] Create UsageRecord model in Prisma schema
- [ ] Create ProviderPricing model for cost calculation
- [ ] Create UsageExtractorService (provider-agnostic)
- [ ] Create UsageTrackingService with methods above
- [ ] Create ProviderPricingService for cost calculation
- [ ] **Integrate into ChannelProxyProcessor** to capture usage from any LLM response
- [ ] Seed ProviderPricing with Anthropic, OpenAI, Google rates
- [ ] Add BullMQ job to aggregate daily usage
- [ ] Add BullMQ job to reset monthly counters on 1st of month
- [ ] Create BillingModule to house billing services
- [ ] Write unit tests (target: 25+ tests)

**Files to Create:**
- `backend/src/billing/billing.module.ts`
- `backend/src/billing/usage-extractor.service.ts`
- `backend/src/billing/usage-tracking.service.ts`
- `backend/src/billing/provider-pricing.service.ts`
- `backend/src/billing/usage-tracking.processor.ts`
- `backend/prisma/seed-pricing.ts`
- `backend/test/billing/usage-extractor.service.spec.ts`
- `backend/test/billing/usage-tracking.service.spec.ts`

**Files to Modify:**
- `backend/src/channel-proxy/channel-proxy.processor.ts` (inject UsageExtractorService, capture usage)
- `backend/src/channel-proxy/channel-proxy.module.ts` (import BillingModule)

---

### E12-04: Plan-Based Model Tier Validation (5 pts)
**Scope:** Backend
**Dependencies:** E12-01

**Task:**
Enforce model tier restrictions based on tenant plan.

**Business Rules (from pricing-model.md):**
| Plan | Available Models | Thinking Modes |
|------|-----------------|----------------|
| Starter | Sonnet only | Off, Low |
| Growth | Sonnet, Opus | Off, Low, High |
| Enterprise | Haiku, Sonnet, Opus | Off, Low, High |

**Implementation:**
```typescript
// backend/src/dashboard/agents/validators/model-tier.validator.ts
export function validateModelTierForPlan(
  planTier: PlanTier,
  modelTier: ModelTier,
  thinkingMode: ThinkingMode
): { valid: boolean; error?: string } {
  // Implement validation logic
}
```

**Acceptance Criteria:**
- [ ] Create model tier validator function
- [ ] Integrate into agent creation endpoint (POST /api/dashboard/agents)
- [ ] Integrate into agent update endpoint (PUT /api/dashboard/agents/:id)
- [ ] Return 400 Bad Request with clear error when invalid
- [ ] Write unit tests for all plan/model/thinking combinations

**Files to Modify:**
- `backend/src/dashboard/agents/agents.service.ts`
- `backend/src/dashboard/agents/validators/model-tier.validator.ts` (new)
- `backend/test/dashboard/agents/model-tier-validation.spec.ts` (new)

---

### E12-05: Agent Cost Display in Creation Wizard (5 pts)
**Scope:** Frontend
**Dependencies:** E12-04

**Task:**
Show per-agent pricing in the agent creation wizard.

**UI Requirements:**
- Step 2 (Model Selection) should display:
  - Per-agent monthly fee based on selected model
  - "Included" badge if within plan's included agent count
  - Thinking mode surcharge indicator (+$20/mo for High)
  - Total monthly cost impact

**Pricing Data (from pricing-model.md):**
| Model | Per-Agent Fee |
|-------|---------------|
| Haiku | $19/mo |
| Sonnet | $49/mo |
| Opus | $99/mo |

| Plan | Included Agents |
|------|-----------------|
| Starter | 2 Sonnet |
| Growth | 5 Sonnet |
| Enterprise | Negotiated |

**Acceptance Criteria:**
- [ ] Fetch tenant plan and current agent count
- [ ] Display cost per model tier in Step 2
- [ ] Show "Included in plan" badge when applicable
- [ ] Show "+$20/mo" indicator when High thinking mode selected
- [ ] Disable unavailable models based on plan (grayed out with tooltip)
- [ ] Show estimated total monthly impact before confirmation

**Files to Modify:**
- `frontend/src/components/dashboard/agents/agent-creation-wizard.tsx`
- `frontend/src/lib/api/agents.ts` (add billing info to response)
- `backend/src/dashboard/agents/agents.service.ts` (return plan info)

---

### S4-01: Tenant Provisioning Wizard Polish (2 pts)
**Scope:** Frontend

**Task:**
Polish the existing tenant provisioning wizard UX.

**Improvements Needed:**
- Add progress indicator during provisioning steps
- Improve error state display with retry option
- Add loading skeletons during data fetching
- Ensure all form validation messages are clear

**Reference:** `design-artifacts/screens/admin-tenant-provisioning-wizard.html`

**Acceptance Criteria:**
- [ ] Progress steps show current state visually
- [ ] Error states have clear messaging and retry button
- [ ] Loading states use skeleton components
- [ ] Form validation happens on blur, not just submit

**Files to Modify:**
- `frontend/src/components/admin/tenants/tenant-provisioning-wizard.tsx`

---

### S4-02: Config Editor UI Completion (3 pts)
**Scope:** Frontend

**Task:**
Complete the tenant configuration editor in the admin detail page.

**Requirements:**
- JSON/form view toggle (already exists, needs polish)
- Validation errors displayed inline
- Save confirmation with diff preview
- Revert button to restore last saved state

**Acceptance Criteria:**
- [ ] Toggle between JSON and form view works smoothly
- [ ] Validation errors highlight specific fields
- [ ] Save shows confirmation modal with changes
- [ ] Revert button resets to last saved config

**Files to Modify:**
- `frontend/src/components/admin/tenants/tenant-config-editor.tsx`

---

### S4-03: Core Skill Bundle Auto-Install (5 pts)
**Scope:** Backend

**Task:**
Auto-install core skills when provisioning a new tenant.

**Core Skills (from roadmap.yaml E4-F4):**
1. Jira
2. Amplitude
3. Tableau
4. GitHub
5. Sentry
6. Slack
7. Google Calendar
8. Linear
9. Notion
10. Confluence

**Implementation:**
```typescript
// In provisioning processor, after container is ready:
async function installCoreSkillBundle(tenantId: string): Promise<void> {
  const coreSkills = await this.prisma.skill.findMany({
    where: { isCore: true }
  });

  for (const skill of coreSkills) {
    await this.skillService.installSkill(tenantId, skill.id, {
      isCore: true,  // Cannot be uninstalled
      installedBy: 'system'
    });
  }
}
```

**Acceptance Criteria:**
- [ ] Add `isCore` boolean field to Skill model
- [ ] Seed database with 10 core skills (isCore: true)
- [ ] Hook into provisioning processor after container ready
- [ ] Core skills marked as non-removable in UI
- [ ] Core skills installed for ALL agents in tenant by default

**Files to Modify:**
- `backend/prisma/schema.prisma` (add isCore to Skill)
- `backend/prisma/seed.ts` (seed core skills)
- `backend/src/provisioning/provisioning.processor.ts`
- `backend/src/skills/skills.service.ts`

---

### S4-04: Tenant Config Hot-Reload API (5 pts)
**Scope:** Backend

**Task:**
Implement configuration hot-reload that pushes changes to running containers.

**API Endpoint:**
```
PUT /api/tenants/:id/config
Content-Type: application/json

{
  "modelDefaults": {
    "tier": "sonnet",
    "thinkingMode": "low"
  },
  "resourceLimits": {
    "maxAgents": 10,
    "cpuCores": 2,
    "memoryMb": 4096
  }
}
```

**Requirements:**
- Validate config against JSON schema
- Store config version history (for rollback)
- Push to container via DockerOrchestratorService
- Return success/failure with applied config

**Acceptance Criteria:**
- [ ] PUT endpoint validates config schema
- [ ] Config changes stored with version number
- [ ] Changes pushed to running container within 60 seconds
- [ ] Rollback endpoint: PUT /api/tenants/:id/config/rollback
- [ ] Config history endpoint: GET /api/tenants/:id/config/history

**Files to Modify:**
- `backend/src/admin/tenants/tenants.controller.ts`
- `backend/src/admin/tenants/tenants.service.ts`
- `backend/src/container/container-config-sync.service.ts`

---

### S4-05: E2E Happy Path Tests (5 pts)
**Scope:** Testing

**Task:**
Create end-to-end tests covering the main user journey.

**Test Scenarios:**
1. Platform admin provisions new tenant
2. Tenant admin creates agent with tool policies
3. Agent has core skills auto-installed
4. Config change propagates to container

**Tech Stack:** Playwright or Jest + Supertest

**Acceptance Criteria:**
- [ ] Test: Admin login → Create tenant → Verify provisioning
- [ ] Test: Tenant login → Create agent → Verify in list
- [ ] Test: Install skill → Verify agent has skill
- [ ] Test: Update config → Verify container received update
- [ ] Tests run in CI pipeline

**Files to Create:**
- `backend/test/e2e/provisioning.e2e-spec.ts`
- `backend/test/e2e/agent-lifecycle.e2e-spec.ts`
- `backend/test/e2e/skill-installation.e2e-spec.ts`

---

## Dependencies Diagram

```
E12-01 (Plan Tier Schema) ─────┬──> E12-04 (Model Validation) ──> E12-05 (Cost UI)
                               │
E12-02 (Token Tracking) ───────┼──> E12-03 (UsageRecord Service)
                               │
S4-03 (Core Skills) ───────────┘

S4-01 (Wizard Polish) ─────────> (independent)
S4-02 (Config Editor) ─────────> (independent)
S4-04 (Hot-Reload API) ────────> (independent)
S4-05 (E2E Tests) ─────────────> (run last, after all features)
```

---

## Sprint Exit Criteria

Before marking Sprint 4 complete, verify:

- [ ] New tenants have planTier field set correctly
- [ ] Agent creation validates model tier against plan
- [ ] Agent creation wizard shows pricing information
- [ ] New tenants get 10 core skills auto-installed
- [ ] Config changes hot-reload to containers within 60 seconds
- [ ] E2E test suite passes: provision → agent → skill → config
- [ ] All new code has unit tests (target: 80%+ coverage)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] All existing tests still pass (`npm test`)

---

## Technical Notes

### Running the Backend
```bash
cd backend
npm install
npx prisma migrate dev
npm run start:dev
```

### Running Tests
```bash
npm test                    # Unit tests
npm run test:e2e           # E2E tests
npm run test:cov           # Coverage report
```

### Database Migrations
```bash
npx prisma migrate dev --name "add-billing-fields"
npx prisma generate
```
