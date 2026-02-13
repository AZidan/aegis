# Aegis Platform -- Pricing Model

**Last Updated:** 2026-02-11
**Document Owner:** Strategy & Product Team
**Status:** Draft -- Pending team review
**References:** project_context.md, roadmap.yaml (E12), design-artifacts/user-flows.md (Flows 1.1, 2.2, 4.2)

---

## 1. Design Principles

1. **Predictable for customers** -- Tenants should know their monthly bill before it arrives. No surprise overages.
2. **Margin-safe for us** -- Model cost differences (Haiku is 5x cheaper than Opus) must not erode margins on flat plans.
3. **Simple to explain** -- A VP of Product or COO should understand the pricing in under 60 seconds.
4. **Upsell-aligned** -- Higher model tiers and more agents naturally push customers to higher plans.

---

## 2. Anthropic API Cost Basis (Feb 2026)

Current Claude API rates that define our cost floor:

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Relative Cost |
|-------|----------------------|------------------------|---------------|
| Haiku 4.5 | $1.00 | $5.00 | 1x (baseline) |
| Sonnet 4.5 | $3.00 | $15.00 | 3x |
| Opus 4.5 | $5.00 | $25.00 | 5x |

**Thinking mode multiplier:** Extended thinking tokens are billed at output rates. High thinking mode can 2-5x the effective cost per request.

**Batch discount:** 50% off both input/output (applicable for non-real-time workloads).

**Prompt caching:** Cache reads at 0.1x input price (significant savings for agents with stable system prompts).

> Source: [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing)

---

## 3. Recommended Model: Hybrid (Platform Fee + Model-Tiered Agent Pricing)

After reviewing market trends (Chargebee, Deloitte, Orb research on AI agent pricing in 2026), the recommended approach is a **hybrid model** combining:

- **Platform fee** (fixed monthly subscription) -- covers infrastructure, support, dashboard access
- **Per-agent fee** (varies by model tier) -- covers actual LLM compute costs with healthy margin

This aligns with the industry shift away from pure per-seat pricing toward value-based agent pricing, while keeping costs predictable for customers.

### 3.1 Plan Structure

| | Starter | Growth | Enterprise |
|---|---------|--------|------------|
| **Platform Fee** | $99/mo | $299/mo | Custom |
| **Included Agents** | 2 Sonnet agents | 5 Sonnet agents | Negotiated |
| **Max Agents** | 5 | 20 | Unlimited |
| **Available Models** | Sonnet | Sonnet, Opus | Haiku, Sonnet, Opus |
| **Per Additional Agent** | See agent pricing | See agent pricing | Volume discount |
| **Thinking Mode** | Off, Low | Off, Low, High | Off, Low, High |
| **Support** | Email | Email + Chat | Dedicated CSM |
| **Audit Log Retention** | 30 days | 90 days | 1 year |
| **Custom Skills** | -- | 5 private skills | Unlimited |
| **Channels** | 1 (Slack or Telegram) | Unlimited | Unlimited |

### 3.2 Per-Agent Monthly Pricing

Each agent beyond the included count is billed monthly based on its assigned model tier:

| Model Tier | Per-Agent Fee | What's Included | Our Estimated Cost | Margin |
|-----------|---------------|-----------------|-------------------|--------|
| **Haiku** | $19/mo | ~2M input + ~500K output tokens/mo | ~$4.50 | ~76% |
| **Sonnet** | $49/mo | ~2M input + ~500K output tokens/mo | ~$13.50 | ~72% |
| **Opus** | $99/mo | ~2M input + ~500K output tokens/mo | ~$22.50 | ~77% |

**Token quota per agent:** ~2M input + ~500K output tokens/month (covers ~100-150 substantive agent interactions/day). This is a soft cap -- see Section 4 for overage handling.

**Thinking mode surcharge:**
- Low thinking: included in base agent fee
- High thinking: +$20/mo per agent (covers ~3x output token increase)

### 3.3 Effective Monthly Cost Examples

| Scenario | Plan | Agents | Monthly Cost |
|----------|------|--------|-------------|
| Small PM team | Starter | 2 Sonnet (included) | **$99** |
| Growing PM team | Starter | 2 Sonnet (included) + 2 additional Sonnet | **$197** ($99 + 2x$49) |
| Cross-functional team | Growth | 5 Sonnet (included) + 3 Opus | **$596** ($299 + 3x$99) |
| Cost-optimized enterprise | Enterprise | 10 Haiku + 5 Sonnet + 2 Opus | **Custom** (volume pricing) |
| Breadfast pilot (current) | Growth | 3 Sonnet + 1 Opus (Nadia) | **$348** ($299 + 0 additional -- within included 5) |

---

## 4. Overage & Fair Use Policy

### 4.1 Soft Token Caps (Not Hard Cutoffs)

Each agent includes a monthly token quota. When a tenant approaches or exceeds the quota:

| Threshold | Action |
|-----------|--------|
| **80%** | Dashboard warning banner + email to tenant admin |
| **100%** | Email notification; agent continues working (grace zone) |
| **120%** | Agent rate-limited (slower responses, queued requests) |
| **150%** | Agent paused; tenant admin must acknowledge to resume or upgrade |

**Why soft caps, not hard cutoffs:** Cutting off an agent mid-task destroys trust. The grace zone (100-120%) lets agents finish in-progress work while the admin decides whether to upgrade.

### 4.2 Overage Billing (Growth + Enterprise Only)

For Growth and Enterprise plans, tenants can opt into **pay-as-you-go overage** instead of rate limiting:

