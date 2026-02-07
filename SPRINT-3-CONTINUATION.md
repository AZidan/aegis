# Sprint 3 Continuation Prompt

## Current State

We are in **Phase 3 (Implementation), Sprint 3: Agent Management & Tenant Dashboard**. On `master` branch.

### Sprint 3 Progress

| # | Feature | Points | Status | Tests |
|---|---------|--------|--------|-------|
| 1 | **E3-F1** Agent CRUD API | 8 | **DONE** | 169 backend |
| 2 | **E3-F2** Agent Tool Policy Config | 5 | **DONE** | 65 backend |
| 3 | **E5-F2** Agent Dashboard + Activity Feed | 8 | **NEXT** | - |
| 4 | **E5-F1** Tenant Login OAuth | 5 | Pending | - |
| 5 | **E4-F1** Skill Catalog & Browsing UI | 5 | Pending | - |

### What's Already Built

**Backend (complete for Sprint 3 agent features):**
- `backend/src/dashboard/agents/` - Full Agent CRUD (8 endpoints): create, list, detail, update, delete, restart, pause, resume
- `backend/src/dashboard/tools/` - Tool categories (8 categories), role defaults, per-agent tool policy GET/PUT
- `backend/src/common/guards/tenant.guard.ts` - Extracts tenantId from JWT for all `/api/dashboard/*` routes
- `backend/src/dashboard/dashboard.module.ts` - Parent module for tenant-facing routes
- 234 backend dashboard tests passing

**API Endpoints Available:**
- `GET /api/dashboard/agents` - List agents (filter: status, role; sort: name, last_active, created_at)
- `GET /api/dashboard/agents/:id` - Detail with metrics, skills, channel
- `POST /api/dashboard/agents` - Create (plan limits: starter=3, growth=10, enterprise=50)
- `PATCH /api/dashboard/agents/:id` - Update
- `DELETE /api/dashboard/agents/:id` - Remove
- `POST /api/dashboard/agents/:id/actions/restart|pause|resume` - Actions
- `GET /api/dashboard/tools/categories` - List 8 tool categories
- `GET /api/dashboard/tools/defaults/:role` - Role default policies
- `GET /api/dashboard/agents/:id/tool-policy` - Agent policy + available categories
- `PUT /api/dashboard/agents/:id/tool-policy` - Update agent policy
- `GET /api/dashboard/stats` - Tenant dashboard stats (defined in API contract but NOT implemented yet)

**Frontend (from Sprint 2):**
- Auth pages (admin login, tenant login with OAuth buttons)
- Admin sidebar + layout
- Tenant list with filters, pagination
- Provisioning wizard (3-step)
- All pages aligned to HTML design screens
- 295 frontend tests passing
- Tailwind v4 with `@config` directive in globals.css linking tailwind.config.ts

**Prisma Models (all migrated):**
- Agent, AgentChannel, AgentActivity, AgentMetrics, SkillInstallation
- Seed data: 4 sample agents for Acme Corp tenant

**Infrastructure:**
- Docker: aegis-postgres, aegis-redis, aegis-backend (port 3000), aegis-frontend (port 3001)
- Prisma 7 with `prisma-client` provider, import from `../../prisma/generated/client`

---

## Next Feature: E5-F2 Agent Overview Dashboard (8 pts)

### Design Screens (SOURCE OF TRUTH)
- `design-artifacts/screens/tenant-dashboard.html` - Dashboard with stats cards, agent overview
- `design-artifacts/screens/agent-list.html` - Agent cards with status, actions
- `design-artifacts/screens/agent-detail.html` - Agent detail page
- `design-artifacts/screens/agent-wizard.html` - 5-step agent creation wizard

### API Contract
- `docs/api-contract.md` Section 5 (Tenant Dashboard) + Section 6 (Tenant Agents)

### What E5-F2 Requires

