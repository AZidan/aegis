# Phase 2 Priority Analysis: Coordination & Security

**Version:** 1.0.0
**Date:** 2026-02-08
**Status:** Proposal for Review
**Covers:** Epics E7, E8, E9, E10, E11 (Channel Integration) + New Features

---

## 1. MVP State Assessment

### What We Built (Complete)

| Area | Status | Details |
|------|--------|---------|
| **Auth & RBAC** | Complete | JWT + MFA/TOTP + OAuth (Google/GitHub) + 3 roles |
| **Tenant Lifecycle** | Complete | CRUD, provisioning (BullMQ), config versioning, health monitoring |
| **Agent Management** | Complete | CRUD, 8 tool categories, role defaults, plan limits |
| **Skill Marketplace** | Complete | Catalog, browse, install/uninstall, core bundle auto-install |
| **Admin Dashboard** | Complete | Login+MFA, tenant list, tenant detail (5 tabs), provisioning wizard |
| **Tenant Dashboard** | Complete | OAuth login, agent dashboard, agent creation wizard (5 steps), skill marketplace |
| **Testing** | Complete | 500+ unit/integration tests, 18 E2E happy path tests |

### Existing Audit & Security Foundations

The Prisma schema already defines comprehensive audit infrastructure that has NOT been implemented as a NestJS module:

- **AuditLog model**: Full schema with actor type/id/name, action, target type/id, details (JSONB), severity, IP/user-agent, tenant scoping, timestamps, and proper indexes.
- **Enums defined**: `AuditActorType` (user/agent/system), `AuditTargetType` (agent/skill/tenant/user/team_member/api_key), `AuditSeverity` (info/warning/error).
- **Alert model**: Severity (info/warning/critical), tenant-scoped, resolution tracking.
- **Skill permissions field**: Skills already have a `permissions` JSONB column with `{ network: string[], files: string[], env: string[] }` structure.

This means E8 (Audit Trail) and parts of E9 (Skill Permission Manifests) are NOT greenfield -- the data model exists, but the service layer, API endpoints, interceptors, and UI are missing.

### What Does NOT Exist Yet

- No AuditLog NestJS module/service/controller
- No audit interceptor writing to AuditLog table on API mutations
- No inter-agent communication infrastructure (no message model, no relay service)
- No skill permission runtime enforcement
- No network policy enforcement
- No secret/credential vault
- No custom skill SDK or private registry

---

## 2. Epic Priority Re-Evaluation

### Original Priorities (from roadmap.yaml)

| Epic | Original Priority | Original Effort |
|------|-------------------|-----------------|
| E7: Inter-Agent Communication | P1 | 3 weeks |
| E8: Audit Trail & Compliance | P0 | 3 weeks |
| E9: Advanced Security & Isolation | P1 | 3-4 weeks |
| E10: Custom Skill Development | P1 | 3 weeks |

### Re-Evaluated Priorities

| Epic | New Priority | Rationale |
|------|-------------|-----------|
| **E8: Audit Trail** | **P0 (unchanged, Sprint 5)** | Foundation for everything else. Security alerting feeds E9. Compliance data feeds analytics. Breadfast pilot needs audit logs for their security review. Schema exists -- implementation effort is reduced. |
| **E7: Inter-Agent Communication** | **P0 (upgraded from P1, Sprint 6)** | KEY DIFFERENTIATOR per strategy. Anthropic Cowork is single-agent; our multi-agent coordination is the moat. Breadfast COO persona explicitly needs "PM + CS + Ops agents working together." Must ship before Phase 3 self-service launch. |
| **E10: Custom Skill Development** | **P1 (unchanged, Sprint 7)** | Breadfast specifically needs custom skills for their internal APIs. Skill marketplace is functional -- SDK builds on solid foundation. Private registry enables enterprise value prop. Depends on E9-F1 (permission manifests). |
| **E9: Advanced Security & Isolation** | **P1 (unchanged, Sprint 7-8)** | Permission manifests are prerequisite for E10 custom skills. Network policy enforcement critical before enterprise customers. Secret rotation is P2 (defer to late Phase 2 or Phase 3). |

### Key Adjustments

1. **E7 elevated to P0**: Inter-agent communication is the single biggest differentiator against Anthropic Cowork. Without it, we are "just another agent platform." Moving it to Sprint 6 (immediately after audit trail) ensures we have audit logging for all inter-agent messages from day one.

2. **E8 effort reduced**: Schema and enums already exist in Prisma. We need the service layer, interceptor, API endpoints, and UI -- but not the data model design. Estimated reduction from 3 weeks to 2 weeks of implementation.

3. **E9-F3 (Secret Rotation) deferred to P2**: Credential vault is complex and not needed for Breadfast pilot or early enterprise conversations. Can ship in Phase 3 alongside billing infrastructure. Permission manifests (E9-F1) and network policies (E9-F2) remain P1.