| Model | Overage Rate (per 1M tokens) | Notes |
|-------|------------------------------|-------|
| Haiku | $8.00 input / $8.00 output | ~1.3x our cost |
| Sonnet | $5.00 input / $20.00 output | ~1.3x our cost |
| Opus | $8.00 input / $35.00 output | ~1.4x our cost |

Overage is opt-in. Default behavior is rate limiting at 120%.

### 4.3 Starter Plan -- No Overage Option

Starter plan tenants cannot enable pay-as-you-go. They must upgrade to Growth to unlock overage billing. This is an intentional upsell lever.

---

## 5. How This Flows Through the Product

### 5.1 Tenant Provisioning (Platform Admin -- Flow 1.1)

```
Wizard Step 2: Plan Selection
  ├── Select plan tier: Starter / Growth / Enterprise
  ├── Plan determines: included agents, available models, features
  └── No per-model pricing shown here -- this is plan-level only
```

### 5.2 Agent Creation (Tenant Admin -- Flow 2.2)

```
Wizard Step 2: Model Tier Selection
  ├── Model dropdown: filtered by plan (Starter sees only Sonnet)
  ├── Thinking mode: filtered by plan (Starter sees only Off/Low)
  ├── Cost indicator: "$49/mo" or "Included in plan" if within included count
  └── If over included count: "This agent will add $49/mo to your bill"
```

### 5.3 Billing Dashboard (Tenant Admin -- Flow 4.2)

```
Billing Overview:
  ├── Platform fee: $299/mo (Growth)
  ├── Included agents: 5 Sonnet (no extra charge)
  ├── Additional agents: 2 Opus x $99 = $198/mo
  ├── Thinking surcharge: 1 agent x High = $20/mo
  ├── Overage (if opted in): $12.40 (last month)
  ├── Subtotal: $529.40/mo
  └── Next billing date: March 1, 2026
```

---

## 6. Implementation Requirements

### 6.1 Database Schema Additions

```
Tenant:
  planTier: enum (starter, growth, enterprise)
  overageBillingEnabled: boolean (default: false)
  monthlyTokenQuota: bigint (derived from plan + agent count)

Agent:
  modelTier: enum (haiku, sonnet, opus)         # already exists
  thinkingMode: enum (off, low, high)           # already exists
  monthlyTokensUsed: bigint                     # needs tracking
  monthlyTokenQuotaOverride: bigint | null      # enterprise custom

UsageRecord (new):
  agentId, tenantId, date
  inputTokens, outputTokens, thinkingTokens
  toolInvocations, estimatedCostUsd
```

### 6.2 API Contract Changes

These endpoints need cost/billing awareness:

| Endpoint | Change |
|----------|--------|
| `POST /api/tenants/:id/agents` | Validate model tier against plan; return cost impact |
| `PUT /api/tenants/:id/agents/:agentId` | Model tier change recalculates billing |
| `GET /api/dashboard/billing/overview` | New -- returns current plan, agent costs, usage |
| `GET /api/dashboard/billing/usage` | New -- per-agent token consumption + overage |
| `GET /api/dashboard/agents` | Include `costPerMonth` field in agent response |

### 6.3 Agent Creation Wizard Changes

- Step 2 (Model Selection) must show:
  - Per-agent monthly fee based on selected model
  - "Included" badge if within plan's included agent count
  - Thinking mode surcharge indicator
  - Estimated monthly total impact on bill

---

## 7. Competitive Positioning

| Platform | Model | Our Advantage |
|----------|-------|---------------|
| **Anthropic Cowork** | Subscription ($100-200/mo for single agent) | We offer multi-agent teams at comparable per-agent cost |
| **Relevance AI** | Per-action ($0.01-0.05/action) | Our flat per-agent fee is more predictable |
| **DIY OpenClaw** | Raw API costs only (~$13-22/mo for Sonnet agent) | We charge 2-3x raw cost but include platform, security, dashboard |
| **Intercom Fin** | $0.99/resolved conversation | Outcome-based; we're infrastructure, not task-specific |

Our pricing sweet spot: **2-4x raw API cost** for the platform value (isolation, dashboard, audit, marketplace, channels). This is comparable to how managed database services (RDS, PlanetScale) price vs. self-hosted.

> Market research sources:
> - [Chargebee: Pricing AI Agents Playbook](https://www.chargebee.com/blog/pricing-ai-agents-playbook/)
> - [Deloitte: SaaS meets AI agents](https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2026/saas-ai-agents.html)
> - [Orb: Pricing AI agents](https://www.withorb.com/blog/pricing-ai-agents)
> - [AIMultiple: From SaaS to AI Agent Seats](https://research.aimultiple.com/ai-agent-pricing/)

---

## 8. Open Questions for Team Discussion

1. **Free trial scope:** 14 days with 2 Sonnet agents (as in roadmap.yaml E11-F1). Should trial include token quota or be unlimited for the trial period?

2. **Annual discount:** Roadmap mentions 20% annual discount. Does this apply to both platform fee AND per-agent fees, or platform fee only?

3. **Enterprise volume pricing:** What discount tiers? Suggestion: 10-20 agents = 10% off, 20-50 = 20% off, 50+ = custom negotiation.

4. **Model tier switching:** Can a tenant admin change an agent's model mid-month? If so, is billing prorated daily or does the higher tier apply for the full month?

5. **Breadfast pilot pricing:** What plan/pricing applies during the pilot period? Grace period before enforcing production pricing?

6. **Thinking mode granularity:** Current design has Off/Low/High. Should "High" be restricted to Opus-only plans, or available on any model tier for a surcharge?

---

## 9. Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-02-11 | Strategy & Product | Initial draft -- hybrid pricing model recommendation |
