# Phase 3: Implementation - Context Document

**Project:** Aegis Platform - AI Multi-Agent SaaS
**Current Phase:** Phase 3 - Implementation
**Started:** 2026-02-06
**Model Recommendation:** Sonnet 4.5 (primary), Haiku (simple tasks only)

---

## Project Overview

**Aegis Platform** is a multi-tenant AI Multi-Agent SaaS that provides OpenClaw-per-Company isolation. Each tenant gets their own containerized OpenClaw instance with custom AI agents for their team.

### Business Model
- **Platform Admin**: Manages tenants, provisions containers, reviews marketplace skills
- **Tenant Admin**: Creates agents, manages team, installs skills from marketplace
- **Tenant Member**: Uses agents via Slack/Telegram/Web

### Key Differentiator
- **Container Isolation**: Each company gets dedicated OpenClaw container
- **Role-Based Agents**: Agents assist specific people in specific roles
- **3-Layer Architecture**: Shared Toolbox → Role Skills → Individual Agent Config
- **Hot-Swappable**: Skills and channels can be added/removed without downtime

---

## Tech Stack

### Frontend
- **Framework**: Next.js 15+ App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 3.4+
- **Components**: Radix UI + shadcn/ui
- **State**: React Query (server state) + Zustand (client state)
- **Forms**: React Hook Form + Zod validation
- **Icons**: Lucide React

### Backend
- **Framework**: NestJS 10+
- **Language**: TypeScript
- **Database**: MySQL 8.0 (main data) + Redis 7+ (sessions, cache)
- **ORM**: Prisma 5+
- **Auth**: JWT + OAuth2 (Google, GitHub)
- **API Style**: REST + WebSocket (Socket.io)
- **Validation**: class-validator + class-transformer

### Infrastructure
- **Container Runtime**: Docker + Kubernetes
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)

