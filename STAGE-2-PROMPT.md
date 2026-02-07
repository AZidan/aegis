# Stage 2: Database Schema Design - Context Prompt

I'm ready to start **Stage 2 (Database Schema Design)** for the Aegis Platform - a multi-tenant AI Multi-Agent SaaS.

---

## 📍 Current Status

**Completed:**
- ✅ **Phase 1**: Strategy & Planning (business model, personas, architecture)
- ✅ **Phase 2**: Design (user flows, design system, 18 screen specs)
- ✅ **Phase 2.5**: API Architecture (67 REST endpoints, prototypes, gap analysis)
- ✅ **Stage 1 (Phase 3)**: Backend + Frontend project setup complete

**Starting:** Stage 2 - Database Schema Design

---

## 🎯 Project Context

**What it is:** Multi-tenant SaaS where each company gets their own isolated OpenClaw container with custom AI agents. Platform admins manage tenants, tenant admins create agents and manage teams.

**Architecture:** 3-layer agent system (Shared Toolbox → Role Skills → Individual Agent Config)

---

## 🔧 Tech Stack (Confirmed)

**Backend:** NestJS + TypeScript + **PostgreSQL 16+** + **Prisma 7** + Redis + Socket.io
**Frontend:** Next.js 15 App Router + TypeScript + Tailwind + Radix UI + shadcn

**Database:** PostgreSQL 16+ (chosen for RLS, JSONB, pgvector, scalability)
**ORM:** Prisma 7 with `prisma-client` provider (Rust-free, 3x faster)

---

## 📂 Critical Files

**MUST READ BEFORE STARTING:**
1. `docs/api-contract.md` (v1.1.0) - **SINGLE SOURCE OF TRUTH** for all API types and endpoints
2. `docs/phase-3-context.md` - Phase 3 implementation guidelines
3. `backend/PRISMA7_SETUP.md` - Prisma 7 configuration explanation
4. `backend/prisma.config.ts` - Prisma 7 config (database URL)
5. `backend/prisma/schema.prisma` - Current schema (placeholder only)

---

## 🚨 CRITICAL: CodeMap Usage (MANDATORY)

### **ALL AGENTS MUST USE CODEMAP FOR FILE OPERATIONS**

**Why?** CodeMap reduces token usage by 60-80% by allowing targeted file reads instead of reading entire files.

### **Setup Verification:**
```bash
# Verify CodeMap is installed and initialized
codemap validate

# If not initialized:
codemap init .
codemap watch . &
```

### **Mandatory CodeMap Workflow:**

**Before reading ANY file:**
```bash
# 1. Find exact location first
codemap find "PrismaService" --type class

# OR use fuzzy search if unsure
codemap find "prisma" -f --type class

# Output shows: src/prisma/prisma.service.ts:5-53
```

**Then read ONLY the relevant lines:**
```bash
Read src/prisma/prisma.service.ts lines 5-53
```

**Before editing ANY file:**
```bash
# 1. Get file structure
codemap show src/prisma/prisma.service.ts

# 2. Find exact method/class location
codemap find "onModuleInit" --type method

# 3. Edit precisely at the correct line range
Edit src/prisma/prisma.service.ts (use exact old_string from lines shown)
```

**Exploring file structure:**
```bash
# See all symbols without reading full file
codemap show backend/src/config/configuration.ts

# Find all services
codemap find "Service" -f --type class

# Find all controllers
codemap find "Controller" -f --type class
```

### **❌ NEVER:**
- Read entire files without checking CodeMap first
- Use grep/find when CodeMap can locate symbols
- Scan directories when CodeMap has indexed them
- Read files "just to see what's there" - use `codemap show` instead

### **✅ ALWAYS:**
- Check `codemap find` before reading any file
- Use `codemap find "term" -f` for fuzzy search when unsure of exact name
- Use `codemap show` to understand file structure before editing
- Read specific line ranges only
- Validate index freshness with `codemap validate` if uncertain

### **Target: <20% of tokens spent on file operations**

---

## 🎯 Stage 2 Goal: Complete Database Schema

Design and implement the complete Prisma schema with all tables, relationships, indexes, and constraints.

---

## 📋 Stage 2 Tasks

### **Task 1: Schema Design (api-engineer)**

Design the complete Prisma schema based on `docs/api-contract.md` types.

**Models to Create (12+ tables):**

**Core Models:**
1. **User** - Platform admins, tenant admins, tenant members
   - id, email, name, password, role, tenantId, mfaEnabled, mfaSecret, createdAt, updatedAt
   - Roles: "platform_admin" | "tenant_admin" | "tenant_member"

2. **Tenant** - Companies/organizations
   - id, companyName, adminEmail, status, plan, industry, expectedAgentCount
   - status: "active" | "suspended" | "provisioning" | "failed"
   - plan: "starter" | "growth" | "enterprise"
   - modelDefaults (JSONB), resourceLimits (JSONB)

