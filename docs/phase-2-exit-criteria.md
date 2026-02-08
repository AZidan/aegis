# Phase 2 Exit Criteria: Coordination & Security

**Version:** 1.0.0
**Date:** 2026-02-08
**Status:** Proposal for Review

---

## Purpose

These criteria define what must be true before the team can declare Phase 2 complete and begin Phase 3 (Scale & Monetize). Each criterion is measurable and verifiable.

---

## Mandatory Exit Criteria (ALL must pass)

### EC-1: Audit Trail Complete

- [ ] **EC-1.1**: 100% of API mutations (POST/PUT/PATCH/DELETE) are automatically captured in the audit_logs table via the global interceptor
- [ ] **EC-1.2**: Audit log entries include: actorType, actorId, actorName, action, targetType, targetId, sanitized details, severity, ipAddress, userAgent, tenantId, timestamp
- [ ] **EC-1.3**: No passwords, tokens, secrets, or API keys appear in audit log details JSONB (sanitization verified by test)
- [ ] **EC-1.4**: Audit log query API returns results within 3 seconds for queries spanning 30 days of data (tested with 100,000+ rows)
- [ ] **EC-1.5**: Audit logs are append-only -- no UPDATE or DELETE operations possible on audit_logs table (enforced by PostgreSQL trigger or application guard)
- [ ] **EC-1.6**: Audit log viewer functional in both tenant dashboard and admin dashboard with filters (agent, action, date range, severity)
- [ ] **EC-1.7**: CSV/JSON export works for filtered audit log results (up to 10,000 rows)
- [ ] **EC-1.8**: Daily archival job runs successfully, exporting logs older than 90 days

### EC-2: Inter-Agent Communication Functional

- [ ] **EC-2.1**: Agents within the same tenant can exchange structured messages (task_handoff, status_update, data_request, data_response, escalation, notification)
- [ ] **EC-2.2**: Messages blocked by allowlist return 403 with clear error explaining the block reason
- [ ] **EC-2.3**: Message delivery latency under 2 seconds (P95, measured under load with 50 concurrent messages)
- [ ] **EC-2.4**: All inter-agent messages logged to audit trail automatically
- [ ] **EC-2.5**: WebSocket real-time message feed delivers events to connected dashboard clients within 1 second
- [ ] **EC-2.6**: Communication allowlist editor (graph or table) allows tenant admins to manage agent-to-agent permissions
- [ ] **EC-2.7**: Message dashboard shows timeline of inter-agent messages with filtering and search
- [ ] **EC-2.8**: At least 3 coordination workflow templates available and triggerable via API

### EC-3: Security Hardening Complete

- [ ] **EC-3.1**: 100% of marketplace skills have valid permission manifests (network, files, env)
- [ ] **EC-3.2**: Skill submission without a valid manifest is rejected with clear validation errors
- [ ] **EC-3.3**: Runtime permission usage logged for all skill executions (soft enforcement)
- [ ] **EC-3.4**: Network policy generation from installed skills' manifests produces valid Kubernetes NetworkPolicy YAML
- [ ] **EC-3.5**: Blocked network requests logged with source agent, destination domain, and timestamp
- [ ] **EC-3.6**: Security alert rules fire within 60 seconds for: 5+ failed logins in 5min, cross-tenant API attempt, tool policy violation

### EC-4: Custom Skill SDK Published

- [ ] **EC-4.1**: @aegis/skill-sdk installable via npm with TypeScript types
- [ ] **EC-4.2**: `npx @aegis/skill-sdk init <name>` generates a working skill scaffold with manifest, handler, and test
- [ ] **EC-4.3**: SDK documentation includes 3 example skills with working code
- [ ] **EC-4.4**: Private skill registry stores tenant-scoped custom skills (not visible to other tenants)
- [ ] **EC-4.5**: Custom skill upload, versioning, and rollback functional via API
- [ ] **EC-4.6**: Skill validation (static analysis) catches undeclared network calls in skill source code

### EC-5: Channel Integration Live