### Design System
- **Primary Color**: Deep Indigo (#6366f1)
- **Fonts**: Inter (UI) + JetBrains Mono (code)
- **Aesthetic**: Linear/Vercel - clean, minimal, high contrast
- **Accessibility**: WCAG 2.1 AA compliant

---

## Completed Deliverables (Phases 1-2.5)

### Phase 1: Strategy & Planning ✅
- `project-context.md` - Business strategy, personas, KPIs
- `roadmap.yaml` - Feature roadmap, sprint planning
- `docs/multi-agent-plan.md` - 3-layer agent architecture
- `docs/security-whitepaper.md` - Security architecture

### Phase 2: Design ✅
- `design-artifacts/user-flows.md` - 10 user flows, 37 screens
- `design-artifacts/theme.yaml` - Complete design system
- `design-artifacts/styled-dsl.yaml` - 18 screen specifications (6,348 lines)

### Phase 2.5: API Architecture ✅
- `docs/api-contract.md` - **67 endpoints, v1.1.0** (SINGLE SOURCE OF TRUTH)
- `design-artifacts/screens/` - 18 HTML screen prototypes
- `design-artifacts/prototypes/` - 2 interactive prototypes (admin + tenant)
- `docs/gap-analysis-report.md` - Quality review (production ready)
- `docs/unused-api-endpoints.md` - Endpoint roadmap

---

## Critical Phase 3 Rules

### 🚨 API Contract Compliance (ZERO TOLERANCE)

**THE API CONTRACT IS SACRED**

File: `docs/api-contract.md` (v1.1.0)

**Rules:**
1. **NEVER deviate** from contract specifications without explicit approval
2. **EXACT endpoint paths** - no variations
3. **EXACT request/response schemas** - no extra fields, no missing fields
4. **EXACT HTTP status codes** - as documented
5. **EXACT error response format** - use global standard
6. **EXACT authentication requirements** - JWT + role checks

**Before implementing ANY endpoint:**
1. Read the contract specification
2. Confirm understanding
3. Implement EXACTLY as specified
4. Test against contract

**Contract Violations = Implementation Failure**

---

### 🗺️ MANDATORY: CodeMap Usage (Token Efficiency)

**CRITICAL: ALL agents MUST use CodeMap for file operations in Phase 3**

Phase 3 will generate a large codebase. Reading full files wastes tokens and slows development.

**CodeMap Benefits:**
- ✅ 60-80% token reduction on file operations
- ✅ Instant symbol location (classes, functions, methods)
- ✅ Precise line-range reads (read only what you need)
- ✅ Fast file structure exploration
- ✅ Zero full-file scans required

**MANDATORY Rules:**

1. **Before READING any file:**
   ```bash
   # Find the symbol first
   codemap find "ClassName" --type class
   # Output: src/services/user.service.ts:15-189

   # Read ONLY the relevant lines
   Read src/services/user.service.ts lines 15-189
   ```

2. **Before EDITING any file:**
   ```bash
   # Find exact location
   codemap find "methodName" --type method
   # Get file structure
   codemap show src/services/user.service.ts

   # Edit precisely at correct line range
   Edit src/services/user.service.ts (use exact old_string from lines shown)
   ```

3. **Exploring file structure:**
   ```bash
   # See all symbols without reading full file
   codemap show src/controllers/auth.controller.ts

   # Output shows:
   # - AuthController [class] L10-150
   #   - login [method] L15-45
   #   - register [method] L47-78
   ```

4. **Finding symbols by name:**
   ```bash
   # Case-insensitive search
   codemap find "UserService"

   # Fuzzy search (when unsure of exact name)
   codemap find "usrserv" -f
   # Matches: UserService, UserServiceImpl, etc.

   # Filter by type
   codemap find "create" --type method
   codemap find "User" --type interface

   # Combine fuzzy search with type filter
   codemap find "auth" -f --type class
   ```

**NEVER:**
- ❌ Read entire files without checking CodeMap first
- ❌ Use grep/find when CodeMap can locate symbols
- ❌ Scan directories when CodeMap has indexed them
- ❌ Read files "just to see what's there" - use `codemap show`

**ALWAYS:**
- ✅ Check `codemap find` before reading
- ✅ Use `codemap find "term" -f` for fuzzy search when unsure of exact name
- ✅ Use `codemap show` to understand file structure
- ✅ Read specific line ranges only
- ✅ Validate index freshness with `codemap validate` if uncertain

**Setup (if not initialized):**
```bash
# Install from GitHub (NOT PyPI)
pip install git+https://github.com/AZidan/codemap.git

# Initialize in project root
codemap init .

# Start watch mode (auto-updates index)
codemap watch . &
```

**Token Savings Example:**

Without CodeMap:
- Read full 500-line file → 2000 tokens
- Find method manually → 2000 tokens wasted

With CodeMap:
- `codemap find "methodName"` → 50 tokens
- Read lines 45-78 only → 150 tokens
- **Total saved: 1800 tokens (90% reduction)**

**Phase 3 Target: <20% of tokens spent on file reads through CodeMap usage**

---

### ⚡ Development Standards

**Code Quality:**
- ESLint + Prettier (enforce strict rules)
- TypeScript strict mode (no `any` types)
- 80%+ test coverage (unit + integration)
- Zod schemas for ALL API validation
- Proper error handling (never expose internals)

**Security:**
- Input validation on ALL endpoints
- SQL injection prevention (use Prisma ORM)
- XSS prevention (sanitize outputs)
- CSRF protection
- Rate limiting (as per API contract)
- Secrets in environment variables ONLY

**Performance:**
- API response time < 200ms (p95)
- Database queries optimized (no N+1)
- Proper indexing on all foreign keys
- Redis caching (as per API contract caching strategy)
- Pagination on ALL list endpoints

**Git Workflow:**
- Feature branches from `main`
- Conventional commits (feat:, fix:, docs:, refactor:, test:)
- PR required for merge
- All tests must pass

---

## Phase 3 Implementation Plan

### Sprint 1: Backend Foundation (Weeks 1-2)

**Priority 1: Authentication & Authorization**
- Implement JWT auth system
- OAuth2 providers (Google, GitHub)
- MFA for platform admins (TOTP)
- Role-based access control (platform_admin, tenant_admin, tenant_member)
- Session management (Redis)

**Endpoints to implement:**
- `POST /api/auth/login`
- `POST /api/auth/login/oauth`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/mfa/verify`
- `GET /api/auth/me`

**Priority 2: Database Schema**
- Design Prisma schema based on API contract types
- Users, Tenants, Agents, Skills, TeamMembers, AuditLogs tables
- Relationships and indexes
- Migrations

**Priority 3: Platform Admin - Dashboard**
- `GET /api/admin/dashboard/stats`
- `GET /api/admin/dashboard/alerts`

**Deliverables:**
- Working auth system with JWT + OAuth
- Database schema with migrations
- 8 endpoints implemented and tested
- Postman collection for testing

---

### Sprint 2: Tenant Management (Weeks 3-4)

**Priority 1: Tenant CRUD**
- `GET /api/admin/tenants` (with pagination, filters, sorting)
- `POST /api/admin/tenants` (async provisioning)
- `GET /api/admin/tenants/:id`
- `PATCH /api/admin/tenants/:id`
- `DELETE /api/admin/tenants/:id`

**Priority 2: Container Management**
- `POST /api/admin/tenants/:id/actions/restart`
- `GET /api/admin/tenants/:id/health`
- `GET /api/admin/tenants/:id/agents`

**Priority 3: WebSocket Events**
- Setup Socket.io server
- Implement `provisioning.progress` event
- Implement `container.health.changed` event

**Deliverables:**
- 8 tenant management endpoints
- Container orchestration service (Docker/K8s integration)
- WebSocket server with 2 event types
- Admin dashboard backend complete

---

### Sprint 3: Agent Management (Weeks 5-6)

**Priority 1: Agent CRUD**
- `GET /api/dashboard/agents`
- `POST /api/dashboard/agents` (with assistedUser fields)
- `GET /api/dashboard/agents/:id`
- `PATCH /api/dashboard/agents/:id`
- `DELETE /api/dashboard/agents/:id`

**Priority 2: Agent Actions**
- `POST /api/dashboard/agents/:id/actions/restart`
- `POST /api/dashboard/agents/:id/actions/pause`
- `POST /api/dashboard/agents/:id/actions/resume`

**Priority 3: Agent Monitoring**
- `GET /api/dashboard/agents/:id/activity`
- `GET /api/dashboard/agents/:id/logs`
- Implement `agent.status.changed` WebSocket event

**Deliverables:**
- 10 agent management endpoints
- Agent lifecycle management
- Activity and log streaming

---

### Sprint 4: Skills & Marketplace (Weeks 7-8)

**Priority 1: Skill Review (Admin)**
- `GET /api/admin/skills/review`
- `GET /api/admin/skills/review/:id`
- `POST /api/admin/skills/review/:id/approve`
- `POST /api/admin/skills/review/:id/reject`
- `GET /api/admin/skills`

**Priority 2: Skill Marketplace (Tenant)**
- `GET /api/dashboard/skills`
- `GET /api/dashboard/skills/:id`
- `POST /api/dashboard/skills/:id/install`
- `DELETE /api/dashboard/skills/:id/uninstall`
- `GET /api/dashboard/skills/installed`

**Deliverables:**
- 10 skill management endpoints
- Skill submission workflow
- Marketplace browsing and installation

---

### Sprint 5: Team & Settings (Weeks 9-10)

**Priority 1: Team Management**
- `GET /api/dashboard/team`
- `POST /api/dashboard/team/invite`
- `DELETE /api/dashboard/team/:id`
- `PATCH /api/dashboard/team/:id`
- `POST /api/dashboard/team/invite/:token/accept`

**Priority 2: Tenant Settings**
- `GET /api/dashboard/settings`
- `PATCH /api/dashboard/settings`
- `GET /api/dashboard/settings/usage`

**Priority 3: API Key Management**
- `GET /api/dashboard/settings/api-keys`
- `POST /api/dashboard/settings/api-keys`
- `DELETE /api/dashboard/settings/api-keys/:id`

**Deliverables:**
- 11 team and settings endpoints
- Invite system with email notifications
- API key generation and management

---

### Sprint 6: Audit & Dashboard (Weeks 11-12)

**Priority 1: Audit Logs**
- `GET /api/dashboard/audit`
- `GET /api/dashboard/audit/export`
- Audit logging middleware (all actions)

**Priority 2: Tenant Dashboard**
- `GET /api/dashboard/stats`

**Priority 3: Testing & Bug Fixes**
- Integration tests for all critical flows
- Load testing
- Security audit
- Bug fixes

**Deliverables:**
- Complete audit system
- Backend 100% API contract compliant
- Production-ready backend

---

### Sprint 7-8: Frontend Implementation (Weeks 13-16)

**Priority 1: Core Screens (Admin)**
- Platform Admin Login (with MFA)
- Admin Dashboard
- Tenant List (with filters, sorting)
- Tenant Provisioning Wizard
- Tenant Detail (5 tabs)
- Skill Review Queue
- Skill Review Detail

**Priority 2: Core Screens (Tenant)**
- Tenant Login
- Tenant Dashboard
- Agent List
- Agent Creation Wizard (5 steps, role-based)
- Agent Detail (4 tabs)
- Skill Marketplace
- Skill Detail

**Priority 3: Management Screens**
- Team Members
- Audit Log
- Settings (with API keys)
- Invite Acceptance

**Deliverables:**
- 18 Next.js pages matching `styled-dsl.yaml`
- React components with Radix UI + shadcn
- Form validation with Zod
- Real-time updates via WebSocket

---

### Sprint 9: Integration & Polish (Weeks 17-18)

**Priority 1: End-to-End Flows**
- Complete tenant onboarding flow
- Complete agent creation and management flow
- Complete skill installation flow
- Complete team management flow

**Priority 2: Performance Optimization**
- Frontend bundle optimization
- API response caching
- Database query optimization
- Load testing (1000 concurrent users)

**Priority 3: DevOps**
- CI/CD pipeline setup
- Docker multi-stage builds
- Kubernetes deployment manifests
- Monitoring and alerting setup

**Deliverables:**
- Production-ready full-stack application
- CI/CD automated deployment
- Monitoring dashboards
- Load test results

---

## Key Reference Documents

**Always reference these files during implementation:**

1. **`docs/api-contract.md`** - Single source of truth for all APIs
2. **`design-artifacts/styled-dsl.yaml`** - UI component specifications
3. **`docs/multi-agent-plan.md`** - Agent architecture (3-layer system)
4. **`docs/security-whitepaper.md`** - Security requirements
5. **`design-artifacts/theme.yaml`** - Design system tokens
6. **`docs/gap-analysis-report.md`** - Quality checklist
7. **`docs/unused-api-endpoints.md`** - Future features roadmap

---

## Agent Selection for Phase 3

Use specialized agents for specific tasks:

**Backend Development:**
- `api-engineer` - NestJS backend, MySQL schemas, REST endpoints
- `qa-engineer` - Unit tests, integration tests, e2e tests

**Frontend Development:**
- `ui-engineer` - Next.js pages, React components, Tailwind styling
- `qa-engineer` - React Testing Library, Playwright e2e

**DevOps:**
- `devops-engineer` - CI/CD, Docker, Kubernetes, monitoring

**Code Quality:**
- `code-reviewer` - Code review, security audit, best practices
- `performance-optimizer` - Performance bottlenecks, optimization

**ONE FEATURE AT A TIME:**
- Never batch features in Phase 3
- Complete one endpoint/screen fully before moving to next
- Test thoroughly before proceeding

---

## Success Criteria

Phase 3 is complete when:

✅ All 67 API endpoints implemented and tested
✅ All 18 screens implemented matching DSL specs
✅ 80%+ test coverage (backend + frontend)
✅ Security audit passed (no critical vulnerabilities)
✅ Performance targets met (API < 200ms, load test passed)
✅ CI/CD pipeline operational
✅ Production deployment successful
✅ End-to-end user flows working

---

## Common Pitfalls to Avoid

❌ **Don't:** Deviate from API contract
✅ **Do:** Follow contract exactly, request changes if needed

❌ **Don't:** Skip validation/error handling
✅ **Do:** Validate all inputs, handle all errors gracefully

❌ **Don't:** Use `any` types in TypeScript
✅ **Do:** Define proper interfaces for everything

❌ **Don't:** Write untested code
✅ **Do:** Write tests alongside implementation

❌ **Don't:** Hardcode configuration
✅ **Do:** Use environment variables for all config

❌ **Don't:** Expose sensitive data in errors
✅ **Do:** Use generic error messages, log details server-side

❌ **Don't:** Skip security checks
✅ **Do:** Implement auth, validation, rate limiting, CORS properly

---

## Getting Started

1. **Read this entire document**
2. **Review `docs/api-contract.md`** - understand the API
3. **Review `design-artifacts/styled-dsl.yaml`** - understand the UI
4. **Choose Sprint 1 first task** (usually auth system)
5. **Use `api-engineer` agent** to implement backend
6. **Use `qa-engineer` agent** to write tests
7. **Commit frequently** with descriptive messages
8. **Move to next task** only when current task is 100% complete

---

## Current Status

- **Phase 1:** ✅ Complete
- **Phase 2:** ✅ Complete
- **Phase 2.5:** ✅ Complete
- **Phase 3:** 🚀 **READY TO START**

**Next Action:** Begin Sprint 1 - Authentication & Authorization

---

**Good luck with Phase 3 implementation! Build something amazing! 🚀**
