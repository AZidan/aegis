# Aegis Platform - Database Schema Documentation

Version: 2.0.0
Last Updated: 2026-02-06
Based on: API Contract v1.1.0
Database: PostgreSQL 15+

## Overview

This document describes the complete database schema for the Aegis Platform, a multi-tenant AI Multi-Agent SaaS. The schema is designed with:

- **Multi-tenancy**: Row-Level Security (RLS) ready with tenantId on all tenant-scoped tables
- **PostgreSQL-specific features**: JSONB columns, UUID primary keys, enum types
- **Performance optimization**: Strategic indexes on foreign keys and frequently queried fields
- **Data integrity**: Proper foreign key constraints with CASCADE/SET NULL policies
- **Scalability**: Designed for distributed systems with UUID primary keys

## Architecture Decisions

### 1. Multi-Tenancy Strategy

All tenant-scoped tables include a `tenantId` field with proper indexing:

- **Tenant isolation**: Each tenant's data is logically separated
- **RLS ready**: Schema prepared for Row-Level Security policies
- **CASCADE deletes**: Tenant deletion automatically cleans up all related data
- **Performance**: Indexes on tenantId for efficient tenant-scoped queries

Tables with tenantId:
- `agents`
- `team_members`
- `team_invites`
- `audit_logs`
- `api_keys`
- `container_health`
- `alerts`

### 2. PostgreSQL-Specific Features

#### JSONB Columns
Used for flexible schemas that evolve over time:

- `agents.toolPolicy` - Dynamic tool access rules
- `agents.assistedUser` - Role-based agent configuration
- `tenants.modelDefaults` - Default model settings per tenant
- `tenants.resourceLimits` - Plan-based resource allocation
- `skills.capabilities` - Skill metadata
- `skills.permissions` - Fine-grained permission sets
- `agent_channels.config` - Channel-specific configuration
- `agent_activities.details` - Activity context
- `audit_logs.details` - Audit trail context

**Performance Note**: Consider adding GIN indexes on JSONB columns for advanced querying:
```sql
CREATE INDEX agents_toolPolicy_gin ON agents USING GIN (toolPolicy);
```

#### UUID Primary Keys
All tables use UUID primary keys for:
- **Distributed systems**: No ID collision across services
- **Security**: Non-sequential IDs prevent enumeration attacks
- **Scalability**: Independent ID generation across database shards

#### Enum Types
Type-safe status fields with PostgreSQL enums:
- `UserRole`, `TenantStatus`, `TenantPlan`
- `AgentRole`, `AgentStatus`, `ModelTier`, `ThinkingMode`
- `SkillCategory`, `SkillStatus`
- `ChannelType`, `ActivityType`
- `AuditActorType`, `AuditTargetType`, `AuditSeverity`
- `AlertSeverity`, `HealthStatus`, `InviteStatus`

### 3. Relationship Patterns

#### Cascade Delete (ON DELETE CASCADE)
Used for parent-child relationships where child data should be deleted with parent:

- `User.tenantId` → `Tenant.id`
- `Agent.tenantId` → `Tenant.id`
- `RefreshToken.userId` → `User.id`
- `TeamMember.tenantId/userId` → `Tenant/User.id`
- `AgentChannel.agentId` → `Agent.id`
- All other parent-child relations

#### Set Null (ON DELETE SET NULL)
Used for audit trails where we want to preserve history even if referenced entity is deleted:

- `AuditLog.userId` → `User.id`
- `AuditLog.agentId` → `Agent.id`

#### Restrict (ON DELETE RESTRICT)
Used where deletion should be prevented if dependencies exist:

- `Skill.authorId` → `User.id` (can't delete user with published skills)

## Schema Overview

### Core Tables (4)

#### 1. Users
Platform admins, tenant admins, and tenant members.

**Key Features:**
- Supports both password and OAuth authentication
- MFA support (platform admins only)
- Multi-tenant aware (nullable tenantId for platform admins)
- Tracks last login for security monitoring

**Fields:**
- `id` (UUID, PK)
- `email` (unique)
- `name`
- `password` (nullable for OAuth users)
- `role` (UserRole enum)
- `tenantId` (nullable, FK to tenants)
- `mfaEnabled`, `mfaSecret` (TOTP support)
- `oauthProvider`, `oauthId` (OAuth integration)
- `lastLoginAt` (security tracking)

**Indexes:**
- email (unique)
- tenantId
- role
- oauthProvider + oauthId (unique composite)

#### 2. Tenants
Companies/organizations with isolated container environments.

**Key Features:**
- Async provisioning workflow (status: provisioning → active/failed)
- JSONB configuration for model defaults and resource limits
- Container tracking (Docker integration)
- Plan-based resource allocation

**Fields:**
- `id` (UUID, PK)
- `companyName` (unique)
- `adminEmail`
- `status` (TenantStatus enum)
- `plan` (TenantPlan enum)
- `industry`, `expectedAgentCount` (provisioning info)
- `modelDefaults` (JSONB) - Default AI model settings
- `resourceLimits` (JSONB) - CPU, memory, disk, maxAgents
- `containerId`, `containerUrl` (Docker integration)

**Indexes:**
- companyName (unique)
- status
- plan

#### 3. Agents
AI agents deployed for tenants.

**Key Features:**
- Role-based agent templates (PM, Engineering, Operations, Custom)
- Model tier and thinking mode configuration
- JSONB tool policies for flexible permission management
- Assisted user configuration for role-based agents
- OpenClaw integration tracking

**Fields:**
- `id` (UUID, PK)
- `name`, `description`
- `role` (AgentRole enum)
- `status` (AgentStatus enum)
- `tenantId` (FK to tenants)
- `modelTier` (ModelTier enum)
- `thinkingMode` (ThinkingMode enum)
- `toolPolicy` (JSONB) - Tool access rules
- `assistedUser` (JSONB) - Role-based configuration
- `openclawAgentId` (external system ID)
- `lastActive` (activity tracking)

**Indexes:**
- tenantId
- status
- role
- lastActive

#### 4. Skills
Marketplace skills for agents.

**Key Features:**
- Approval workflow (pending → in_review → approved/rejected)
- Full source code storage for review
- JSONB permissions and capabilities
- Version control (unique name+version)
- Marketplace metrics (rating, install count)

**Fields:**
- `id` (UUID, PK)
- `name`, `version`, `description`
- `category` (SkillCategory enum)
- `status` (SkillStatus enum)
- `authorId` (FK to users)
- `compatibleRoles` (string array)
- `repositoryUrl`, `mainFile`, `sourceCode` (code storage)
- `capabilities`, `configuration`, `permissions` (JSONB)
- `documentation`, `changelog` (text fields)
- `reviewNotes`, `reviewedAt`, `reviewedBy` (review tracking)
- `rating`, `installCount` (marketplace metrics)

**Indexes:**
- name + version (unique composite)
- category
- status
- rating
- installCount

### Authentication & Authorization (2)

#### 5. RefreshTokens
JWT refresh token tracking for secure session management.

**Key Features:**
- Token expiry tracking (7 days)
- Revocation support
- Device tracking (user agent, IP address)

**Fields:**
- `id` (UUID, PK)
- `token` (unique)
- `userId` (FK to users)
- `expiresAt`
- `revokedAt` (nullable)
- `userAgent`, `ipAddress` (device tracking)

**Indexes:**
- token (unique)
- userId
- expiresAt

#### 6. ApiKeys
Tenant API keys for programmatic access.

**Key Features:**
- Hashed key storage (like passwords)
- Key prefix for display (first 12 chars)
- Expiry and revocation support
- Last used tracking

**Fields:**
- `id` (UUID, PK)
- `name` (descriptive name)
- `keyHash` (unique, hashed)
- `keyPrefix` (display, e.g., "aegis_sk_abc")
- `tenantId` (FK to tenants)
- `lastUsedAt`, `expiresAt`, `revokedAt`

**Indexes:**
- keyHash (unique)
- tenantId
- keyPrefix

### Team Management (2)

#### 7. TeamMembers
Users belonging to a tenant (many-to-many relationship).

**Key Features:**
- Links users to tenants
- Role-based access within tenant
- Unique constraint on userId + tenantId

**Fields:**
- `id` (UUID, PK)
- `userId` (FK to users)
- `tenantId` (FK to tenants)
- `role` (UserRole enum)
- `joinedAt`

**Indexes:**
- userId + tenantId (unique composite)
- tenantId
- userId

#### 8. TeamInvites
Pending team invitations.

**Key Features:**
- Token-based invite system
- 7-day expiry
- Status tracking (pending/accepted/expired/cancelled)
- Stores inviter information

**Fields:**
- `id` (UUID, PK)
- `email`
- `role` (UserRole enum)
- `status` (InviteStatus enum)
- `tenantId` (FK to tenants)
- `token` (unique)
- `inviteLink` (full URL)
- `invitedBy` (user ID)
- `expiresAt`, `acceptedAt`

**Indexes:**
- token (unique)
- tenantId
- email
- status

### Agent Channels & Activity (3)

#### 9. AgentChannels
Communication channels (Telegram, Slack, Web).

**Key Features:**
- JSONB config for channel-specific settings
- Connection status tracking
- Last message timestamp

**Fields:**
- `id` (UUID, PK)
- `type` (ChannelType enum)
- `connected` (boolean)
- `agentId` (FK to agents)
- `config` (JSONB) - Channel-specific settings
- `lastMessageAt`

**Indexes:**
- agentId
- type

#### 10. AgentActivities
Activity feed for agents.

**Key Features:**
- Activity type classification
- JSONB details for flexible context
- Timestamp indexing for time-series queries

**Fields:**
- `id` (UUID, PK)
- `type` (ActivityType enum)
- `agentId` (FK to agents)
- `summary`
- `details` (JSONB) - Activity context
- `timestamp`

**Indexes:**
- agentId
- timestamp
- type

#### 11. AgentMetrics
Performance metrics for agents.

**Key Features:**
- Time-windowed metrics (periodStart/periodEnd)
- Message count, tool invocations, errors
- Average response time tracking

**Fields:**
- `id` (UUID, PK)
- `agentId` (FK to agents)
- `messageCount`, `toolInvocations`, `errorCount`
- `avgResponseTime` (milliseconds)
- `periodStart`, `periodEnd`

**Indexes:**
- agentId
- periodStart

### Skill Installations (1)

#### 12. SkillInstallations
Installed skills per agent (many-to-many).

**Key Features:**
- Links agents to skills
- JSONB config for skill-specific settings
- Unique constraint on agentId + skillId

**Fields:**
- `id` (UUID, PK)
- `agentId` (FK to agents)
- `skillId` (FK to skills)
- `config` (JSONB) - Skill configuration
- `installedAt`

**Indexes:**
- agentId + skillId (unique composite)
- agentId
- skillId

### Monitoring & Health (2)

#### 13. ContainerHealth
Container health metrics (time-series data).

**Key Features:**
- Resource usage tracking (CPU, memory, disk)
- Health status classification
- Uptime tracking

**Fields:**
- `id` (UUID, PK)
- `tenantId` (FK to tenants)
- `status` (HealthStatus enum)
- `cpuPercent`, `memoryMb`, `diskGb`, `uptime`
- `timestamp`

**Indexes:**
- tenantId
- timestamp
- status

**Data Retention:**
- Hot storage: 24 hours detailed (5-minute intervals)
- Cold storage: 30 days aggregated (1-hour intervals)

#### 14. Alerts
Platform alerts for admins.

**Key Features:**
- Severity classification (info/warning/critical)
- Optional tenant association (platform-wide or tenant-specific)
- Resolution tracking

**Fields:**
- `id` (UUID, PK)
- `severity` (AlertSeverity enum)
- `title`, `message`
- `tenantId` (nullable, FK to tenants)
- `resolved`, `resolvedAt`, `resolvedBy`

**Indexes:**
- tenantId
- severity
- resolved
- createdAt

### Audit & Compliance (1)

#### 15. AuditLogs
Comprehensive audit trail for compliance.

**Key Features:**
- Actor tracking (who performed action)
- Target tracking (what was affected)
- JSONB details for flexible context
- Multi-tenancy support
- Network tracking (IP, user agent)

**Fields:**
- `id` (UUID, PK)
- `actorType` (AuditActorType enum)
- `actorId`, `actorName`
- `action` (e.g., "agent_created", "tool_invocation")
- `targetType` (AuditTargetType enum)
- `targetId`
- `details` (JSONB) - Masked sensitive data
- `severity` (AuditSeverity enum)
- `ipAddress`, `userAgent`
- `tenantId` (nullable, FK to tenants)
- `userId`, `agentId` (nullable, for context)
- `timestamp`

**Indexes:**
- tenantId
- actorId
- targetType + targetId (composite)
- action
- timestamp
- severity

**Data Retention:**
- Hot storage: 90 days in PostgreSQL
- Cold storage: 1 year in S3/object storage
- Implement archival job for compliance

## Performance Optimization

### Index Strategy

1. **Primary Keys**: UUID indexes on all tables
2. **Foreign Keys**: Indexes on all FK columns for join performance
3. **Unique Constraints**: email, companyName, tokens, etc.
4. **Status Fields**: Indexed for filtering (tenant status, agent status, etc.)
5. **Timestamps**: Indexed for time-series queries (lastActive, timestamp, etc.)
6. **Composite Indexes**: Multi-column indexes where needed (targetType + targetId)

### JSONB Optimization

For advanced JSONB queries, consider GIN indexes:

```sql
-- Enable GIN indexing extension
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Create GIN indexes on JSONB columns
CREATE INDEX agents_toolPolicy_gin ON agents USING GIN (toolPolicy);
CREATE INDEX agents_assistedUser_gin ON agents USING GIN (assistedUser);
CREATE INDEX skills_capabilities_gin ON skills USING GIN (capabilities);
CREATE INDEX skills_permissions_gin ON skills USING GIN (permissions);
CREATE INDEX tenants_modelDefaults_gin ON tenants USING GIN (modelDefaults);
CREATE INDEX tenants_resourceLimits_gin ON tenants USING GIN (resourceLimits);
```

### Query Performance Tips

1. **Tenant-scoped queries**: Always filter by tenantId first
2. **Status filtering**: Use enum indexes for fast status checks
3. **Time-series data**: Use timestamp indexes with BETWEEN clauses
4. **JSONB queries**: Use jsonb operators (@>, ->, ->>) with GIN indexes
5. **Pagination**: Use keyset pagination (cursor-based) instead of OFFSET

## Security Considerations

### Password & Secret Storage

- **User passwords**: Hashed with bcrypt (handled in application layer)
- **API keys**: Hashed before storage (like passwords)
- **MFA secrets**: Encrypted before storage (application layer)
- **OAuth tokens**: Not stored, only OAuth provider ID

### Sensitive Data Handling

- **Audit logs**: Sensitive fields (passwords, tokens) masked in details JSONB
- **Skill source code**: Only accessible to platform admins during review
- **Container credentials**: Not stored in database, managed by orchestrator

### Multi-Tenancy Isolation

- **Row-Level Security (RLS)**: Schema ready for PostgreSQL RLS policies
- **Application-level**: tenantId filtering enforced in application queries
- **CASCADE deletes**: Tenant deletion removes all tenant data automatically

### Audit Trail

- **Comprehensive logging**: All actions logged to audit_logs table
- **Actor tracking**: User, agent, or system actions
- **Target tracking**: What entity was affected
- **Network tracking**: IP address and user agent for security analysis

## Data Retention & Archival

### Hot Storage (PostgreSQL)

- **AuditLog**: 90 days
- **ContainerHealth**: 24 hours (detailed)
- **RefreshToken**: Until expiry (7 days) + 30 days
- **TeamInvite**: Until acceptance or expiry (7 days) + 30 days

### Cold Storage (S3/Object Storage)

- **AuditLog**: 1 year (compressed)
- **ContainerHealth**: 30 days (aggregated)

### Cleanup Jobs (Scheduled)

1. **Expired refresh tokens**: Daily cleanup of tokens past expiresAt + 30 days
2. **Expired team invites**: Daily cleanup of invites past expiresAt + 30 days
3. **Audit log archival**: Weekly archival of logs older than 90 days to S3
4. **Container health aggregation**: Hourly aggregation of detailed metrics

## Migration Strategy

### Initial Migration

Run the migration file:
```bash
npx prisma migrate deploy
```

This will:
1. Create all enum types
2. Create all 15 tables with proper constraints
3. Create all indexes
4. Add all foreign key relationships

### Future Schema Changes

1. **Never modify existing migrations** - Always create new migration files
2. **Test migrations on staging** - Validate data integrity before production
3. **Backward compatibility** - Ensure API remains compatible during migration
4. **Zero-downtime deployments** - Use techniques like:
   - Add new column (nullable)
   - Deploy code that writes to both old and new columns
   - Backfill data
   - Deploy code that reads from new column
   - Drop old column

## ER Diagram

```
┌─────────────┐
│   Tenants   │
│ (companies) │
└──────┬──────┘
       │
       │ 1:N
       │
       ├────────────────┬──────────────┬─────────────┬────────────┐
       │                │              │             │            │
       ▼                ▼              ▼             ▼            ▼
┌──────────┐   ┌──────────────┐ ┌─────────────┐ ┌────────┐ ┌─────────┐
│  Users   │   │    Agents    │ │ TeamMembers │ │ Alerts │ │ ApiKeys │
└────┬─────┘   └──────┬───────┘ └─────────────┘ └────────┘ └─────────┘
     │                │
     │ 1:N            │ 1:N
     │                │
     ▼                ├─────────────┬─────────────┬──────────────┐
┌─────────────┐       │             │             │              │
│RefreshTokens│       ▼             ▼             ▼              ▼
└─────────────┘ ┌──────────┐ ┌──────────┐ ┌─────────────┐ ┌──────────┐
                │Channels  │ │Activity  │ │  Metrics    │ │ Skills   │
                └──────────┘ └──────────┘ └─────────────┘ │(M:N via  │
                                                           │Install.) │
                                                           └──────────┘
```

## API Contract Alignment

This schema is fully aligned with API Contract v1.1.0:

- All Global Types match exactly (User, Tenant, Agent, Skill)
- All enum values match API specifications
- All request/response fields are supported
- JSONB columns accommodate flexible API requirements
- Indexes optimize API endpoint performance

## Prisma 7 Configuration

This schema uses Prisma 7 features:

```prisma
generator client {
  provider = "prisma-client"  // Modern Prisma 7 provider
  output   = "./generated"    // Required for Prisma 7
}

datasource db {
  provider = "postgresql"
  // URL configured in prisma.config.ts (Prisma 7 requirement)
}
```

Import Prisma Client from generated directory:
```typescript
import { PrismaClient } from '../../prisma/generated/client';
```

## Next Steps

1. **Start PostgreSQL**: Ensure database server is running
2. **Apply migration**: `npx prisma migrate deploy`
3. **Generate client**: `npx prisma generate`
4. **Seed data**: Create seed script for development data
5. **Implement services**: Build NestJS services using Prisma Client
6. **Add RLS policies**: Implement Row-Level Security for multi-tenancy
7. **Implement cleanup jobs**: Schedule data retention and archival tasks

---

**Document Version**: 2.0.0
**Schema Version**: 2.0.0
**API Contract Version**: 1.1.0
**Last Updated**: 2026-02-06