4. **E9-F4 (Tenant Data Encryption) deferred**: PostgreSQL 16 provides TDE, Docker volumes support encryption-at-rest natively. This is infrastructure configuration, not application code. Move to Phase 3 DevOps sprint.

---

## 3. New Features Identified

### NEW: E7-F4 -- Agent Communication Graph (Visual Allowlist Editor)

**Rationale**: The existing roadmap has E5-F5 (Communication Allowlist Configuration) as an MVP feature that was deprioritized. Inter-agent messaging (E7) requires this UI for configuration. We consolidate E5-F5 into E7 as E7-F4.

**User Story**: As a Tenant Admin, I want to visually configure which agents can communicate with each other using an interactive graph so that I can control information flow between agent roles.

### NEW: E8-F5 -- Audit Log Retention & Archival

**Rationale**: The Prisma schema notes mention "90 days hot, 1 year cold" data retention but there is no implementation. Enterprise customers will ask about data retention policies during security reviews. Should be a backend-only cleanup job.

### NEW: E7-F5 -- WebSocket Real-Time Message Feed

**Rationale**: The platform already uses WebSocket patterns (health monitoring UI). Inter-agent messages should stream in real-time to the dashboard. Without this, the message dashboard (E7-F3) requires polling, which is poor UX.

### MODIFIED: E10-F3 -- Skill Testing Sandbox (Simplified to "Skill Dry-Run")

**Rationale**: A full sandbox environment is Phase 4 complexity. For Phase 2, we deliver a "dry-run" mode where custom skills are validated against their permission manifest without a full isolated environment. Rename to "Skill Validation & Dry-Run."

---

## 4. Feature Deferral Decisions

| Feature | Decision | Rationale |
|---------|----------|-----------|
| E9-F3: Secret Rotation | Defer to Phase 3 | Complex vault integration; not blocking pilot |
| E9-F4: Tenant Data Encryption | Defer to Phase 3 | Infrastructure config, not application code |
| E7-F2: Coordination Workflows | Partial (templates only) | Full workflow engine is Phase 3; ship 3 templates with manual trigger |
| E10-F3: Full Sandbox | Simplify to dry-run | Full sandbox is Phase 4; dry-run validates permissions |
| E5-F5: Communication Allowlist | Absorbed into E7-F4 | Consolidated into inter-agent epic |

---

## 5. Market Intelligence Considerations

### Anthropic Cowork (January 2026)

- **Single autonomous agent** -- no multi-agent coordination
- **No enterprise multi-tenancy** -- shared infrastructure
- **No skill marketplace** -- built-in integrations only
- **Our response**: Accelerate E7 (inter-agent) to widen the differentiation gap. Cowork cannot match coordinated agent teams.

### OpenAI Agents SDK (Early 2026)

- **Developer toolkit** -- requires engineering resources
- **No managed platform** -- DIY deployment
- **Our response**: E10 (Custom Skill SDK) positions us as "managed platform with custom extensibility." Developers get SDK convenience without ops burden.

### Breadfast Pilot Feedback

- **Positive**: Nadia PM agent proving value (Jira/Amplitude/Tableau integration working)
- **Request**: "Can Nadia coordinate with the Engineering agent on sprint handoffs?"
- **Request**: "We need audit logs for our internal security review"
- **Request**: "Can we build a custom skill for our internal delivery routing API?"
- **Implication**: E7, E8, E10 are all directly requested by pilot customer

### Enterprise Prospect Pipeline

- 2 enterprise prospects in security review stage -- both asking for:
  1. Audit trail of all agent actions (E8)
  2. Permission manifests for installed skills (E9-F1)
  3. Network egress controls (E9-F2)
- Without E8 and E9, these deals cannot close

---

## 6. Dependencies Refined

```
E8 (Audit Trail)
  |
  +---> E7 (Inter-Agent Communication)  [needs audit logging from day 1]
  |       |
  |       +---> E7-F3 (Message Dashboard)  [needs message data]
  |       +---> E7-F4 (Allowlist Graph)    [needs agent relationships]
  |
  +---> E9-F1 (Permission Manifests)   [violations logged to audit]
  |       |
  |       +---> E9-F2 (Network Policy)  [needs manifests for allowed domains]
  |       |
  |       +---> E10-F1 (Skill SDK)     [SDK enforces manifest format]
  |               |
  |               +---> E10-F2 (Private Registry)  [stores custom skills]
  |               +---> E10-F3 (Skill Dry-Run)     [validates against manifest]
  |
  +---> E8-F3 (Audit Log Viewer)       [UI for browsing logs]
  +---> E8-F4 (Security Alerting)      [alert rules consume audit events]
```

The critical path is: **E8 -> E7 -> E9-F1 -> E10**. This drives the sprint sequencing.
