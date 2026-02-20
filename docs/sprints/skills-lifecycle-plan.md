# Skills Lifecycle: Admin Tabs, Submitter Feedback & Tenant Submission

## Context

Three interconnected improvements to the skill submission lifecycle:
1. **Admin skills page needs tabs** (Pending/Approved/Rejected) to view submission history, not just the pending queue
2. **Submitters need feedback visibility** — rejection reasons and change requests must be visible to the submitter (tenant admin)
3. **Tenant admins need the same submission flow** as platform admin — ZIP upload, manual entry, and GitHub import (currently only ZIP upload exists for tenants)

User decisions captured:
- Single `rejectionReason` field (not two separate fields) — status (`rejected` vs `changes_requested`) distinguishes them
- GitHub import: extract to shared module (not import admin module into tenant) — maintain modularity
- History view: table + read-only detail page for approved/rejected skills
- Resubmission: new version required (not in-place update of rejected skill)

---

## Phase 1: Schema + Backend

### 1A. Prisma Migration

**File**: `backend/prisma/schema.prisma`
- Add `changes_requested` to `SkillStatus` enum
- Add `rejectionReason String? @db.Text` field to `Skill` model (separate from `reviewNotes` which stores LLM data)

**New migration**: `backend/prisma/migrations/2026MMDD_add_changes_requested_status/`

### 1B. Admin Skills Review Service

**File**: `backend/src/admin/skills/admin-skills-review.service.ts`
- `listReviewQueue()` → rename to `listSkills(statusFilter?: SkillStatus[])` — accept optional status array filter
  - Default (no filter): returns all skills (pending + in_review for backward compat)
  - With filter: `WHERE status IN (...)`
- `rejectSkill()` → write to `rejectionReason` field (NOT `reviewNotes` — preserves LLM data)
- Add `requestChanges(skillId, reason)` — sets `status = 'changes_requested'`, writes `rejectionReason`

### 1C. Admin Skills Review Controller

**File**: `backend/src/admin/skills/admin-skills-review.controller.ts`
- `GET /admin/skills/review?status=pending,approved,rejected,changes_requested` — add optional `status` query param
- `PUT /admin/skills/review/:id/request-changes` — new endpoint, body `{ reason: string }`
- Response shape for list: include `rejectionReason` and `reviewedAt` fields

### 1D. Shared GitHub Import Module

**Create**: `backend/src/shared/github-skill-import/`
  - `github-skill-import.service.ts` — move logic from `backend/src/admin/skills/github-skill-import.service.ts`
  - `github-skill-import.module.ts` — exports `GitHubSkillImportService`

**Modify**: `backend/src/admin/skills/admin-skills-review.module.ts` — import shared module instead of local service
**Modify**: `backend/src/admin/skills/github-skill-import.service.ts` — delete (moved to shared)

### 1E. Tenant GitHub Import Endpoint

**File**: `backend/src/dashboard/skills/skills.controller.ts` (or new `tenant-skill-import.controller.ts`)
- `POST /dashboard/skills/import/github` — `@UseGuards(JwtAuthGuard, TenantGuard)`, calls shared `GitHubSkillImportService`
- Same request/response shape as admin endpoint
- Sets `tenantId` from JWT context (unlike admin which can be null for marketplace)

**File**: `backend/src/dashboard/skills/skills.module.ts` — import shared `GitHubSkillImportModule`

### 1F. Tenant Skill List with Status Filter

**File**: `backend/src/dashboard/skills/private-skills.controller.ts`
- `GET /dashboard/skills/private?status=pending,approved,rejected,changes_requested` — add optional `status` query param
- Response includes `rejectionReason` field

**File**: `backend/src/dashboard/skills/private-skills.service.ts`
- Update query to accept status filter
- Include `rejectionReason` in select/return

---

## Phase 2: Frontend Types & API Layer

### 2A. Types Update

**File**: `frontend/src/lib/api/skill-packages.ts`
- `SkillReviewItem.status`: add `'approved' | 'rejected' | 'changes_requested'` to union
- Add `rejectionReason?: string` and `reviewedAt?: string` to `SkillReviewItem`

**File**: `frontend/src/lib/api/private-skills.ts`
- `PrivateSkill.status`: add `'changes_requested'` to union
- Add `rejectionReason?: string` and `reviewedAt?: string` to `PrivateSkill`

### 2B. API Functions

**File**: `frontend/src/lib/api/skill-packages.ts`
- `fetchSkillsForReview(status?: string)` — add optional status query param
- `requestChangesSkill(skillId, reason)` — calls `PUT /admin/skills/review/{id}/request-changes`
- Update `reviewSkill()` to route `request_changes` action to new endpoint