- [ ] **EC-5.1**: Slack App installed in at least 1 workspace with end-to-end message flow working (user → agent → reply)
- [ ] **EC-5.2**: Microsoft Teams App installed in at least 1 organization with end-to-end message flow working
- [ ] **EC-5.3**: Discord Bot installed in at least 1 guild with end-to-end message flow working
- [ ] **EC-5.4**: Proactive agent messages (cron/heartbeat) delivered to Slack DMs within 5 seconds of trigger
- [ ] **EC-5.5**: Channel routing resolves correctly: slash command > channel mapping > user mapping > default (priority order verified by test)
- [ ] **EC-5.6**: All channel messages (inbound + outbound) logged to audit trail
- [ ] **EC-5.7**: Zero cross-tenant message routing (workspace A messages never reach tenant B's container)
- [ ] **EC-5.8**: Channel admin UI allows self-serve connect/disconnect and routing configuration
- [ ] **EC-5.9**: Proactive behavior configuration (cron + heartbeat) syncs to OpenClaw containers
- [ ] **EC-5.10**: OAuth token revocation handled gracefully (connection status updates, alert generated)

### EC-6: Testing & Quality

- [ ] **EC-6.1**: Phase 2 features have 80%+ unit test coverage
- [ ] **EC-6.2**: E2E test suite covers: audit logging, inter-agent messaging, channel integration, custom skill upload, security alerting
- [ ] **EC-6.3**: No P0 or P1 bugs open in Phase 2 features at exit
- [ ] **EC-6.4**: API response times within SLA (P95 < 500ms for read endpoints, P95 < 1s for write endpoints)
- [ ] **EC-6.5**: Zero cross-tenant data leakage in audit logs, inter-agent messages, or channel routing (verified by integration test)
- [ ] **EC-6.6**: Slack message round-trip latency < 3 seconds (P95)

---

## Recommended Exit Criteria (Target but not blocking)

### REC-1: Performance

- [ ] **REC-1.1**: Audit log table handles 1M+ rows without query degradation (partitioning implemented)
- [ ] **REC-1.2**: Inter-agent messaging handles 100 messages/second per tenant without queue backlog
- [ ] **REC-1.3**: WebSocket connections support 50+ concurrent dashboard users per tenant

### REC-2: Breadfast Pilot Validation

- [ ] **REC-2.1**: Breadfast has configured inter-agent communication between PM and Engineering agents
- [ ] **REC-2.2**: Breadfast has deployed at least 1 custom skill using the SDK
- [ ] **REC-2.3**: Breadfast security team has reviewed audit logs and confirmed compliance requirements met

### REC-3: Enterprise Readiness

- [ ] **REC-3.1**: Security posture dashboard shows green status for all mandatory controls
- [ ] **REC-3.2**: Enterprise prospect security questionnaire can be answered with audit trail evidence
- [ ] **REC-3.3**: Network policy enforcement demo-ready for enterprise prospects

---

## Phase 2 to Phase 3 Transition Checklist

Before starting Phase 3 (Scale & Monetize):

1. [ ] All mandatory exit criteria (EC-1 through EC-6) verified and documented
2. [ ] Phase 2 E2E test suite passes in CI/CD pipeline
3. [ ] API contract v2.0.0 published with all Phase 2 endpoints
4. [ ] Database schema migration tested on staging with production-like data volume
5. [ ] Breadfast pilot upgraded to Phase 2 features and feedback collected
6. [ ] Phase 2 retrospective completed with velocity analysis
7. [ ] Phase 3 sprint plan drafted based on Phase 2 learnings
8. [ ] current-phase.yaml updated to Phase 3
9. [ ] roadmap.yaml updated with actual Phase 2 completion dates and metrics

---

## Success Metrics (Phase 2 OKRs)

### Objective 1: Establish multi-agent coordination as a core capability

| Key Result | Target | Measurement |
|------------|--------|-------------|
| Inter-agent messaging functional | Yes/No | E2E test passes |
| Message delivery P95 latency | < 2s | Load test measurement |
| Breadfast uses inter-agent messaging | Yes/No | Pilot feedback |

### Objective 2: Achieve enterprise-grade audit and compliance

| Key Result | Target | Measurement |
|------------|--------|-------------|
| API mutation audit coverage | 100% | Automated test verification |
| Audit log query performance (30 days) | < 3s | Performance test |
| Enterprise prospect security review passed | 1+ | Sales pipeline status |

### Objective 3: Enable custom skill ecosystem

| Key Result | Target | Measurement |
|------------|--------|-------------|
| SDK published to npm | Yes/No | npm registry check |
| Custom skill deployed by pilot | 1+ | Breadfast deployment |
| Skills with valid manifests | 100% | Database query |

### Objective 4: Security hardening measurable

| Key Result | Target | Measurement |
|------------|--------|-------------|
| Permission manifest coverage | 100% | Skills without manifests = 0 |
| Network policy violations detected | Logged | Audit log evidence |
| Security alert response time | < 60s | Alert timing test |

### Objective 5: Channel integration enables real-world agent reach

| Key Result | Target | Measurement |
|------------|--------|-------------|
| Slack end-to-end flow working | Yes/No | E2E test + demo |
| Teams end-to-end flow working | Yes/No | E2E test + demo |
| Discord end-to-end flow working | Yes/No | E2E test + demo |
| Proactive messages delivered via channels | Yes/No | Cron trigger test |
| Breadfast agents reachable via Slack | Yes/No | Pilot feedback |
| Channel message round-trip latency | < 3s P95 | Performance test |