3. **Agent** - AI agents for tenants
   - id, name, tenantId, role, status, modelTier, thinkingMode
   - assistedUser (JSONB) - Role-based agent configuration
   - channels, installedSkills (relations)

4. **Skill** - Marketplace skills
   - id, name, version, category, status, description, authorId
   - status: "pending" | "approved" | "rejected"
   - capabilities (JSONB), configuration (JSONB)

**Supporting Models:**
5. **RefreshToken** - JWT refresh tokens
6. **TeamMember** - Tenant team members
7. **TeamInvite** - Pending invitations
8. **AuditLog** - All system actions
9. **ApiKey** - Tenant API keys
10. **ContainerHealth** - Container monitoring
11. **AgentMetrics** - Agent performance data
12. **SkillInstallation** - Installed skills per agent

**Additional Models (from API contract):**
13. **AgentChannel** - Communication channels (Slack, Telegram, Web)
14. **AgentActivity** - Activity logs
15. **Alert** - Platform alerts

### **Task 2: Relationships & Constraints**

**Define all relationships:**
- User → Tenant (many-to-one)
- Tenant → Agent (one-to-many)
- Agent → Skill (many-to-many via SkillInstallation)
- Agent → AgentChannel (one-to-many)
- User → RefreshToken (one-to-many)
- Tenant → TeamMember (one-to-many)
- Tenant → AuditLog (one-to-many)

**Indexes:**
- Foreign keys (all relations)
- Unique constraints (email, companyName, etc.)
- Search indexes (names, descriptions)
- JSONB indexes (GIN indexes for agent configs, skill capabilities)

**Constraints:**
- ON DELETE CASCADE where appropriate
- ON DELETE RESTRICT for critical relations
- Check constraints for enums
- Default values

### **Task 3: PostgreSQL-Specific Features**

**Leverage PostgreSQL advantages:**

1. **JSONB Columns** (for flexible schemas):
   - Agent.assistedUser (role-based config)
   - Skill.capabilities
   - Tenant.modelDefaults
   - Tenant.resourceLimits

2. **Row-Level Security (RLS)** preparation:
   - Add `tenantId` to all tenant-scoped tables
   - Document RLS policies to implement later
   - Ensure proper indexing on tenant_id

3. **Full-Text Search** preparation:
   - Add @map attributes for search fields
   - Document search index setup

4. **Enum Types:**
   - Use Prisma enums for status fields
   - Role types
   - Plan types

### **Task 4: Prisma 7 Specifics**

**Important Prisma 7 considerations:**

```prisma
// Current generator configuration (DO NOT CHANGE)
generator client {
  provider = "prisma-client"
  output   = "./generated"
}

datasource db {
  provider = "postgresql"
  // URL configured in prisma.config.ts
}

// Use proper Prisma 7 syntax
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  tenant    Tenant?  @relation(fields: [tenantId], references: [id])
  tenantId  String?

  @@index([email])
  @@map("users")
}
```

### **Task 5: Migration & Validation**

After schema is complete:

```bash
# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name initial_schema

# Validate schema
npx prisma validate

# Format schema
npx prisma format
```

### **Task 6: Seed Data (Optional)**

Create `prisma/seed.ts` with:
- 1 platform admin user (for testing)
- 1-2 test tenants
- Sample data for development

---

## 📊 Acceptance Criteria

**Schema must have:**
- [ ] All 12+ models defined with proper types
- [ ] All relationships configured correctly
- [ ] All indexes on foreign keys and search fields
- [ ] JSONB columns for flexible data (agent configs, skill capabilities)
- [ ] Proper enums for status fields
- [ ] Row-level security preparation (tenantId on all tenant-scoped tables)
- [ ] Comments explaining complex fields
- [ ] Proper naming conventions (@map for table names)
- [ ] UUID primary keys (not auto-increment integers)
- [ ] Timestamps (createdAt, updatedAt) on all tables

**Validation:**
- [ ] `npx prisma validate` passes
- [ ] `npx prisma generate` succeeds
- [ ] Migration creates without errors
- [ ] TypeScript compilation works
- [ ] All types from API contract are represented

---

## 🔍 API Contract Mapping

**Reference `docs/api-contract.md` section 12 (Global Types) for:**
- User types
- Tenant types
- Agent types
- Skill types
- Error types
- Pagination types

**Ensure schema models match API contract interfaces EXACTLY.**

---

## 🚨 Critical Rules for Stage 2

### **1. API Contract Compliance**
- Schema must match ALL types in `docs/api-contract.md`
- No extra fields without justification
- No missing fields
- Exact enum values as specified

### **2. CodeMap Usage (MANDATORY)**
**ALL agents (main and sub-agents) MUST use CodeMap for file operations:**
- Use `codemap find` before reading files
- Use `codemap find -f` for fuzzy search
- Use `codemap show` to understand structure
- Read specific line ranges only
- **Target: <20% tokens on file reads**

### **3. PostgreSQL Best Practices**
- Use JSONB for flexible schemas (not JSON)
- Add GIN indexes on JSONB columns for search
- Use UUIDs for primary keys (not integers)
- Add proper foreign key constraints
- Plan for Row-Level Security (add tenantId everywhere)