**File**: `frontend/src/lib/api/private-skills.ts`
- `fetchPrivateSkills(status?: string)` — add optional status query param
- `fetchGitHubSkillsTenant(url: string)` — calls `POST /dashboard/skills/import/github`

### 2C. Hooks

**File**: `frontend/src/lib/hooks/use-skill-packages.ts`
- `useSkillsForReview(status?)` — pass status to query fn, include in query key
- Update `useReviewSkill` — route `request_changes` to new API function

**File**: `frontend/src/lib/hooks/use-private-skills.ts`
- `usePrivateSkills(status?)` — pass status to query fn, include in query key
- `useFetchGitHubSkillsTenant()` — new hook for tenant GitHub import

---

## Phase 3: Frontend UI

### 3A. Admin Skills Page — 3 Tabs

**File**: `frontend/src/app/admin/skills/page.tsx`

Replace single table with tabbed layout:
- **Tabs**: Pending (default) | Approved | Rejected
- Each tab calls `useSkillsForReview(statusFilter)`:
  - Pending: `status=pending,in_review,changes_requested`
  - Approved: `status=approved`
  - Rejected: `status=rejected`
- Table columns adjust per tab:
  - Pending: current columns + "Review" action button
  - Approved: name, version, type, author, tenant, risk, reviewed date, "View" button
  - Rejected: name, version, type, author, tenant, reason (truncated), rejected date, "View" button
- "View" button navigates to `/admin/skills/review/{id}` (same page, but read-only for non-pending)
- "Import Skill" button stays in header (all tabs)
- Tab counts as badges: "Pending (3)" etc.

### 3B. Review Detail Page — Read-Only Mode

**File**: `frontend/src/app/admin/skills/review/[id]/page.tsx`

Add read-only mode for approved/rejected/changes_requested skills:
- If `skill.status` is not `pending`/`in_review`:
  - Hide security checklist (right column)
  - Hide sticky action bar
  - Show status banner at top: "Approved on {date}" (green) / "Rejected on {date}" (red) / "Changes Requested on {date}" (amber)
  - Show rejection reason in a highlighted card if present
  - Code viewer and LLM review tab remain visible (read-only)
  - Full-width code viewer (no right column needed)

### 3C. Tenant Private Skills Page — 3 Tabs + Feedback

**File**: `frontend/src/app/dashboard/skills/private/page.tsx`

Replace single table with tabbed layout (mirrors admin pattern):
- **Tabs**: Pending | Approved | Rejected
- Each tab calls `usePrivateSkills(statusFilter)`
- Table shows relevant columns per status
- **Feedback display**: For rejected/changes_requested skills, show `rejectionReason` inline or via expandable row
- "View Details" action → navigate to read-only detail page (reuse or new route)
- Keep existing "Upload Skill" button, add "Import Skill" button

### 3D. Tenant Submission Modal — 3-Tab Import

**Create**: `frontend/src/components/dashboard/skills/import-skill-modal.tsx`

Adapt from `frontend/src/components/admin/skills/import-skill-modal.tsx` with 3 tabs:
1. **GitHub Import** — URL input → `useFetchGitHubSkillsTenant()` → skill picker → submit
2. **Upload ZIP** — reuse existing `uploadSkillPackage()` + `submitSkillPackage()` flow
3. **Manual Entry** — form with name, version, description, category, roles, source code, permissions

Key difference from admin modal: tenant submissions always set `tenantId` (from JWT), status starts as `pending`.

### 3E. Tenant Skill Detail Page (Read-Only)

**Create**: `frontend/src/app/dashboard/skills/private/[id]/page.tsx`

