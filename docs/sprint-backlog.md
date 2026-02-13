# Aegis Platform - Sprint Backlog

**Last Updated:** 2026-02-13
**Status:** Phase 3 - Implementation (In Progress)
**Total Remaining:** 35 stories | 200 story points
**Estimated Duration:** 10-16 weeks (depending on velocity)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Stories Remaining | 35 |
| Total Story Points | 200 |
| Sprints Planned | 5 (S4-S8) |
| Critical Path | Config → Audit → Messaging → Dashboard → SDK (42 pts) |
| New Epic Added | E12: Billing & Usage Tracking (from pricing-model.md) |

---

## Stories by Size (Sorted Lightest → Heaviest)

### 2 Point Stories (< 1 day)

| ID | Story | Scope | Sprint | Notes |
|----|-------|-------|--------|-------|
| S4-01 | Tenant Provisioning Wizard Polish | Frontend | S4 | Wizard exists; needs progress indicator improvements and error states |

---

### 3 Point Stories (1-2 days)

| ID | Story | Scope | Sprint | Notes |
|----|-------|-------|--------|-------|
| S4-02 | Config Editor UI Completion | Frontend | S4 | JSON/form toggle exists; add validation display, save confirmation |
| S5-01 | DB Migration for Messaging Tables | Backend | S5 | AgentMessage, AgentAllowlist models exist; need migration |
| S6-01 | Audit Log Retention Job | Backend | S6 | BullMQ daily job to archive logs > 90 days |
| E12-01 | Plan Tier Schema Migration | Backend | S4 | Add `planTier`, `overageBillingEnabled`, `monthlyTokenQuota` to Tenant |
| E12-02 | Agent Token Tracking Fields | Backend | S4 | Add `monthlyTokensUsed`, `monthlyTokenQuotaOverride` to Agent |

---

### 5 Point Stories (3-5 days)

| ID | Story | Scope | Sprint | Notes |
|----|-------|-------|--------|-------|
| S4-03 | Core Skill Bundle Auto-Install | Backend | S4 | Hook into provisioning processor; seed 10 core skills; mark as non-removable |
| S4-04 | Tenant Config Hot-Reload API | Backend | S4 | `PUT /tenants/:id/config` with schema validation, push to container, versioning |
| S4-05 | E2E Happy Path Tests | Testing | S4 | Playwright/Cypress: provision → create agent → install skill → verify |
| S5-02 | Admin Operation Audit Logging | Backend | S5 | Global interceptor for mutations; login/logout events; config diff tracking |
| S5-03 | Agent Action Audit Logging | Backend | S5 | Tool invocations, status changes, skill operations; sanitized payloads |
| S5-04 | Audit Module Unit Tests | Testing | S5 | 60+ tests for AuditService, interceptor, BullMQ writer |
| S6-02 | WebSocket Real-Time Message Feed | Backend | S6 | `/ws/messages` endpoint; tenant-scoped; auth via JWT |
| S6-03 | Security Event Alerting | Backend | S6 | Rules engine (5+ failed logins, policy violations); webhook delivery |
| S7-01 | Coordination Workflow Templates | Backend | S7 | 3 templates (daily_sync, weekly_standup, sprint_handoff); trigger API |
| S8-01 | Skill Validation & Dry-Run | Backend | S8 | Static analysis; sandbox test execution; security checklist |
| S8-02 | Security Posture Dashboard | Frontend | S8 | Admin view; aggregate security metrics; compliance checklist |
| S8-03 | E2E Phase 2 Tests | Testing | S8 | Audit, messaging, skills, security flows |
| E12-03 | UsageRecord Table & Tracking Service | Backend | S4 | New table, BullMQ aggregation job for token counting |
| E12-04 | Plan-Based Model Tier Validation | Backend | S4 | Enforce Starter=Sonnet only, Growth=Sonnet+Opus, etc. |
| E12-05 | Agent Cost Display in Creation Wizard | Frontend | S4 | Show "$49/mo" or "Included" badge based on plan |
| E12-06 | Token Usage Warning System | Backend | S5 | 80/100/120/150% thresholds, email notifications |
| E12-07 | Overage Billing Toggle API | Backend | S5 | Growth/Enterprise opt-in for pay-as-you-go |

