# Phase 2 Risk Register: Coordination & Security

**Version:** 1.0.0
**Date:** 2026-02-08
**Status:** Active

---

## Risk Scoring

- **Probability**: Low (< 20%), Medium (20-60%), High (> 60%)
- **Impact**: Low (minor delay), Medium (sprint delay), High (phase delay), Critical (project threat)
- **Risk Score**: Probability x Impact (used for prioritization)

---

## Phase 2 Specific Risks

### R8: Audit Interceptor Performance Degradation

| Field | Value |
|-------|-------|
| **ID** | R8 |
| **Category** | Technical |
| **Risk** | Global audit interceptor adds measurable latency to every API response, degrading user experience |
| **Probability** | Medium |
| **Impact** | High |
| **Sprint** | S5 |
| **Mitigation** | Async audit writes via BullMQ -- interceptor enqueues event and returns immediately. Audit write to PostgreSQL happens in background worker. Benchmark: interceptor overhead must be < 5ms P95. |
| **Contingency** | If BullMQ adds overhead, switch to in-process async (fire-and-forget Promise). Worst case: batch audit writes every 5 seconds instead of per-request. |
| **Owner** | Backend Lead |
| **Status** | Open |

### R9: Audit Log Table Growth and Query Performance

| Field | Value |
|-------|-------|
| **ID** | R9 |
| **Category** | Technical |
| **Risk** | Audit log table grows to millions of rows within months, causing slow queries and storage pressure |
| **Probability** | High |
| **Impact** | Medium |
| **Sprint** | S5-S6 |
| **Mitigation** | 1) PostgreSQL table partitioning by month (partition by RANGE on timestamp). 2) Cursor-based pagination (not OFFSET). 3) Composite indexes on (tenantId, timestamp DESC). 4) Daily archival job removes rows > 90 days. |
| **Contingency** | If PostgreSQL partitioning is insufficient, move audit log hot path to TimescaleDB hypertable or Elasticsearch for query-heavy workloads. |
| **Owner** | Backend Lead |
| **Status** | Open |

### R10: Inter-Agent Message Delivery Latency

| Field | Value |
|-------|-------|
| **ID** | R10 |
| **Category** | Technical |
| **Risk** | BullMQ message delivery latency exceeds 2-second P95 target under load, making agent coordination feel sluggish |
| **Probability** | Low |
| **Impact** | High |
| **Sprint** | S6 |
| **Mitigation** | 1) BullMQ priority queues for messages vs. audit events. 2) Redis connection pooling. 3) Load test with 50 concurrent messages before sprint sign-off. 4) Allowlist cached in Redis (not DB lookup per message). |
| **Contingency** | Bypass BullMQ for low-latency path: direct write to AgentMessage + Redis Pub/Sub for notification. BullMQ only for retry/dead-letter handling. |
| **Owner** | Backend Lead |
| **Status** | Open |

### R11: WebSocket Scalability for Real-Time Feed

| Field | Value |
|-------|-------|
| **ID** | R11 |
| **Category** | Technical |
| **Risk** | WebSocket connections do not scale across multiple backend instances, causing missed messages when load-balanced |
| **Probability** | Medium |
| **Impact** | Medium |
| **Sprint** | S6 |
| **Mitigation** | Redis Pub/Sub adapter for NestJS WebSocket gateway (already used by Socket.IO adapter). All instances subscribe to same Redis channel; messages fan out to all connected clients. |
| **Contingency** | If Redis Pub/Sub is insufficient, use dedicated WebSocket service (separate from API server) with sticky sessions. |
| **Owner** | Backend Lead |
| **Status** | Open |

### R12: Graph Visualization Complexity (Communication Allowlist)