### **4. Prisma 7 Compliance**
- Keep `provider = "prisma-client"` (do NOT change to prisma-client-js)
- Keep `output = "./generated"` (required for Prisma 7)
- Use proper Prisma 7 syntax for relations
- Import from `../../prisma/generated/client` (not @prisma/client)

### **5. Multi-Tenancy Considerations**
- Add `tenantId` to ALL tenant-scoped tables
- Index on `tenantId` for performance
- Document RLS policies to implement
- Ensure cascade deletes are safe

---

## 🎯 Agent Instructions

### **Backend: Use `api-engineer` for:**
- Schema design and implementation
- Migration creation
- Database setup
- Seed data creation
- Type generation

### **Backend Agent MUST:**
1. **Read API contract** (`docs/api-contract.md`) USING CODEMAP
2. **Use CodeMap** for ALL file operations (find → read lines → edit)
3. **Follow Prisma 7** configuration exactly
4. **Map all API types** to database models
5. **Add proper indexes** for performance
6. **Document complex fields** with comments
7. **Validate schema** after completion
8. **Create migration** with clear name

---

### **Frontend: Use `ui-engineer` for:**
- Generate TypeScript types from Prisma schema
- Create API client type definitions
- Update frontend types to match backend

### **Frontend Agent MUST:**
1. **Use CodeMap** for ALL frontend file operations
2. **Generate types** from Prisma schema for frontend use
3. **Update API client** type definitions in `frontend/src/lib/api/types.ts`
4. **Create type utilities** for API responses (frontend/src/types/)
5. **Ensure type safety** between frontend and backend
6. **Test TypeScript compilation** after type updates

---

## 📝 Deliverables

1. ✅ Complete `backend/prisma/schema.prisma` with all models
2. ✅ Migration file (`prisma/migrations/XXX_initial_schema/`)
3. ✅ Generated Prisma Client (`prisma/generated/`)
4. ✅ Updated TypeScript types (compile successfully)
5. ✅ `backend/DATABASE_SCHEMA.md` - Documentation of schema design
6. ✅ Optional: `prisma/seed.ts` - Seed data script

---

## 🚀 Getting Started

**Step 1:** Verify CodeMap is ready
```bash
codemap validate
```

**Step 2:** Read the API contract (use CodeMap!)
```bash
codemap find "Global Types" docs/api-contract.md
Read docs/api-contract.md lines <from-codemap-output>
```

**Step 3:** Launch api-engineer agent
```bash
Use api-engineer agent to design and implement complete Prisma schema
```

**Step 4:** Validate and test
```bash
npx prisma validate
npx prisma generate
npm run build
```

---

## 💡 Tips for Success

1. **Start with core models** (User, Tenant, Agent, Skill) then add supporting tables
2. **Reference API contract types** - they show exactly what fields are needed
3. **Use JSONB liberally** - AI agents need flexible configuration storage
4. **Think about queries** - add indexes where you'll filter/search
5. **Plan for scale** - proper indexes make 1000x difference at scale
6. **Document decisions** - add comments explaining why certain fields exist

---

## 📚 Reference Documentation

**In this repo:**
- `docs/api-contract.md` - API types (MUST READ)
- `docs/phase-3-context.md` - Implementation guidelines
- `backend/PRISMA7_SETUP.md` - Prisma 7 setup explanation
- `backend/prisma.config.ts` - Database configuration

**External:**
- [Prisma 7 Schema Reference](https://www.prisma.io/docs/orm/prisma-schema)
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html)
- [Prisma 7 Relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations)

---

## ⚠️ Common Pitfalls to Avoid

❌ **Don't:** Use `@prisma/client` import (Prisma 7 uses direct import)
❌ **Don't:** Read entire files without CodeMap
❌ **Don't:** Use auto-increment IDs (use UUIDs)
❌ **Don't:** Skip indexes on foreign keys
❌ **Don't:** Forget tenantId on tenant-scoped tables
❌ **Don't:** Use JSON (use JSONB)

✅ **Do:** Import from `../../prisma/generated/client`
✅ **Do:** Use CodeMap for ALL file operations
✅ **Do:** Use UUID @default(uuid())
✅ **Do:** Index all foreign keys and tenantId
✅ **Do:** Add tenantId to every tenant-scoped table
✅ **Do:** Use JSONB with GIN indexes

---

## 🎯 Success Definition

Stage 2 is complete when:
- ✅ Schema has all models with proper relationships
- ✅ Migration runs successfully
- ✅ Prisma Client generates without errors
- ✅ TypeScript compiles with new types
- ✅ All API contract types are represented
- ✅ Schema is documented in DATABASE_SCHEMA.md
- ✅ CodeMap was used for <20% token usage on file ops

---

**Let's design a production-ready database schema! 🚀**

**Ready to start? Use the `api-engineer` agent with MANDATORY CodeMap usage.**