**Backend:**
- `GET /api/dashboard/stats` endpoint (tenant dashboard aggregate stats - agents total/active/idle, activity messagesToday/toolInvocationsToday, cost estimatedDaily/estimatedMonthly)
- Add to existing DashboardModule or create new stats controller

**Frontend (main deliverable):**
1. **Tenant sidebar** - Navigation for tenant admin (Dashboard, Agents, Skills, Settings, etc.)
2. **Tenant dashboard page** (`/dashboard`) - Stats cards, agent overview cards, quick actions
3. **Agent list page** (`/dashboard/agents`) - Agent cards with status dots, model tier badges, role badges, last active
4. **Agent detail page** (`/dashboard/agents/:id`) - Tabs: Overview, Configuration, Activity, Logs
5. **Agent creation wizard** (`/dashboard/agents/new`) - 5 steps per design: Basic Info, Model Config, Tool Policy, Channel Binding, Review
6. **API layer** - Types, hooks, mutations for all agent endpoints
7. **Frontend tests**

### Implementation Plan

1. Update `current-feature.yaml` for E5-F2
2. Create branch `agent-dashboard`
3. **Backend**: Implement `GET /api/dashboard/stats` endpoint (small - can be in api-engineer agent)
4. **Frontend**: Launch ui-engineer for tenant sidebar + dashboard + agent list/detail/wizard (main work)
5. **Tests**: qa-engineer after frontend complete
6. Build verification
7. Commit, merge to master

---

## Remaining After E5-F2

### E5-F1: Tenant Login OAuth (5 pts)
- Backend OAuth strategies (Google, GitHub) via Passport
- Frontend OAuth buttons already exist but aren't wired to real providers
- `backend/src/auth/auth.controller.ts` already has `oauthLogin` stub
- API contract Section 1: OAuth Login

### E4-F1: Skill Catalog & Browsing UI (5 pts)
- Backend: Skill marketplace endpoints (browse, detail, install, uninstall)
- Frontend: Skill marketplace page, skill detail, install/uninstall
- Prisma models exist: Skill, SkillInstallation
- Design screens: `skill-marketplace.html`, `skill-detail.html`
- API contract Section 7: Tenant Skills

---

## Mandatory Workflow Rules

### Git Workflow (from docs/workflow.md)
- Create feature branch from master: `git checkout -b [feature-name]`
- NEVER auto-merge - wait for explicit user approval
- Merge: `git checkout master && git merge [branch] --no-ff -m "Merge [branch]: [description]" && git branch -d [branch]`
- Clean up branches after merge

### Agent Rules (from CLAUDE.md)
- **ONE FEATURE AT A TIME** - never batch features
- **API CONTRACT IS SACRED** - follow `docs/api-contract.md` exactly
- **SPECIALIZED AGENTS ONLY** - use api-engineer, ui-engineer, qa-engineer
- **PARALLEL WHERE POSSIBLE** - backend + frontend agents simultaneously when independent
- **qa-engineer RUNS AFTER** feature agents complete, never in parallel
- **DESIGN SCREENS ARE SOURCE OF TRUTH** - match HTML screens in `design-artifacts/screens/` exactly
- **Update trackers**: `current-feature.yaml` when picking up/completing features, `current-phase.yaml` for phase progress

### Technical Patterns
- Backend: NestJS, Zod DTOs, PrismaClient from `../../prisma/generated/client`
- Frontend: Next.js 15, TanStack Query hooks, Zod validation, Tailwind v4 with `@config`
- Tests: Jest for both, `npx jest --no-coverage --testPathPatterns="pattern"`
- Build check: `cd backend && npm run build` and `cd frontend && npm run build`

### Commit Format
```
feat: [description] (E[X]-F[Y])

[Details]

```

---

## Quick Start

```
Read current-feature.yaml and current-phase.yaml to confirm state.
Start E5-F2: Update current-feature.yaml, create branch, implement.
After E5-F2: E5-F1 (OAuth), then E4-F1 (Skills).
After all 5 features: Update current-phase.yaml to mark Sprint 3 complete.
```