---

### 8 Point Stories (1 week)

| ID | Story | Scope | Sprint | Notes |
|----|-------|-------|--------|-------|
| S5-05 | Audit Service Core | Backend | S5 | AuditModule, AuditService, global interceptor, async BullMQ writer |
| S6-04 | Audit Log Viewer UI | Full-stack | S6 | Table with filters, pagination, expandable entries, export CSV/JSON |
| S7-02 | Communication Allowlist Graph Editor | Frontend | S7 | Interactive graph (React Flow); add/remove links; sync to container |
| S7-03 | Inter-Agent Message Dashboard | Frontend | S7 | Timeline view; filter by agent/type/date; visual flow diagram |
| S7-04 | Skill Permission Manifests | Full-stack | S7 | Schema design; validation on submit; runtime logging; dashboard display |
| S8-04 | Skill Development SDK | Backend | S8 | `@aegis/skill-sdk` npm package; CLI scaffold; documentation |
| S8-05 | Private Skill Registry | Full-stack | S8 | Tenant-scoped custom skills; versioning; approval workflow |
| S8-06 | Network Policy Enforcement | Backend | S8 | K8s NetworkPolicy generation from manifests; blocked request logging |
| E12-08 | Billing Overview API | Backend | S5 | `GET /dashboard/billing/overview` - plan, agents, costs |
| E12-09 | Billing Usage API | Backend | S5 | `GET /dashboard/billing/usage` - per-agent token consumption |
| E12-10 | Billing Dashboard UI | Frontend | S6 | Full billing page per pricing-model.md spec |

---

### 13 Point Stories (1.5-2 weeks)

| ID | Story | Scope | Sprint | Notes |
|----|-------|-------|--------|-------|
| S6-05 | Structured Inter-Agent Messaging API | Backend | S6 | 5 message types; schema validation; allowlist enforcement; delivery tracking; error handling |

---

## Sprint Plans

### Sprint 4: Config, Skills & Billing Foundation

**Goal:** Complete MVP polish, add billing infrastructure, core skill auto-installation
**Total Points:** 41
**Duration:** 2 weeks

| ID | Story | Pts | Owner | Dependencies |
|----|-------|-----|-------|--------------|
| E12-01 | Plan Tier Schema Migration | 3 | BE | None (start first) |
| E12-02 | Agent Token Tracking Fields | 3 | BE | None (start first) |
| S4-01 | Provisioning Wizard Polish | 2 | FE | None |
| S4-02 | Config Editor Completion | 3 | FE | None |
| S4-03 | Core Skill Bundle | 5 | BE | E12-01 |
| S4-04 | Config Hot-Reload API | 5 | BE | None |
| E12-03 | UsageRecord & Tracking Service | 5 | BE | E12-01, E12-02 |
| E12-04 | Plan-Based Model Validation | 5 | BE | E12-01 |
| E12-05 | Agent Cost in Wizard | 5 | FE | E12-04 |
| S4-05 | E2E Happy Path Tests | 5 | QA | All above |

**Deliverables:**
- Billing schema in place (planTier, token tracking, UsageRecord)
- Core skills auto-installed on new tenant provisioning
- Configuration hot-reload working
- Agent creation shows pricing
- E2E tests covering happy path

---

### Sprint 5: Audit & Billing APIs

**Goal:** Audit trail foundation, billing APIs, usage monitoring
**Total Points:** 49
**Duration:** 2 weeks

| ID | Story | Pts | Owner | Dependencies |
|----|-------|-----|-------|--------------|
| S5-01 | DB Migration for Messaging | 3 | BE | None (start first) |
| S5-05 | Audit Service Core | 8 | BE | None |
| S5-02 | Admin Audit Logging | 5 | BE | S5-05 |
| S5-03 | Agent Audit Logging | 5 | BE | S5-05 |
| E12-06 | Token Usage Warnings | 5 | BE | E12-03 (S4) |
| E12-07 | Overage Billing Toggle | 5 | BE | E12-01 (S4) |
| E12-08 | Billing Overview API | 8 | BE | E12-03 (S4) |
| E12-09 | Billing Usage API | 8 | BE | E12-03 (S4) |
| S5-04 | Audit Tests | 5 | QA | S5-02, S5-03 |