| Field | Value |
|-------|-------|
| **ID** | R12 |
| **Category** | Technical |
| **Risk** | D3.js force-directed graph is complex to implement and maintain; may have poor UX with many agents |
| **Probability** | Medium |
| **Impact** | Low |
| **Sprint** | S7 |
| **Mitigation** | 1) Use React Flow (higher-level library built on D3). 2) Always ship table view as accessible fallback. 3) Cap graph display at 20 agents; use table for larger tenants. |
| **Contingency** | If graph proves too complex, ship table-only view in S7 and add graph visualization as Phase 3 enhancement. Table view provides same functionality. |
| **Owner** | Frontend Lead |
| **Status** | Open |

### R13: Permission Manifest Backfill Breaks Existing Skills

| Field | Value |
|-------|-------|
| **ID** | R13 |
| **Category** | Technical |
| **Risk** | Auto-generating manifests for existing marketplace skills produces incorrect permissions that break installations or block legitimate skill operations |
| **Probability** | Low |
| **Impact** | Medium |
| **Sprint** | S7 |
| **Mitigation** | 1) Auto-generate PERMISSIVE manifests (allow all domains, all paths) from current permissions JSONB. 2) Soft enforcement only -- log violations but never block. 3) Manual review of auto-generated manifests for core skills before Phase 3 hard enforcement. |
| **Contingency** | If backfill is problematic, mark existing skills as "legacy" (exempt from manifest validation) and require manifests only for NEW skills. |
| **Owner** | Backend Lead |
| **Status** | Open |

### R14: Kubernetes Network Policy Requires Cluster Access

| Field | Value |
|-------|-------|
| **ID** | R14 |
| **Category** | Infrastructure |
| **Risk** | Network policy enforcement requires Kubernetes API access that may not be available in Docker Compose development environment or staging |
| **Probability** | Medium |
| **Impact** | Medium |
| **Sprint** | S8 |
| **Mitigation** | 1) Docker Compose dev: log-only mode (generate policy YAML but do not apply). 2) CI/CD: test policy generation (syntax validation) without cluster. 3) Staging K8s cluster for actual enforcement testing. |
| **Contingency** | If staging K8s is not available, defer actual enforcement to Phase 3 DevOps sprint. Ship policy generation and validation (the backend logic) without live enforcement. |
| **Owner** | DevOps Lead |
| **Status** | Open |

### R15: Custom Skill SDK Packaging and Distribution

| Field | Value |
|-------|-------|
| **ID** | R15 |
| **Category** | Technical |
| **Risk** | npm package publishing, versioning, and CLI scaffold generation introduces unexpected complexity and maintenance burden |
| **Probability** | Medium |
| **Impact** | Low |
| **Sprint** | S8 |
| **Mitigation** | 1) Use tsup for zero-config TypeScript bundling. 2) commander.js for CLI (battle-tested). 3) Publish to private npm registry first (GitHub Packages or Verdaccio). 4) Public npm in Phase 3. |
| **Contingency** | If npm publishing is blocked, distribute SDK as a tarball download from the platform dashboard. CLI scaffold can be a script in the tarball. |
| **Owner** | Backend Lead |
| **Status** | Open |

### R16: Sprint 8 Overload (39 story points)

| Field | Value |
|-------|-------|
| **ID** | R16 |
| **Category** | Planning |
| **Risk** | Sprint 8 at 39 points exceeds team velocity baseline of 30, risking incomplete deliverables or quality shortcuts |
| **Probability** | High |
| **Impact** | Medium |
| **Sprint** | S8 |
| **Mitigation** | 1) E9-F5 (Security Posture Dashboard, 5pts, P2) and E10-F3 (Skill Dry-Run, 5pts, P2) are both P2 and explicitly marked as deferrable. 2) Removing both brings S8 to 29 points (within baseline). 3) Deferred items roll into Phase 3 Sprint 9. |
| **Contingency** | If velocity is lower than expected, defer both P2 items. If higher, ship as planned. Decision point: Sprint 8 planning meeting. |
| **Owner** | Product Manager |
| **Status** | Open |

### R17: Anthropic Cowork Adds Multi-Agent Features

