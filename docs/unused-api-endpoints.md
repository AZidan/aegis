# Unused API Endpoints - Review List

**Generated:** 2026-02-06
**Source:** API Contract v1.1.0
**Purpose:** Identify endpoints not directly exposed in current UI screens

---

## Overview

This document lists API endpoints that exist in the API contract but are **not directly represented** in the current 18 UI screens. These endpoints are fully specified and available for implementation, but may represent:

1. **Future enhancements** - Post-MVP features planned for later phases
2. **Admin actions** - Available via dropdowns/modals not visible in static HTML
3. **Background operations** - Triggered automatically or via other mechanisms
4. **Developer/Integration features** - Used by external systems, not the UI

**Total Endpoints in Contract:** 67
**Endpoints with Direct UI:** 48
**Endpoints Listed Below:** 19

---

## 1. Platform Admin - Tenant Management

### Update Tenant Config
**Endpoint:** `PATCH /api/admin/tenants/:id`
**Description:** Update tenant configuration (plan, limits, model defaults)

**UI Status:** ❌ Not exposed
**Screen:** Tenant Detail (`/admin/tenants/:id`)
**Current UI:** Shows tenant config but no edit controls

**Recommendation:**
- Add "Edit Configuration" button to Tenant Detail screen
- Open modal with form for plan tier, resource limits, model defaults
- **Priority:** Medium - useful for tenant upgrades/downgrades

---

### Delete Tenant
**Endpoint:** `DELETE /api/admin/tenants/:id`
**Description:** Decommission tenant (soft delete with 7-day grace period)

**UI Status:** ❌ Not exposed
**Screen:** Tenant Detail (`/admin/tenants/:id`)
**Current UI:** No delete/decommission action visible

**Recommendation:**
- Add "Decommission Tenant" to actions dropdown
- Confirmation modal with grace period warning
- **Priority:** Medium - needed for tenant lifecycle management

---

### Restart Tenant Container
**Endpoint:** `POST /api/admin/tenants/:id/actions/restart`
**Description:** Restart tenant's OpenClaw container

**UI Status:** ❌ Not exposed
**Screen:** Tenant Detail (`/admin/tenants/:id`)
**Current UI:** No restart action visible

**Recommendation:**
- Add "Restart Container" to actions dropdown
- Show estimated downtime (30-60s)
- **Priority:** High - critical for troubleshooting degraded containers

---

### Get Tenant Container Health (Historical)
**Endpoint:** `GET /api/admin/tenants/:id/health`
**Description:** Detailed container health metrics with 24h history

**UI Status:** ⚠️ Partially used
**Screen:** Tenant Detail - Resources Tab
**Current UI:** Shows health gauges but may not use this specific endpoint

**Recommendation:**
- Clarify if Resources tab uses this endpoint for 24h charts
- Document data source for historical metrics
- **Priority:** Low - clarification needed, not blocking

---

### Get Tenant Agents
**Endpoint:** `GET /api/admin/tenants/:id/agents`
**Description:** List all agents within a tenant

**UI Status:** ⚠️ Partially used
**Screen:** Tenant Detail - Agents Tab
**Current UI:** Shows agent list but may use embedded data

**Recommendation:**
- Confirm if Agents tab uses this endpoint or embedded data from main detail call
- **Priority:** Low - likely already in use

---

## 2. Platform Admin - Skills

### Reject Skill
**Endpoint:** `POST /api/admin/skills/review/:id/reject`
**Description:** Reject skill submission with feedback

**UI Status:** ❌ Likely exists but not verified
**Screen:** Skill Review Detail (`/admin/skills/review/:id`)
**Current UI:** Static HTML doesn't show reject button clearly

**Recommendation:**
- Verify reject button exists in interactive version
- Should appear alongside "Approve" button
- **Priority:** High - core review workflow

---

### List Published Skills (Admin View)
**Endpoint:** `GET /api/admin/skills`
**Description:** All published skills with admin metrics

**UI Status:** ❌ Not exposed
**Screen:** No dedicated screen
**Current UI:** Skill Review Queue only shows pending reviews

**Recommendation:**
- Add "Published Skills" tab to Skill Review Queue
- Show all approved skills with install counts, ratings
- **Priority:** Low - admin analytics feature

---

## 3. Tenant - Agents

### Update Agent
**Endpoint:** `PATCH /api/dashboard/agents/:id`
**Description:** Update agent configuration (model tier, thinking mode, tool policy)

**UI Status:** ⚠️ Partially used
**Screen:** Agent Detail (`/dashboard/agents/:id`)
**Current UI:** Configuration tab shows editable fields

**Recommendation:**
- Verify Configuration tab has "Save Changes" functionality
- **Priority:** High - core agent management

---

### Delete Agent
**Endpoint:** `DELETE /api/dashboard/agents/:id`
**Description:** Remove agent

**UI Status:** ❌ Not exposed
**Screen:** Agent Detail (`/dashboard/agents/:id`)
**Current UI:** No delete action visible

**Recommendation:**
- Add "Delete Agent" to actions dropdown
- Confirmation modal with warning
- **Priority:** Medium - needed for agent lifecycle

---

### Restart Agent
**Endpoint:** `POST /api/dashboard/agents/:id/actions/restart`
**Description:** Restart agent process

**UI Status:** ✅ Exposed
**Screen:** Agent Detail - Overview Tab
**Current UI:** "Restart" button visible

**Notes:** This endpoint IS represented in the UI, included here for completeness.

---

### Pause Agent
**Endpoint:** `POST /api/dashboard/agents/:id/actions/pause`
**Description:** Pause agent (stop processing messages)