**Deliverables:**
- AuditModule with global interceptor
- Admin and agent operations logged
- Token usage warning system (80/100/120/150%)
- Billing APIs ready for frontend

---

### Sprint 6: Messaging, Audit UI & Billing UI

**Goal:** Inter-agent messaging, audit viewer, billing dashboard
**Total Points:** 42
**Duration:** 2 weeks

| ID | Story | Pts | Owner | Dependencies |
|----|-------|-----|-------|--------------|
| S6-05 | Inter-Agent Messaging API | 13 | BE | S5-01 |
| S6-02 | WebSocket Feed | 5 | BE | S6-05 |
| S6-04 | Audit Log Viewer UI | 8 | FE | S5-05 |
| E12-10 | Billing Dashboard UI | 8 | FE | E12-08, E12-09 |
| S6-03 | Security Alerting | 5 | BE | S5-05 |
| S6-01 | Audit Retention Job | 3 | BE | S5-05 |

**Deliverables:**
- Inter-agent messaging with allowlist enforcement
- WebSocket real-time message feed
- Audit log viewer in both dashboards
- Full billing dashboard per pricing-model.md

---

### Sprint 7: Communication Dashboard & Security Hardening

**Goal:** Communication graph, message dashboard, permission manifests
**Total Points:** 29
**Duration:** 2 weeks

| ID | Story | Pts | Owner | Dependencies |
|----|-------|-----|-------|--------------|
| S7-02 | Allowlist Graph Editor | 8 | FE | S6-05 |
| S7-03 | Message Dashboard | 8 | FE | S6-05, S6-02 |
| S7-04 | Permission Manifests | 8 | Full | None |
| S7-01 | Workflow Templates | 5 | BE | S6-05 |

**Deliverables:**
- Interactive agent communication graph
- Message timeline dashboard with real-time updates
- Permission manifest validation pipeline
- 3 workflow templates with trigger API

---

### Sprint 8: Custom Skills SDK & Network Security

**Goal:** Skill SDK, private registry, network policies, Phase 2 E2E
**Total Points:** 39
**Duration:** 2 weeks

| ID | Story | Pts | Owner | Dependencies |
|----|-------|-----|-------|--------------|
| S8-04 | Skill SDK | 8 | BE | S7-04 |
| S8-05 | Private Skill Registry | 8 | Full | S8-04 |
| S8-06 | Network Policy Enforcement | 8 | BE | S7-04 |
| S8-01 | Skill Validation | 5 | BE | S8-04 |
| S8-02 | Security Posture Dashboard | 5 | FE | S7-04 |
| S8-03 | E2E Phase 2 | 5 | QA | All above |

**Deliverables:**
- `@aegis/skill-sdk` npm package with CLI
- Private skill registry with versioning
- Network policy generation from manifests
- Security posture dashboard
- Phase 2 E2E test suite

---

## Dependency Graph

```
Sprint 4 (Foundation)
├── E12-01 Plan Tier Migration ──────┬──> E12-04 Model Validation ──> E12-05 Cost in Wizard
├── E12-02 Token Tracking ───────────┼──> E12-03 UsageRecord Service
│                                    │         │
│                                    │         v
Sprint 5 (Audit & Billing)           │    E12-06 Usage Warnings
├── S5-01 Messaging DB ──────────────│──> S6-05 Messaging API
├── S5-05 Audit Core ────────────────┼──> S5-02 Admin Audit ──> S5-04 Tests
│         │                          │──> S5-03 Agent Audit ──┘
│         │                          │
│         v                          └──> E12-08 Billing Overview API ──> E12-10 Billing UI
│    S6-03 Security Alerts                E12-09 Billing Usage API ──────┘
│    S6-01 Retention Job
│    S6-04 Audit Viewer UI
│
Sprint 6 (Messaging & UI)
├── S6-05 Messaging API ─────────────────> S7-02 Allowlist Graph
│         │                                S7-03 Message Dashboard
│         v                                S7-01 Workflow Templates
│    S6-02 WebSocket Feed
│
Sprint 7 (Security)
├── S7-04 Permission Manifests ──────────> S8-04 Skill SDK ──> S8-05 Private Registry
│                                          S8-06 Network Policies
│                                          S8-01 Skill Validation
│                                          S8-02 Security Dashboard
│
Sprint 8 (SDK & Network)
└── S8-03 E2E Phase 2 (depends on all)
```