Lightweight read-only detail for tenant's own skills:
- Skill header (name, version, status, submitted date)
- Source code viewer (reuse `CodeViewer` pattern from admin review page)
- If rejected/changes_requested: show feedback card with `rejectionReason`
- No security checklist, no action bar (tenant can't approve/reject)
- "Submit New Version" link that pre-fills the submission modal (stretch goal)

---

## Phase 4: API Contract

**File**: `docs/api-contract.md`

Add/update:
- Section 18.2: Update `GET /admin/skills/review` — add `?status` query param
- Section 18.5: Add `PUT /admin/skills/review/:id/request-changes` endpoint
- Section 18.x: Add `POST /dashboard/skills/import/github` (tenant GitHub import)
- Update skill response schemas to include `rejectionReason`, `reviewedAt`
- Update `SkillStatus` enum documentation to include `changes_requested`
- Section 12.x: Update `GET /dashboard/skills/private` — add `?status` query param

---

## Phase 5: Tests

### Backend Tests
- `admin-skills-review.service.spec.ts` — test status filter, requestChanges, rejectionReason persistence
- `github-skill-import.service.spec.ts` — move existing tests to shared location
- New: tenant GitHub import controller/service tests

### Frontend Verification
1. Admin `/admin/skills` — 3 tabs render, switching filters data, counts update
2. Admin `/admin/skills/review/{id}` — read-only mode for approved/rejected skills, feedback card shown
3. Tenant `/dashboard/skills/private` — 3 tabs, feedback visible for rejected skills
4. Tenant import modal — all 3 tabs work (ZIP, manual, GitHub)
5. Full flow: tenant submits → admin requests changes → tenant sees feedback → tenant submits new version → admin approves

---

## Reuse Inventory

| What | Location | Reuse |
|------|----------|-------|
| `ImportSkillModal` (admin) | `frontend/src/components/admin/skills/import-skill-modal.tsx` | Adapt for tenant version |
| `GitHubSkillImportService` | `backend/src/admin/skills/github-skill-import.service.ts` | Extract to shared module |
| `CodeViewer` pattern | `frontend/src/app/admin/skills/review/[id]/page.tsx` | Reuse in tenant detail page |
| `useSkillsForReview` hook | `frontend/src/lib/hooks/use-skill-packages.ts` | Add status param |
| `usePrivateSkills` hook | `frontend/src/lib/hooks/use-private-skills.ts` | Add status param |
| `riskBadge`, `statusBadge`, `typeBadge` | `frontend/src/app/admin/skills/page.tsx` | Reuse in tabbed views |
| `UploadSkillModal` | `frontend/src/components/dashboard/skills/upload-skill-modal.tsx` | Integrate into new import modal |

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Single `rejectionReason` field | Status enum (`rejected` vs `changes_requested`) distinguishes the action |
| Extract GitHub import to shared module | Modularity — both admin and tenant import without cross-module deps |
| New version for resubmission | Cleaner audit trail, avoids overwriting rejection history |
| Read-only detail for history | Reuses existing review page with conditional rendering |
| Tabs with status filter query param | Simple, works with existing pagination patterns |

---

## Execution Order & Status

1. **Phase 1** (Backend): Migration → shared module → service updates → new endpoints — **COMPLETE**
   - 1A: Prisma migration (changes_requested enum + rejectionReason field) — DONE
   - 1B: Admin skills review service (listSkills w/ status filter, requestChanges, rejectionReason) — DONE
   - 1C: Admin skills review controller (status query param, request-changes endpoint) — DONE
   - 1D: Shared GitHub import module (extracted to backend/src/shared/github-skill-import/) — DONE
   - 1E: Tenant GitHub import endpoint (POST /dashboard/skills/private/import/github) — DONE
   - 1F: Tenant skill list with status filter + detail endpoint — DONE
2. **Phase 2** (Types/API): Update types → API functions → hooks — **COMPLETE**
   - 2A: Types updated (SkillReviewItem, PrivateSkill with new statuses + rejectionReason) — DONE
   - 2B: API functions (fetchSkillsForReview w/ status, requestChanges, tenant GitHub import) — DONE
   - 2C: Hooks (useSkillsForReview w/ status, usePrivateSkills w/ status, useFetchGitHubSkillsTenant) — DONE
3. **Phase 3A-3B** (Admin UI): Admin tabs + read-only detail mode — **COMPLETE**
   - 3A: Admin skills page with 3 tabs (Pending/Approved/Rejected), tab counts, status-specific columns — DONE
   - 3B: Review detail page read-only mode (SkillStatusBanner, hide checklist/action bar) — DONE
4. **Phase 3C-3E** (Tenant UI): Tenant tabs + import modal + detail page — **COMPLETE**
   - 3C: Tenant private skills page with 3 tabs, feedback display, View action — DONE
   - 3D: Tenant import modal — DEFERRED (existing UploadSkillModal still works, GitHub import hook ready)
   - 3E: Tenant skill detail page (/dashboard/skills/private/[id]) with status banner, code viewer, LLM review — DONE
   - Shared components extracted: CodeViewer, SkillStatusBadge, SkillStatusBanner (frontend/src/components/shared/skills/)
5. **Phase 4** (API Contract): Document all changes — **COMPLETE**
   - Updated admin review list endpoint (status filter, response fields)
   - Split approve/reject/request-changes into separate endpoints
   - Added tenant private skills (list w/ status, detail, GitHub import)
   - Version history: v1.9.0
6. **Phase 5** (Tests): Backend tests → manual frontend verification — **COMPLETE**
   - admin-skills-review.service.spec.ts: 32 tests (was 13) — added listSkills status filter (8 tests), requestChanges (5 tests), rejectionReason field tests
   - github-skill-import.service.spec.ts: 28 tests (unchanged, backward-compatible re-export works)
