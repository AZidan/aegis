# Phase 3 Implementation - Context Prompt

I'm working on **Phase 3 (Implementation)** of the Aegis Platform - a multi-tenant AI Multi-Agent SaaS.

## Project Context

**What it is:** Multi-tenant SaaS where each company gets their own isolated OpenClaw container with custom AI agents. Platform admins manage tenants, tenant admins create agents and manage teams.

**Phases completed:**
- ✅ Phase 1: Strategy & Planning (business model, personas, architecture)
- ✅ Phase 2: Design (user flows, design system, 18 screen specs)
- ✅ Phase 2.5: API Architecture (67 REST endpoints, prototypes, gap analysis)

**Starting:** Phase 3 - Backend + Frontend Implementation

## Tech Stack

**Backend:** NestJS + TypeScript + MySQL + Prisma + Redis + Socket.io
**Frontend:** Next.js 15 App Router + TypeScript + Tailwind + Radix UI + shadcn
**Infrastructure:** Docker + Kubernetes + GitHub Actions

## Critical Files

**📄 Read these files first:**
1. `docs/phase-3-context.md` - Complete Phase 3 implementation guide
2. `docs/api-contract.md` (v1.1.0) - **SINGLE SOURCE OF TRUTH** for all 67 endpoints
3. `design-artifacts/styled-dsl.yaml` - All 18 screen specifications (6,348 lines)
4. `docs/multi-agent-plan.md` - 3-layer agent architecture
5. `docs/gap-analysis-report.md` - Quality checklist

## Phase 3 Critical Rules

🚨 **API CONTRACT IS SACRED - ZERO TOLERANCE FOR DEVIATIONS**
- Follow `docs/api-contract.md` EXACTLY
- No extra fields, no missing fields, exact status codes
- Confirm understanding before implementing ANY endpoint

🗺️ **MANDATORY: USE CODEMAP FOR ALL FILE OPERATIONS**
- **NEVER read full files** - use `codemap find` to locate symbols first
- **Use fuzzy search** - `codemap find "term" -f` when unsure of exact name
- **Read specific line ranges only** - saves 60-80% tokens
- **Before editing** - use `codemap show` to see file structure
- **Example:** `codemap find "UserService"` → read lines 15-189 only
- **Fuzzy example:** `codemap find "auth" -f --type class` → finds AuthService, AuthController, etc.
- **Setup:** `pip install git+https://github.com/AZidan/codemap.git && codemap init . && codemap watch . &`
- **Target:** <20% of tokens spent on file operations

⚡ **Development Standards:**
- TypeScript strict mode (no `any`)
- 80%+ test coverage
- Zod validation on ALL inputs
- Proper error handling
- Security: prevent XSS, SQL injection, CSRF
- Performance: API < 200ms p95

🎯 **Implementation Approach:**
- ONE feature at a time (never batch)
- Use specialized agents: `api-engineer`, `ui-engineer`, `qa-engineer`
- **Agents MUST use codemap** for all file reads/edits
- Test thoroughly before moving to next task
- Commit frequently with clear messages

## Current Sprint: Sprint 1 (Weeks 1-2)

**Goals:**
1. Implement authentication system (JWT + OAuth + MFA)
2. Design database schema (Prisma)
3. Implement platform admin dashboard endpoints

**Endpoints to build:**
- POST /api/auth/login
- POST /api/auth/login/oauth
- POST /api/auth/refresh
- POST /api/auth/logout
- POST /api/auth/mfa/verify
- GET /api/auth/me
- GET /api/admin/dashboard/stats
- GET /api/admin/dashboard/alerts

**Deliverables:**
- Working auth with JWT + OAuth2 (Google, GitHub)
- MFA for platform admins (TOTP)
- Database schema with all tables
- 8 endpoints tested and working
- Postman collection

## My Request

I'm ready to start Sprint 1. Please help me:
1. Read `docs/phase-3-context.md` for full implementation plan
2. Review `docs/api-contract.md` sections 1-2 (Auth + Admin Dashboard)
3. Guide me through implementing the auth system
4. Use `api-engineer` agent for backend work
5. Use `qa-engineer` agent for test writing

**CRITICAL INSTRUCTIONS FOR ALL AGENTS:**
- ✅ **MUST use CodeMap** for ALL file operations (find, read, edit)
- ✅ **NEVER read full files** - use `codemap find` → read specific line ranges
- ✅ **Use fuzzy search** - `codemap find "term" -f` when uncertain of exact name
- ✅ **Before editing** - use `codemap show` to see structure
- ✅ **Example workflow:**
  ```bash
  # Find symbol location first (exact match)
  codemap find "AuthService"

  # OR use fuzzy search (if unsure)
  codemap find "auth" -f --type class

  # Read ONLY the relevant lines
  Read src/auth/auth.service.ts lines 10-85

  # Edit precisely
  Edit src/auth/auth.service.ts (old_string from lines 10-85)
  ```

Let's build this step by step, following the API contract exactly. What should we tackle first?

---

**Note:** Always reference the API contract before implementing anything. The contract is the single source of truth - ZERO deviations allowed.

**Token Efficiency:** Agents MUST use CodeMap to reduce token usage by 60-80% on file operations. This is MANDATORY for Phase 3.