---

## Critical Path

The longest dependency chain determines minimum completion time:

```
E12-01 → E12-03 → E12-08 → E12-10 → S6-05 → S7-03 → S8-04 → S8-03
Plan     Usage    Billing   Billing  Messaging Dashboard  SDK    E2E
(3)      (5)      (8)       (8)      (13)      (8)       (8)    (5)
                                                              = 58 pts
```

**Minimum critical path:** ~6-7 weeks with dedicated resources on critical items.

---

## Team Allocation Recommendation

| Role | Sprint 4 | Sprint 5 | Sprint 6 | Sprint 7 | Sprint 8 |
|------|----------|----------|----------|----------|----------|
| **BE-1** | E12-01, E12-02, E12-03 | S5-05, S5-02 | S6-05 | S7-04 | S8-04, S8-01 |
| **BE-2** | S4-03, S4-04, E12-04 | E12-06, E12-07, E12-08 | S6-02, S6-03, S6-01 | S7-01 | S8-06 |
| **FE-1** | S4-01, S4-02 | -- | S6-04 | S7-02 | S8-02 |
| **FE-2** | E12-05 | -- | E12-10 | S7-03 | S8-05 |
| **QA** | S4-05 | S5-04, S5-01 | -- | -- | S8-03 |

---

## Velocity Projections

| Velocity | Sprints | Duration | Notes |
|----------|---------|----------|-------|
| 25 pts/sprint | 8 | 16 weeks | Conservative (1 FE, 1 BE) |
| 30 pts/sprint | 7 | 14 weeks | Normal (1 FE, 2 BE) |
| 40 pts/sprint | 5 | 10 weeks | Aggressive (2 FE, 2 BE, 1 QA) |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| S6-05 (13 pts) is too large | Blocks S7 | Split into 2 stories if needed |
| Billing APIs delay monetization | Revenue impact | Prioritize E12 in S4/S5 |
| Permission manifests complexity | Security gaps | Start research in S6 |
| Network policy K8s expertise | Delayed S8 | Engage DevOps early |

---

## Acceptance Criteria Summary

### Sprint 4 Exit Criteria
- [ ] New tenants get 10 core skills auto-installed
- [ ] Config changes hot-reload to containers
- [ ] Agent creation shows per-agent pricing
- [ ] E2E test passes: provision → agent → skill

### Sprint 5 Exit Criteria
- [ ] All admin mutations logged with actor
- [ ] All agent tool invocations logged
- [ ] Token usage warnings sent at 80% threshold
- [ ] Billing APIs return accurate data

### Sprint 6 Exit Criteria
- [ ] Agents can send structured messages to allowed peers
- [ ] Audit log viewer works in both dashboards
- [ ] Billing dashboard matches pricing-model.md spec

### Sprint 7 Exit Criteria
- [ ] Communication graph editable with drag-and-drop
- [ ] Message timeline shows real-time updates
- [ ] Skills require permission manifests

### Sprint 8 Exit Criteria
- [ ] `npx @aegis/skill-sdk init` scaffolds new skill
- [ ] Tenants can upload private skills
- [ ] Network egress blocked for undeclared domains
- [ ] Phase 2 E2E suite passes

---

## References

- `project-context.md` - Business goals and architecture
- `roadmap.yaml` - Full epic and feature definitions
- `current-phase.yaml` - Phase state tracker
- `docs/pricing-model.md` - Billing requirements (E12 source)
- `docs/api-contract.md` - API specifications

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-02-13 | Claude | Initial backlog created from roadmap analysis |
| 2026-02-13 | Claude | Added E12 (Billing) epic from pricing-model.md |