| Field | Value |
|-------|-------|
| **ID** | R17 |
| **Category** | Market |
| **Risk** | Anthropic adds inter-agent communication to Cowork during our Phase 2, reducing our differentiation |
| **Probability** | Low |
| **Impact** | High |
| **Sprint** | All |
| **Mitigation** | 1) Our allowlist-based, audit-logged communication with visual graph editor is a deeper enterprise solution than what Anthropic would ship initially. 2) Focus messaging on "enterprise-grade coordination with compliance" not just "agents talking to each other." 3) Custom skill SDK is a second differentiator Cowork lacks. |
| **Contingency** | If Cowork adds multi-agent, pivot messaging to emphasize: audit trail (SOC2), permission-controlled coordination (allowlists), and custom skill ecosystem. These are enterprise requirements Cowork will not prioritize. |
| **Owner** | Product Manager |
| **Status** | Monitoring |

### R18: Breadfast Pilot Churn During Phase 2

| Field | Value |
|-------|-------|
| **ID** | R18 |
| **Category** | Business |
| **Risk** | Breadfast reduces engagement with pilot while waiting for Phase 2 features (inter-agent communication, custom skills) |
| **Probability** | Medium |
| **Impact** | High |
| **Sprint** | S5-S6 |
| **Mitigation** | 1) Share Phase 2 roadmap with Breadfast immediately (this document). 2) Give Breadfast early access to S5 audit features (Sprint 5 output). 3) Weekly check-in calls during Phase 2 to maintain engagement. 4) Priority access to S6 messaging features for pilot validation. |
| **Contingency** | If Breadfast disengages, recruit second pilot customer from enterprise prospect pipeline. Two prospects are already in security review. |
| **Owner** | Product Manager |
| **Status** | Open |

---

## Existing Risks Updated for Phase 2

### R3 (from roadmap.yaml): Anthropic Cowork Eroding Differentiation

| Field | Value |
|-------|-------|
| **Update** | Phase 2 directly addresses this by building inter-agent coordination (E7) and custom skill SDK (E10) -- both capabilities Cowork lacks. Risk is being actively mitigated. |
| **New Probability** | Medium (unchanged) |
| **New Impact** | Medium (reduced from High -- Phase 2 widens differentiation gap) |

### R6 (from roadmap.yaml): Cross-Tenant Data Leakage

| Field | Value |
|-------|-------|
| **Update** | Phase 2 adds network policy enforcement (E9-F2) and permission manifests (E9-F1) which further reduce this risk. Audit trail (E8) provides detection capability. |
| **New Probability** | Low (unchanged) |
| **New Impact** | Critical (unchanged -- but detection and enforcement capabilities improved) |

### R7 (from roadmap.yaml): Skill Marketplace Quality

| Field | Value |
|-------|-------|
| **Update** | Phase 2 adds permission manifests (E9-F1) and static analysis validation (E10-F3) which directly improve skill quality assurance. |
| **New Probability** | Low (reduced from Medium) |
| **New Impact** | Medium (unchanged) |

---

### R19: Slack App Review Delays

| Field | Value |
|-------|-------|
| **ID** | R19 |
| **Category** | External |
| **Risk** | Slack App Directory review process delays multi-workspace distribution |
| **Probability** | Medium |
| **Impact** | Medium |
| **Sprint** | S8 |
| **Mitigation** | Use Socket Mode (no public URL needed, simplifies review). Submit app early in sprint. Development/testing uses workspace-scoped install (no review needed). |
| **Contingency** | If review delayed, continue with direct workspace installs; App Directory listing is nice-to-have for pilot phase. |

### R20: Teams Admin Consent Flow Complexity

| Field | Value |
|-------|-------|
| **ID** | R20 |
| **Category** | Technical |
| **Risk** | Microsoft Teams org-wide admin consent flow has complex Azure AD requirements that delay integration |
| **Probability** | Medium |
| **Impact** | Medium |
| **Sprint** | S9 |
| **Mitigation** | Azure Bot Service simplifies registration. Test with dedicated dev tenant first. Use M365 Agents SDK (latest, replacing deprecated Bot Framework). |
| **Contingency** | Ship Teams without org-wide consent initially; support per-user install as fallback. |