**UI Status:** ❌ Not exposed
**Screen:** Agent Detail (`/dashboard/agents/:id`)
**Current UI:** Only "Restart" button shown, no pause toggle

**Recommendation:**
- Add "Pause"/"Resume" toggle button
- Use badge to show paused state
- **Priority:** Medium - useful for temporary agent disabling

---

### Resume Agent
**Endpoint:** `POST /api/dashboard/agents/:id/actions/resume`
**Description:** Resume paused agent

**UI Status:** ❌ Not exposed (same as Pause)
**Screen:** Agent Detail (`/dashboard/agents/:id`)

**Recommendation:**
- Pair with Pause action as toggle button
- **Priority:** Medium

---

### Get Agent Activity Feed
**Endpoint:** `GET /api/dashboard/agents/:id/activity`
**Description:** Paginated activity log for specific agent

**UI Status:** ⚠️ Partially used
**Screen:** Agent Detail - Activity Tab
**Current UI:** Shows activity list but may use embedded data

**Recommendation:**
- Confirm Activity tab uses this paginated endpoint
- **Priority:** Low - likely already in use

---

### Get Agent Logs
**Endpoint:** `GET /api/dashboard/agents/:id/logs`
**Description:** Agent logs with filtering (debug, info, warn, error)

**UI Status:** ⚠️ Partially used
**Screen:** Agent Detail - Logs Tab
**Current UI:** Shows logs but may use embedded data

**Recommendation:**
- Confirm Logs tab uses this endpoint with filtering
- **Priority:** Low - likely already in use

---

## 4. Tenant - Skills

### Uninstall Skill
**Endpoint:** `DELETE /api/dashboard/skills/:id/uninstall?agentId=...`
**Description:** Remove skill from agent

**UI Status:** ❌ Not exposed
**Screen:** Skill Detail or Agent Detail
**Current UI:** No uninstall action visible

**Recommendation:**
- Add "Uninstall" button to installed skills in Agent Detail
- Confirmation modal
- **Priority:** Medium - skill lifecycle management

---

### Get Installed Skills
**Endpoint:** `GET /api/dashboard/skills/installed`
**Description:** List all skills installed for tenant

**UI Status:** ❌ Not exposed
**Screen:** No dedicated screen
**Current UI:** Installed skills shown per-agent in Agent Detail

**Recommendation:**
- Add "Installed Skills" view to Skill Marketplace
- Show all installed skills across all agents
- **Priority:** Low - nice-to-have analytics

---

## 5. Tenant - Team Management

### Remove Team Member
**Endpoint:** `DELETE /api/dashboard/team/:id`
**Description:** Remove team member

**UI Status:** ⚠️ Likely exists
**Screen:** Team Members (`/dashboard/team`)
**Current UI:** Table rows likely have delete action in dropdown

**Recommendation:**
- Verify remove action exists in interactive version
- **Priority:** High - core team management

---

### Update Member Role
**Endpoint:** `PATCH /api/dashboard/team/:id`
**Description:** Change member role (tenant_admin ↔ tenant_member)

**UI Status:** ❌ Not exposed
**Screen:** Team Members (`/dashboard/team`)
**Current UI:** Shows roles but no edit controls

**Recommendation:**
- Add inline role editor (dropdown in table)
- Or "Edit Role" action in row dropdown
- **Priority:** Medium - useful for permission management

---

## 6. Tenant - Audit

### Export Audit Log
**Endpoint:** `GET /api/dashboard/audit/export?format=csv|json`
**Description:** Export audit log as CSV or JSON

**UI Status:** ❌ Not exposed
**Screen:** Audit Log (`/dashboard/audit`)
**Current UI:** No export button visible

**Recommendation:**
- Add "Export" button to page header
- Modal to select format and date range
- **Priority:** Medium - compliance feature

---

## 7. WebSocket Events

### Subscribe to Events
**Connection:** `wss://api.aegis.ai/ws`
**Events:** `agent.status.changed`, `container.health.changed`, `provisioning.progress`

**UI Status:** ❌ Not implemented
**Current UI:** Static HTML - no real-time updates

**Recommendation:**
- Implement WebSocket subscriptions in Next.js version
- Subscribe to relevant events per screen:
  - Admin Dashboard → container.health.changed
  - Tenant Dashboard → agent.status.changed
  - Tenant Provisioning → provisioning.progress
- **Priority:** High - critical for real-time UX

---

## Summary by Priority

### 🔴 High Priority (Add to Sprint 1)
1. Restart Tenant Container - troubleshooting
2. Reject Skill - core review workflow
3. Update Agent Config - core agent management
4. WebSocket Integration - real-time updates

### 🟡 Medium Priority (Add to Backlog)
5. Update Tenant Config - plan upgrades
6. Delete Tenant - lifecycle management
7. Delete Agent - lifecycle management
8. Pause/Resume Agent - temporary disabling
9. Update Member Role - permission management
10. Uninstall Skill - skill lifecycle
11. Export Audit Log - compliance

### 🟢 Low Priority (Future Enhancement)
12. List Published Skills (Admin) - analytics
13. Get Installed Skills - analytics
14. Various "partially used" endpoints - verify implementation

---

## Action Items

1. **Verify** endpoints marked as "⚠️ Partially used" are actually in use
2. **Add UI controls** for high-priority missing endpoints
3. **Implement WebSocket** subscriptions in Next.js version
4. **Document** which endpoints are intentionally deferred to post-MVP
5. **Update screens** with missing action buttons (delete, pause, export, etc.)

---

**Next Review:** After Phase 3 Sprint 1 implementation
**Owner:** Product Team + Engineering Lead
