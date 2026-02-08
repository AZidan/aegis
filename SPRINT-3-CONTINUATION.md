# Sprint 3 Continuation Prompt

## Project Context

**Aegis Platform** - A multi-tenant SaaS platform for deploying secure, coordinated AI multi-agent systems. Built on OpenClaw as the agent runtime, with enterprise control plane, tenant lifecycle management, and a management dashboard.

- **Pilot customer**: Breadfast (Egyptian grocery tech)
- **Pilot agent**: Nadia (PM agent with Tableau/Amplitude/Jira integrations)

### Tech Stack
- **Backend**: NestJS 10+ (TypeScript), PostgreSQL 16, Redis 7, BullMQ
- **Frontend**: Next.js 15+ (TypeScript), Tailwind CSS v4, TanStack Query
- **ORM**: Prisma 7 with `prisma-client` provider — import from `../../prisma/generated/client` (NOT @prisma/client)
- **Auth**: JWT + OAuth2 (Google/GitHub), MFA/TOTP for platform admins
- **Infrastructure**: Docker (aegis-postgres:5432, aegis-redis:6379, aegis-backend:3000, aegis-frontend:3001)

### Important Files (READ THESE)
| File | Purpose |
|------|---------|
| `docs/workflow.md` | **MANDATORY** git branching workflow — follow EXACTLY for every feature |
| `docs/api-contract.md` | **SACRED** API contract (v1.2.0) — zero tolerance for deviations |
| `current-phase.yaml` | Phase & sprint tracker — update when completing features/sprints |
| `current-feature.yaml` | Active feature tracker — update when picking up/completing features |
| `design-artifacts/screens/*.html` | **SOURCE OF TRUTH** for UI — match these designs exactly |
| `design-artifacts/styled-dsl.yaml` | Component specifications with styling |
| `roadmap.yaml` | Full product roadmap with sprint planning |
| `backend/prisma/schema.prisma` | Database schema (all models already migrated) |
| `frontend/tailwind.config.ts` | Theme colors, linked via `@config` in globals.css |

---

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
- Admin sidebar + layout at `/admin/*`
- Tenant list with filters, pagination
- Provisioning wizard (3-step)
- All pages aligned to HTML design screens
- 295 frontend tests passing
- Tailwind v4 with `@config` directive in globals.css linking tailwind.config.ts

**Prisma Models (all migrated):**
- User, Tenant, Agent, AgentChannel, AgentActivity, AgentMetrics, Skill, SkillInstallation, ContainerHealth, Alert, AuditLog
- Seed data: admin user + 1 tenant + 4 sample agents

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

1. Update `current-feature.yaml` for E5-F2 (set status: in_progress, started_at: today)
2. Create branch `agent-dashboard` following `docs/workflow.md`
3. **Backend**: Implement `GET /api/dashboard/stats` endpoint (small - api-engineer agent)
4. **Frontend**: Launch ui-engineer for tenant sidebar + dashboard + agent list/detail/wizard (main work)
5. Backend and frontend agents can run in **parallel** (independent scopes)
6. **Tests**: qa-engineer AFTER feature agents complete
7. Build verification: `cd backend && npm run build` + `cd frontend && npm run build`
8. Commit, wait for user approval, merge to master
9. Update `current-feature.yaml` (status: completed) and `current-phase.yaml`

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

### Git Workflow — FOLLOW `docs/workflow.md` EXACTLY
- Read `docs/workflow.md` before starting any feature — it defines the branching strategy
- Create feature branch from master: `git checkout -b [feature-name]`
- For complex features: use task/subtask branches per the workflow doc
- **NEVER auto-merge** — wait for explicit user approval at every merge point
- Merge with `--no-ff`: `git checkout master && git merge [branch] --no-ff -m "Merge [branch]: [description]" && git branch -d [branch]`
- Clean up branches after merge (local + remote)

### Agent Rules (from CLAUDE.md)
- **ONE FEATURE AT A TIME** — never batch features
- **API CONTRACT IS SACRED** — follow `docs/api-contract.md` exactly, zero tolerance
- **SPECIALIZED AGENTS ONLY** — use api-engineer, ui-engineer, qa-engineer (never general-purpose)
- **PARALLEL WHERE POSSIBLE** — backend + frontend agents simultaneously when independent
- **qa-engineer RUNS AFTER** feature agents complete, never in parallel
- **DESIGN SCREENS ARE SOURCE OF TRUTH** — match HTML screens in `design-artifacts/screens/` exactly
- **Update trackers**: `current-feature.yaml` when picking up/completing features, `current-phase.yaml` for phase/sprint progress

### Technical Patterns
- Backend: NestJS, Zod DTOs, PrismaClient from `../../prisma/generated/client`
- Frontend: Next.js 15, TanStack Query hooks, Zod validation, Tailwind v4 with `@config`
- Tests: Jest for both, `npx jest --no-coverage --testPathPatterns="pattern"`
- Build check: `cd backend && npm run build` and `cd frontend && npm run build`
- Docker rebuild: `docker compose down && docker compose up --build -d`

### Tracker Updates (MANDATORY)
- **Before starting a feature**: Set `current-feature.yaml` status to `in_progress`, set `started_at`
- **After completing a feature**: Set status to `completed`, update `current-phase.yaml` sprint story status
- **After completing a sprint**: Set sprint status to `completed` in `current-phase.yaml`

---

## Quick Start

```
1. Read docs/workflow.md — this is the branching workflow to follow
2. Read current-feature.yaml and current-phase.yaml to confirm state
3. Start E5-F2: Update current-feature.yaml, create branch, implement
4. After E5-F2: E5-F1 (OAuth), then E4-F1 (Skills)
5. After all 5 features: Update current-phase.yaml to mark Sprint 3 complete
```