### R21: Cross-Tenant Channel Message Routing

| Field | Value |
|-------|-------|
| **ID** | R21 |
| **Category** | Security |
| **Risk** | A bug in the Channel Proxy routing engine could route messages from Workspace A to Tenant B's container |
| **Probability** | Low |
| **Impact** | Critical |
| **Sprint** | S7-S8 |
| **Mitigation** | Tenant resolution is the FIRST step in proxy pipeline, before any message forwarding. Redis cache keyed by workspace+platform (not guessable). Integration tests verify isolation with 2+ tenants. Audit log captures all routing decisions. |
| **Contingency** | If leakage detected: immediate hotfix + security incident response. Container-per-company isolation means even a misroute can only reach OpenClaw webhook, not internal data. |

### R22: OpenClaw Channel Plugin Reliability

| Field | Value |
|-------|-------|
| **ID** | R22 |
| **Category** | Technical |
| **Risk** | Custom aegis OpenClaw channel plugin has reliability issues (dropped messages, retry storms, memory leaks) |
| **Probability** | Medium |
| **Impact** | High |
| **Sprint** | S6-S8 |
| **Mitigation** | Plugin is thin bridge layer (webhook in, HTTP POST out) -- minimal complexity. Retry with exponential backoff + dead-letter queue. Health check on plugin endpoint. Load testing before Slack integration sprint. |
| **Contingency** | If plugin unreliable, fall back to direct webhook calls from proxy → OpenClaw (bypassing channel plugin), though this loses outbound proactive capability. |

### R23: Phase 2 Extended Timeline (12 weeks vs 8 weeks)

| Field | Value |
|-------|-------|
| **ID** | R23 |
| **Category** | Planning |
| **Risk** | Phase 2 expansion from 4 to 6 sprints delays Phase 3 (Scale & Monetize) by 4 weeks |
| **Probability** | High (certain) |
| **Impact** | Medium |
| **Sprint** | All |
| **Mitigation** | Channel integration (E11) is critical for product-market fit -- agents in Slack/Teams are 10x more useful than dashboard-only. The delay is intentional and worth it. Phase 3 billing/analytics features are less urgent than channel reach for pilot customers. |
| **Contingency** | If velocity exceeds baseline, E11-F4 (Teams) or E11-F5 (Discord) can be deferred to Phase 3 start -- Slack alone covers Breadfast pilot. P2 items in S10 (13pts) are also deferrable. |

---

## Risk Summary Matrix

| Risk ID | Category | Probability | Impact | Sprint | Deferrable? |
|---------|----------|-------------|--------|--------|-------------|
| R8 | Technical | Medium | High | S5 | No |
| R9 | Technical | High | Medium | S5-S6 | No |
| R10 | Technical | Low | High | S6 | No |
| R11 | Technical | Medium | Medium | S6 | No |
| R12 | Technical | Medium | Low | S7 | Yes (table fallback) |
| R13 | Technical | Low | Medium | S7 | Yes (legacy exemption) |
| R14 | Infrastructure | Medium | Medium | S8 | Yes (log-only mode) |
| R15 | Technical | Medium | Low | S8 | Yes (tarball fallback) |
| R16 | Planning | High | Medium | S8 | Yes (P2 items deferrable) |
| R17 | Market | Low | High | All | No (strategic response) |
| R18 | Business | Medium | High | S5-S6 | No (engagement critical) |
| R19 | External | Medium | Medium | S8 | Yes (direct install fallback) |
| R20 | Technical | Medium | Medium | S9 | Yes (per-user install fallback) |
| R21 | Security | Low | Critical | S7-S8 | No |
| R22 | Technical | Medium | High | S6-S8 | No |
| R23 | Planning | High | Medium | All | Partial (Teams/Discord deferrable) |
