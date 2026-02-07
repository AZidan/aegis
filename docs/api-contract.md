# Aegis Platform API Contract

**Version:** 1.2.0
**Last Updated:** 2026-02-07
**Status:** Single Source of Truth
**Framework:** NestJS + TypeScript
**Database:** PostgreSQL 16 + Redis 7+

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization)
2. [Platform Admin: Dashboard](#2-platform-admin-dashboard)
3. [Platform Admin: Tenants](#3-platform-admin-tenants)
4. [Platform Admin: Skills](#4-platform-admin-skills)
5. [Tenant: Dashboard](#5-tenant-dashboard)
6. [Tenant: Agents](#6-tenant-agents)
7. [Tenant: Skills](#7-tenant-skills)
8. [Tenant: Team Management](#8-tenant-team-management)
9. [Tenant: Audit](#9-tenant-audit)
10. [Tenant: Settings](#10-tenant-settings)
11. [WebSocket Events](#11-websocket-events)
12. [Global Types](#12-global-types)

---

## Global Standards

### Authentication Headers
```http
Authorization: Bearer <access_token>
Content-Type: application/json
X-Tenant-Id: <tenant_uuid>  # Auto-injected from JWT for tenant endpoints
```

### Standard Pagination Response
```typescript
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Standard Error Response
```typescript
interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, string[]>;
  timestamp: string;
  path: string;
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

---

## 1. Authentication & Authorization

### Login (Email + Password)
- **Path**: `/api/auth/login`
- **Method**: `POST`
- **Description**: Authenticate using email and password, returns JWT access and refresh tokens

#### Request
- **Headers**: None (public endpoint)
- **Body**:
```typescript
{
  email: string;        // Valid email format
  password: string;     // Min 12 chars
}
```

#### Response
- **Success (200)**:
```typescript
{
  accessToken: string;       // JWT, expires in 15min
  refreshToken: string;      // JWT, expires in 7 days
  expiresIn: number;         // Seconds until access token expires (900)
  user: {
    id: string;              // UUID
    email: string;
    name: string;
    role: "platform_admin" | "tenant_admin" | "tenant_member";
    tenantId?: string;       // Null for platform admins
  };
}
```

- **Error (401)**:
```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid credentials",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "path": "/api/auth/login"
}
```

- **Error (422)**:
```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Validation failed",
  "details": {
    "email": ["Invalid email format"],
    "password": ["Password must be at least 12 characters"]
  },
  "timestamp": "2026-02-05T10:30:00.000Z",
  "path": "/api/auth/login"
}
```

---

### OAuth Login
- **Path**: `/api/auth/login/oauth`
- **Method**: `POST`
- **Description**: Authenticate using OAuth provider (Google/GitHub)

#### Request
- **Body**:
```typescript
{
  provider: "google" | "github";
  code: string;             // OAuth authorization code
  redirectUri: string;      // Must match registered OAuth redirect
}
```

#### Response
- **Success (200)**: Same as email/password login

- **Error (400)**:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid OAuth code or provider mismatch",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "path": "/api/auth/login/oauth"
}
```

---

### Refresh Token
- **Path**: `/api/auth/refresh`
- **Method**: `POST`
- **Description**: Obtain a new access token using refresh token

#### Request
- **Body**:
```typescript
{
  refreshToken: string;
}
```

#### Response
- **Success (200)**:
```typescript
{
  accessToken: string;
  expiresIn: number;
}
```

- **Error (401)**:
```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid or expired refresh token",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "path": "/api/auth/refresh"
}
```

---

### Logout
- **Path**: `/api/auth/logout`
- **Method**: `POST`
- **Description**: Invalidate refresh token and revoke access

#### Request
- **Headers**: `Authorization: Bearer <access_token>`
- **Body**:
```typescript
{
  refreshToken: string;
}
```

#### Response
- **Success (204)**: No content

---

### MFA Verification
- **Path**: `/api/auth/mfa/verify`
- **Method**: `POST`
- **Description**: Verify TOTP MFA code (required for platform admins)

#### Request
- **Body**:
```typescript
{
  email: string;
  totpCode: string;    // 6-digit TOTP code
}
```

#### Response
- **Success (200)**:
```typescript
{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    role: "platform_admin";
    mfaEnabled: true;
  };
}
```

- **Error (401)**:
```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid MFA code",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "path": "/api/auth/mfa/verify"
}
```

---

### Get Current User
- **Path**: `/api/auth/me`
- **Method**: `GET`
- **Description**: Get authenticated user profile

#### Request
- **Headers**: `Authorization: Bearer <access_token>`

#### Response
- **Success (200)**:
```typescript
{
  id: string;
  email: string;
  name: string;
  role: "platform_admin" | "tenant_admin" | "tenant_member";
  tenantId?: string;
  permissions: string[];
  createdAt: string;      // ISO 8601
}
```

---

## 2. Platform Admin: Dashboard

### Get Dashboard Stats
- **Path**: `/api/admin/dashboard/stats`
- **Method**: `GET`
- **Description**: Aggregate statistics for platform admin overview

#### Request
- **Headers**:
  - `Authorization: Bearer <access_token>` (role: platform_admin)

#### Response
- **Success (200)**:
```typescript
{
  tenants: {
    total: number;
    active: number;
    suspended: number;
    provisioning: number;
  };
  agents: {
    total: number;
    activeToday: number;
  };
  health: {
    healthy: number;        // Green containers
    degraded: number;       // Yellow containers
    down: number;           // Red containers
  };
  platform: {
    uptime: number;         // Seconds
    version: string;
  };
}
```

- **Error (403)**:
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Requires platform_admin role",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "path": "/api/admin/dashboard/stats"
}
```

---

### Get Active Alerts
- **Path**: `/api/admin/dashboard/alerts`
- **Method**: `GET`
- **Description**: List active platform alerts

#### Request
- **Headers**: `Authorization: Bearer <access_token>` (role: platform_admin)
- **Query Params**:
  - `severity` (optional): `info` | `warning` | `critical`
  - `limit` (optional): number, default 10

#### Response
- **Success (200)**:
```typescript
{
  alerts: Array<{
    id: string;
    severity: "info" | "warning" | "critical";
    title: string;
    message: string;
    tenantId?: string;
    tenantName?: string;
    createdAt: string;       // ISO 8601
    resolved: boolean;
  }>;
}
```

---

## 3. Platform Admin: Tenants

### List Tenants
- **Path**: `/api/admin/tenants`
- **Method**: `GET`
- **Description**: Paginated list of all tenants with filtering

#### Request
- **Headers**: `Authorization: Bearer <access_token>` (role: platform_admin)
- **Query Params**:
  - `page` (optional): number, default 1
  - `limit` (optional): number, default 20
  - `status` (optional): `active` | `suspended` | `provisioning` | `failed`
  - `plan` (optional): `starter` | `growth` | `enterprise`
  - `health` (optional): `healthy` | `degraded` | `down`
  - `search` (optional): string, searches company name and admin email
  - `include` (optional): `health` | `agents` | `all`
  - `sort` (optional): `company_name:asc` | `company_name:desc` | `created_at:asc` | `created_at:desc` | `agent_count:asc` | `agent_count:desc`

#### Response
- **Success (200)**:
```typescript
{
  data: Array<{
    id: string;                 // UUID
    companyName: string;
    adminEmail: string;
    status: "active" | "suspended" | "provisioning" | "failed";
    plan: "starter" | "growth" | "enterprise";
    agentCount: number;
    health?: {
      status: "healthy" | "degraded" | "down";
      cpu: number;              // Percentage
      memory: number;           // Percentage
      disk: number;             // Percentage
    };
    createdAt: string;          // ISO 8601
  }>;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

---

### Create Tenant
- **Path**: `/api/admin/tenants`
- **Method**: `POST`
- **Description**: Provision new tenant with isolated OpenClaw container (async operation)

#### Request
- **Headers**: `Authorization: Bearer <access_token>` (role: platform_admin)
- **Body**:
```typescript
{
  companyName: string;          // Unique, 3-50 chars
  adminEmail: string;           // Valid email, unique
  industry?: string;
  companySize?: "1-10" | "11-50" | "51-200" | "201-500" | "500+";
  deploymentRegion?: "us-east-1" | "us-west-2" | "eu-west-1" | "eu-central-1" | "ap-southeast-1" | "ap-northeast-1";
  notes?: string;               // Max 500 chars
  plan: "starter" | "growth" | "enterprise";
  billingCycle?: "monthly" | "annual";  // Default: "monthly"
  modelDefaults?: {
    tier: "haiku" | "sonnet" | "opus";
    thinkingMode: "off" | "low" | "high";
  };
  resourceLimits?: {
    cpuCores: number;           // Default based on plan
    memoryMb: number;           // Default based on plan
    diskGb: number;             // Default based on plan
    maxAgents: number;          // Default based on plan
    maxSkills: number;          // Default based on plan
  };
}
```

#### Response
- **Success (201)**:
```typescript
{
  id: string;
  companyName: string;
  adminEmail: string;
  status: "provisioning";
  plan: string;
  inviteLink: string;           // URL for tenant admin to accept
  createdAt: string;
}
```

- **Error (409)**:
```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Company name already exists",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "path": "/api/admin/tenants"
}
```

**Notes:**
- Provisioning is async. Poll `/api/admin/tenants/:id` (with `provisioning` field) for progress updates every 2s
- Status transitions: `provisioning` → `active` | `failed`
- Provisioning steps: `creating_namespace` → `spinning_container` → `configuring` → `installing_skills` → `health_check` → `completed`
- Max 3 retry attempts on failure. Creates Alert for platform admin on final failure
- Sends invite email to adminEmail automatically

---

### Get Tenant Detail
- **Path**: `/api/admin/tenants/:id`
- **Method**: `GET`
- **Description**: Detailed tenant information including container health

#### Request
- **Headers**: `Authorization: Bearer <access_token>` (role: platform_admin)
- **Path Params**: `id` - tenant UUID

#### Response
- **Success (200)**:
```typescript
{
  id: string;
  companyName: string;
  adminEmail: string;
  status: "active" | "suspended" | "provisioning" | "failed";
  plan: "starter" | "growth" | "enterprise";
  billingCycle: "monthly" | "annual";
  companySize?: string;
  deploymentRegion?: string;
  agentCount: number;
  containerHealth: {
    status: "healthy" | "degraded" | "down";
    cpu: number;
    memory: number;
    disk: number;
    uptime: number;           // Seconds
    lastHealthCheck: string;  // ISO 8601
  };
  provisioning?: {              // Present when status is "provisioning" or "failed"
    step: "creating_namespace" | "spinning_container" | "configuring" | "installing_skills" | "health_check" | "completed" | "failed";
    progress: number;           // 0-100
    message: string;            // Human-readable step description
    attemptNumber: number;      // Current attempt (1-3)
    startedAt: string;          // ISO 8601
    failedReason?: string;      // Only when step is "failed"
  };
  resourceLimits: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
    maxAgents: number;
    maxSkills: number;
  };
  config: {
    modelDefaults: {
      tier: string;
      thinkingMode: string;
    };
    containerEndpoint: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

- **Error (404)**:
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Tenant not found",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "path": "/api/admin/tenants/123e4567-e89b-12d3-a456-426614174000"
}
```

---

### Update Tenant Config
- **Path**: `/api/admin/tenants/:id`
- **Method**: `PATCH`
- **Description**: Update tenant configuration (plan, limits, model defaults)

#### Request
- **Headers**: `Authorization: Bearer <access_token>` (role: platform_admin)
- **Path Params**: `id` - tenant UUID
- **Body**:
```typescript
{
  plan?: "starter" | "growth" | "enterprise";
  resourceLimits?: {
    cpuCores?: number;
    memoryMb?: number;
    diskGb?: number;
    maxAgents?: number;
  };
  modelDefaults?: {
    tier?: "haiku" | "sonnet" | "opus";
    thinkingMode?: "off" | "low" | "high";
  };
}
```

#### Response
- **Success (200)**:
```typescript
{
  id: string;
  companyName: string;
  plan: string;
  resourceLimits: { /* updated values */ };
  modelDefaults: { /* updated values */ };
  updatedAt: string;
}
```

**Notes:**
- Changes propagate to container within 60 seconds
- May trigger container restart depending on changed fields
- Config history versioned for rollback

---

### Delete Tenant
- **Path**: `/api/admin/tenants/:id`
- **Method**: `DELETE`
- **Description**: Decommission tenant (soft delete with 7-day grace period)

#### Request
- **Headers**: `Authorization: Bearer <access_token>` (role: platform_admin)
- **Path Params**: `id` - tenant UUID

#### Response
- **Success (200)**:
```typescript
{
  id: string;
  status: "pending_deletion";
  gracePeriodEnds: string;    // ISO 8601, 7 days from now
  message: "Tenant scheduled for deletion. Permanent deletion on {date}";
}
```

**Notes:**
- Soft delete: tenant marked inactive but data preserved for 7 days
- Can reactivate during grace period
- After 7 days, permanent deletion triggered automatically

---

### Restart Tenant Container
- **Path**: `/api/admin/tenants/:id/actions/restart`
- **Method**: `POST`
- **Description**: Restart tenant's OpenClaw container

#### Request
- **Headers**: `Authorization: Bearer <access_token>` (role: platform_admin)
- **Path Params**: `id` - tenant UUID

#### Response
- **Success (202)**:
```typescript
{
  message: "Container restart initiated";
  tenantId: string;
  estimatedDowntime: number;  // Seconds, typically 30-60s
}
```

**Notes:**
- Async operation
- Agents will be unavailable during restart
- Health check confirms successful restart

---

### Get Tenant Container Health
- **Path**: `/api/admin/tenants/:id/health`
- **Method**: `GET`
- **Description**: Detailed container health metrics (current + 24h history)

#### Request
- **Headers**: `Authorization: Bearer <access_token>` (role: platform_admin)
- **Path Params**: `id` - tenant UUID

#### Response
- **Success (200)**:
```typescript
{
  current: {
    status: "healthy" | "degraded" | "down";
    cpu: number;
    memory: number;
    disk: number;
    uptime: number;
    timestamp: string;
  };
  history24h: Array<{
    timestamp: string;
    cpu: number;
    memory: number;
    disk: number;
    status: string;
  }>;
}
```

**Notes:**
- Cached for 30 seconds
- History data points every 5 minutes

---

### Get Tenant Agents
- **Path**: `/api/admin/tenants/:id/agents`
- **Method**: `GET`
- **Description**: List all agents within a tenant

#### Request
- **Headers**: `Authorization: Bearer <access_token>` (role: platform_admin)
- **Path Params**: `id` - tenant UUID

#### Response
- **Success (200)**:
```typescript
{
  data: Array<{
    id: string;
    name: string;
    role: "pm" | "engineering" | "operations" | "custom";
    status: "active" | "idle" | "error";
    modelTier: "haiku" | "sonnet" | "opus";
    lastActive: string;       // ISO 8601
    createdAt: string;
  }>;
}
```

---

## 4. Platform Admin: Skills

### Get Skill Review Queue
- **Path**: `/api/admin/skills/review`
- **Method**: `GET`
- **Description**: List skills pending review

#### Request
- **Headers**: `Authorization: Bearer <access_token>` (role: platform_admin)
- **Query Params**:
  - `status` (optional): `pending` | `approved` | `rejected`
  - `sort` (optional): `submitted_at:asc` | `submitted_at:desc` | `name:asc` | `name:desc`

#### Response
- **Success (200)**:
```typescript
{
  data: Array<{
    id: string;
    name: string;
    version: string;
    category: string;
    submittedBy: string;      // Email
    submittedAt: string;      // ISO 8601
    status: "pending" | "in_review" | "approved" | "rejected";
  }>;
}
```

---

### Get Skill Review Detail
- **Path**: `/api/admin/skills/review/:id`
- **Method**: `GET`
- **Description**: Detailed skill submission for review

#### Request
- **Headers**: `Authorization: Bearer <access_token>` (role: platform_admin)
- **Path Params**: `id` - skill submission UUID

#### Response
- **Success (200)**:
```typescript
{
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  compatibleRoles: string[];
  submittedBy: string;
  submittedAt: string;
  code: {
    repositoryUrl: string;
    mainFile: string;
    sourceCode: string;       // Full source for review
  };
  manifest: {
    permissions: {
      network: string[];      // Allowed domains
      files: string[];        // File path patterns
      env: string[];          // Required env variables
    };
  };
  metadata: {
    documentation: string;
    changelog: string;
  };
  status: "pending" | "in_review" | "approved" | "rejected";
  reviewNotes?: string;
}
```

---

### Approve Skill
- **Path**: `/api/admin/skills/review/:id/approve`
- **Method**: `POST`
- **Description**: Approve and publish skill to marketplace

#### Request
- **Headers**: `Authorization: Bearer <access_token>` (role: platform_admin)
- **Path Params**: `id` - skill submission UUID
- **Body**:
```typescript
{
  versionNumber: string;      // e.g., "1.0.0"
  notes?: string;
}
```

#### Response
- **Success (200)**:
```typescript
{
  id: string;
  name: string;
  version: string;
  status: "approved";
  publishedAt: string;
  marketplaceUrl: string;
}
```

**Notes:**
- Skill becomes immediately available in tenant marketplace
- Submitter receives approval notification email

---

### Reject Skill
- **Path**: `/api/admin/skills/review/:id/reject`
- **Method**: `POST`
- **Description**: Reject skill submission with feedback

#### Request
- **Headers**: `Authorization: Bearer <access_token>` (role: platform_admin)
- **Path Params**: `id` - skill submission UUID
- **Body**:
```typescript
{
  reason: string;             // Required feedback
  details?: string;
}
```

#### Response
- **Success (200)**:
```typescript
{
  id: string;
  status: "rejected";
  rejectionReason: string;
  rejectedAt: string;
}
```

**Notes:**
- Submitter receives rejection notification with feedback
- Skill can be revised and resubmitted

---

### List Published Skills
- **Path**: `/api/admin/skills`
- **Method**: `GET`
- **Description**: All published skills (admin view)

#### Request
- **Headers**: `Authorization: Bearer <access_token>` (role: platform_admin)
- **Query Params**:
  - `category` (optional): filter by category
  - `page` (optional): number, default 1
  - `limit` (optional): number, default 20

#### Response
- **Success (200)**:
```typescript
{
  data: Array<{
    id: string;
    name: string;
    version: string;
    category: string;
    installCount: number;
    rating: number;           // 0-5
    publishedAt: string;
  }>;
  meta: PaginationMeta;
}
```

---

## 5. Tenant: Dashboard

### Get Dashboard Stats
- **Path**: `/api/dashboard/stats`
- **Method**: `GET`
- **Description**: Tenant dashboard aggregate statistics

#### Request
- **Headers**:
  - `Authorization: Bearer <access_token>` (role: tenant_admin | tenant_member)
  - `X-Tenant-Id: <tenant_uuid>` (auto-injected from JWT)

#### Response
- **Success (200)**:
```typescript
{
  agents: {
    total: number;
    active: number;           // Active today
    idle: number;             // No activity 48+ hours
  };
  activity: {
    messagesToday: number;
    toolInvocationsToday: number;
  };
  cost: {
    estimatedDaily: number;   // USD
    estimatedMonthly: number;
  };
}
```

---

## 6. Tenant: Agents

### List Agents
- **Path**: `/api/dashboard/agents`
- **Method**: `GET`
- **Description**: List all agents for current tenant

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Query Params**:
  - `status` (optional): `active` | `idle` | `error`
  - `role` (optional): `pm` | `engineering` | `operations` | `custom`
  - `sort` (optional): `name:asc` | `name:desc` | `last_active:asc` | `last_active:desc` | `created_at:asc` | `created_at:desc`

#### Response
- **Success (200)**:
```typescript
{
  data: Array<{
    id: string;
    name: string;
    description?: string;
    role: "pm" | "engineering" | "operations" | "custom";
    status: "active" | "idle" | "error";
    modelTier: "haiku" | "sonnet" | "opus";
    thinkingMode: "off" | "low" | "high";
    channel?: {
      type: "telegram" | "slack";
      connected: boolean;
    };
    lastActive: string;
    createdAt: string;
  }>;
}
```

**Notes:**
- Refreshed every 30 seconds via WebSocket
- Rate limit: 60 requests/minute

---

### Create Agent
- **Path**: `/api/dashboard/agents`
- **Method**: `POST`
- **Description**: Create new agent (5-step wizard data)

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Body**:
```typescript
{
  // Step 1: Basic Info
  name: string;               // 3-50 chars
  role: "pm" | "engineering" | "operations" | "custom";
  description?: string;
  assistedUserId?: string;    // User being assisted by this agent
  assistedUserRole?: string;  // Role of the assisted user

  // Step 2: Model Configuration
  modelTier: "haiku" | "sonnet" | "opus";
  thinkingMode: "off" | "low" | "high";

  // Step 3: Tool Policy
  toolPolicy: {
    allow: string[];          // Tool category IDs
    deny?: string[];
  };

  // Step 4: Channel Binding (optional)
  channel?: {
    type: "telegram" | "slack";
    token?: string;           // For Telegram
    chatId?: string;          // For Telegram
    workspaceId?: string;     // For Slack
    channelId?: string;       // For Slack
  };
}
```

#### Response
- **Success (201)**:
```typescript
{
  id: string;
  name: string;
  role: string;
  status: "provisioning";
  modelTier: string;
  thinkingMode: string;
  createdAt: string;
}
```

- **Error (400)**:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Agent limit reached for current plan",
  "details": {
    "currentCount": 3,
    "planLimit": 3,
    "planName": "starter"
  },
  "timestamp": "2026-02-05T10:30:00.000Z",
  "path": "/api/dashboard/agents"
}
```

**Notes:**
- Agent creation is async (propagates to OpenClaw within 60s)
- Plan limits enforced at creation time
- Default tool policies auto-populated based on role
- The assistedUserId and assistedUserRole fields support role-based agent creation where agents are assigned to assist specific team members

---

### Get Agent Detail
- **Path**: `/api/dashboard/agents/:id`
- **Method**: `GET`
- **Description**: Detailed agent information

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Path Params**: `id` - agent UUID

#### Response
- **Success (200)**:
```typescript
{
  id: string;
  name: string;
  description?: string;
  role: "pm" | "engineering" | "operations" | "custom";
  status: "active" | "idle" | "error" | "paused";
  modelTier: "haiku" | "sonnet" | "opus";
  thinkingMode: "off" | "low" | "high";
  toolPolicy: {
    allow: string[];
    deny: string[];
  };
  channel?: {
    type: string;
    connected: boolean;
    lastMessageAt?: string;
  };
  metrics: {
    messagesLast24h: number;
    toolInvocationsLast24h: number;
    avgResponseTime: number;  // Milliseconds
  };
  skills: Array<{
    id: string;
    name: string;
    version: string;
  }>;
  lastActive: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### Update Agent
- **Path**: `/api/dashboard/agents/:id`
- **Method**: `PATCH`
- **Description**: Update agent configuration

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Path Params**: `id` - agent UUID
- **Body**:
```typescript
{
  name?: string;
  description?: string;
  modelTier?: "haiku" | "sonnet" | "opus";
  thinkingMode?: "off" | "low" | "high";
  toolPolicy?: {
    allow?: string[];
    deny?: string[];
  };
}
```

#### Response
- **Success (200)**:
```typescript
{
  id: string;
  name: string;
  modelTier: string;
  thinkingMode: string;
  updatedAt: string;
}
```

---

### Delete Agent
- **Path**: `/api/dashboard/agents/:id`
- **Method**: `DELETE`
- **Description**: Remove agent

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Path Params**: `id` - agent UUID

#### Response
- **Success (204)**: No content

---

### Restart Agent
- **Path**: `/api/dashboard/agents/:id/actions/restart`
- **Method**: `POST`
- **Description**: Restart agent process

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Path Params**: `id` - agent UUID

#### Response
- **Success (202)**:
```typescript
{
  message: "Agent restart initiated";
  agentId: string;
}
```

---

### Pause Agent
- **Path**: `/api/dashboard/agents/:id/actions/pause`
- **Method**: `POST`
- **Description**: Pause agent (stop processing messages)

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Path Params**: `id` - agent UUID

#### Response
- **Success (200)**:
```typescript
{
  id: string;
  status: "paused";
  pausedAt: string;
}
```

---

### Resume Agent
- **Path**: `/api/dashboard/agents/:id/actions/resume`
- **Method**: `POST`
- **Description**: Resume paused agent

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Path Params**: `id` - agent UUID

#### Response
- **Success (200)**:
```typescript
{
  id: string;
  status: "active";
  resumedAt: string;
}
```

---

### Get Agent Activity Feed
- **Path**: `/api/dashboard/agents/:id/activity`
- **Method**: `GET`
- **Description**: Paginated activity log for specific agent

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Path Params**: `id` - agent UUID
- **Query Params**:
  - `page` (optional): number, default 1
  - `limit` (optional): number, default 20, max 100
  - `type` (optional): `message` | `tool_invocation` | `error`

#### Response
- **Success (200)**:
```typescript
{
  data: Array<{
    id: string;
    type: "message" | "tool_invocation" | "error";
    timestamp: string;
    summary: string;
    details?: {
      toolName?: string;
      messagePreview?: string;
      errorMessage?: string;
    };
  }>;
  meta: PaginationMeta;
}
```

---

### Get Agent Logs
- **Path**: `/api/dashboard/agents/:id/logs`
- **Method**: `GET`
- **Description**: Agent logs with filtering

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Path Params**: `id` - agent UUID
- **Query Params**:
  - `page` (optional): number
  - `limit` (optional): number, max 100
  - `level` (optional): `debug` | `info` | `warn` | `error`
  - `since` (optional): ISO 8601 timestamp

#### Response
- **Success (200)**:
```typescript
{
  data: Array<{
    timestamp: string;
    level: "debug" | "info" | "warn" | "error";
    message: string;
    context?: Record<string, any>;
  }>;
  meta: PaginationMeta;
}
```

---

## 7. Tenant: Skills

### Browse Skill Marketplace
- **Path**: `/api/dashboard/skills`
- **Method**: `GET`
- **Description**: Browse available skills with filtering

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Query Params**:
  - `category` (optional): `productivity` | `analytics` | `engineering` | `communication`
  - `role` (optional): `pm` | `engineering` | `operations`
  - `search` (optional): string, searches name and description
  - `page` (optional): number
  - `limit` (optional): number
  - `sort` (optional): `name:asc` | `name:desc` | `rating:desc` | `install_count:desc` | `created_at:desc`

#### Response
- **Success (200)**:
```typescript
{
  data: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    compatibleRoles: string[];
    version: string;
    rating: number;           // 0-5
    installCount: number;
    permissions: {
      network: string[];
      files: string[];
      env: string[];
    };
    installed: boolean;       // Is this skill installed by tenant?
  }>;
  meta: PaginationMeta;
}
```

---

### Get Skill Detail
- **Path**: `/api/dashboard/skills/:id`
- **Method**: `GET`
- **Description**: Detailed skill information

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Path Params**: `id` - skill UUID

#### Response
- **Success (200)**:
```typescript
{
  id: string;
  name: string;
  description: string;
  category: string;
  compatibleRoles: string[];
  version: string;
  rating: number;
  installCount: number;
  permissions: {
    network: string[];
    files: string[];
    env: string[];
  };
  documentation: string;      // Markdown
  changelog: string;
  reviews: Array<{
    rating: number;
    comment: string;
    author: string;
    createdAt: string;
  }>;
  installed: boolean;
  installedAgents?: string[]; // Agent IDs if installed
}
```

---

### Install Skill
- **Path**: `/api/dashboard/skills/:id/install`
- **Method**: `POST`
- **Description**: Install skill for tenant (to specific agent)

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Path Params**: `id` - skill UUID
- **Body**:
```typescript
{
  agentId: string;            // Target agent UUID
  credentials?: {             // If skill requires credentials
    [key: string]: string;
  };
}
```

#### Response
- **Success (201)**:
```typescript
{
  skillId: string;
  agentId: string;
  status: "installing";
  message: "Skill will be available within 60 seconds";
}
```

- **Error (409)**:
```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Skill requires permissions denied by agent tool policy",
  "details": {
    "requiredPermissions": ["network:api.example.com"],
    "deniedBy": "agent_tool_policy"
  },
  "timestamp": "2026-02-05T10:30:00.000Z",
  "path": "/api/dashboard/skills/skill-id/install"
}
```

---

### Uninstall Skill
- **Path**: `/api/dashboard/skills/:id/uninstall`
- **Method**: `DELETE`
- **Description**: Remove skill from agent

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Path Params**: `id` - skill UUID
- **Query Params**:
  - `agentId`: agent UUID

#### Response
- **Success (204)**: No content

---

### Get Installed Skills
- **Path**: `/api/dashboard/skills/installed`
- **Method**: `GET`
- **Description**: List all skills installed for tenant

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Query Params**:
  - `agentId` (optional): filter by specific agent

#### Response
- **Success (200)**:
```typescript
{
  data: Array<{
    id: string;
    name: string;
    version: string;
    category: string;
    agentId: string;
    agentName: string;
    installedAt: string;
    usageCount: number;       // Times invoked
  }>;
}
```

---

## 8. Tenant: Team Management

### List Team Members
- **Path**: `/api/dashboard/team`
- **Method**: `GET`
- **Description**: List all team members

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`

#### Response
- **Success (200)**:
```typescript
{
  data: Array<{
    id: string;
    name: string;
    email: string;
    role: "tenant_admin" | "tenant_member";
    status: "active" | "pending";
    lastActive?: string;
    createdAt: string;
  }>;
}
```

---

### Send Team Invite
- **Path**: `/api/dashboard/team/invite`
- **Method**: `POST`
- **Description**: Invite new team member

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Body**:
```typescript
{
  email: string;
  role: "tenant_admin" | "tenant_member";
  message?: string;           // Optional personal message
}
```

#### Response
- **Success (201)**:
```typescript
{
  id: string;
  email: string;
  role: string;
  status: "pending";
  inviteLink: string;
  expiresAt: string;          // 7 days from now
}
```

- **Error (409)**:
```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "User already a member of this tenant",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "path": "/api/dashboard/team/invite"
}
```

---

### Remove Team Member
- **Path**: `/api/dashboard/team/:id`
- **Method**: `DELETE`
- **Description**: Remove team member

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Path Params**: `id` - member UUID

#### Response
- **Success (204)**: No content

- **Error (400)**:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Cannot remove last admin",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "path": "/api/dashboard/team/member-id"
}
```

---

### Update Member Role
- **Path**: `/api/dashboard/team/:id`
- **Method**: `PATCH`
- **Description**: Change member role

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id` (role: tenant_admin)
- **Path Params**: `id` - member UUID
- **Body**:
```typescript
{
  role: "tenant_admin" | "tenant_member";
}
```

#### Response
- **Success (200)**:
```typescript
{
  id: string;
  email: string;
  role: string;
  updatedAt: string;
}
```

---

### Accept Invite
- **Path**: `/api/dashboard/team/invite/:token/accept`
- **Method**: `POST`
- **Description**: Accept team invitation

#### Request
- **Headers**: None (public endpoint)
- **Path Params**: `token` - invite token from email link
- **Body**:
```typescript
{
  name: string;
  password?: string;          // Required if not using OAuth
  oauthProvider?: "google" | "github";
  oauthCode?: string;
}
```

#### Response
- **Success (200)**:
```typescript
{
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
  };
}
```

- **Error (410)**:
```json
{
  "statusCode": 410,
  "error": "Gone",
  "message": "Invite link has expired",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "path": "/api/dashboard/team/invite/token-123/accept"
}
```

---

## 9. Tenant: Audit

### Get Audit Logs
- **Path**: `/api/dashboard/audit`
- **Method**: `GET`
- **Description**: Tenant audit log with filtering

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Query Params**:
  - `page` (optional): number, default 1
  - `limit` (optional): number, default 50, max 100
  - `agentId` (optional): filter by specific agent
  - `actionType` (optional): `tool_invocation` | `message` | `config_change` | `login`
  - `dateFrom` (optional): ISO 8601
  - `dateTo` (optional): ISO 8601
  - `severity` (optional): `info` | `warning` | `error`

#### Response
- **Success (200)**:
```typescript
{
  data: Array<{
    id: string;
    timestamp: string;
    actor: {
      type: "agent" | "user";
      id: string;
      name: string;
    };
    action: string;             // e.g., "tool_invocation", "agent_created"
    targetType: "agent" | "skill" | "tenant" | "user";
    targetId: string;
    details: {
      toolName?: string;
      parameters?: Record<string, any>;  // Sensitive fields masked
      result?: string;
    };
    severity: "info" | "warning" | "error";
    ipAddress?: string;
  }>;
  meta: PaginationMeta;
}
```

**Notes:**
- Hot storage: 90 days in MySQL
- Cold storage: 1 year in S3/object storage
- Sensitive data (passwords, tokens) masked
- Rate limit: 100 requests/minute

---

### Export Audit Log
- **Path**: `/api/dashboard/audit/export`
- **Method**: `GET`
- **Description**: Export audit log (CSV/JSON)

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`
- **Query Params**:
  - `format`: `csv` | `json`
  - `dateFrom` (optional): ISO 8601
  - `dateTo` (optional): ISO 8601
  - Same filters as list endpoint

#### Response
- **Success (200)**:
  - Content-Type: `text/csv` or `application/json`
  - Content-Disposition: `attachment; filename="audit-log-{date}.{format}"`
  - Body: File content

**Notes:**
- Export limited to 10,000 records per request
- Async job for large exports (returns job ID, poll for completion)

---

## 10. Tenant: Settings

### Get Tenant Settings
- **Path**: `/api/dashboard/settings`
- **Method**: `GET`
- **Description**: Tenant configuration and profile

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`

#### Response
- **Success (200)**:
```typescript
{
  company: {
    name: string;
    industry: string;
    size: string;
  };
  plan: {
    name: "starter" | "growth" | "enterprise";
    maxAgents: number;
    features: string[];
  };
  config: {
    modelDefaults: {
      tier: string;
      thinkingMode: string;
    };
  };
}
```

---

### Update Tenant Settings
- **Path**: `/api/dashboard/settings`
- **Method**: `PATCH`
- **Description**: Update tenant profile

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id` (role: tenant_admin)
- **Body**:
```typescript
{
  company?: {
    name?: string;
    industry?: string;
    size?: string;
  };
}
```

#### Response
- **Success (200)**:
```typescript
{
  company: {
    name: string;
    industry: string;
    size: string;
  };
  updatedAt: string;
}
```

---

### Get Usage Stats
- **Path**: `/api/dashboard/settings/usage`
- **Method**: `GET`
- **Description**: Current usage vs plan limits

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`

#### Response
- **Success (200)**:
```typescript
{
  plan: {
    name: string;
    limits: {
      maxAgents: number;
      tokensPerMonth: number;
    };
  };
  current: {
    agents: number;
    tokensThisMonth: number;
    tokensToday: number;
  };
  percentages: {
    agents: number;           // % of limit used
    tokens: number;
  };
  billing: {
    nextBillingDate: string;
    estimatedCost: number;
  };
}
```

---

### List API Keys
- **Path**: `/api/dashboard/settings/api-keys`
- **Method**: `GET`
- **Description**: List all API keys for current tenant

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id`

#### Response
- **Success (200)**:
```typescript
{
  data: Array<{
    id: string;
    name: string;
    keyPrefix: string;        // e.g., "aegis_sk_abc..."
    createdAt: string;
    lastUsedAt?: string;
    expiresAt?: string;
  }>;
}
```

---

### Generate API Key
- **Path**: `/api/dashboard/settings/api-keys`
- **Method**: `POST`
- **Description**: Generate new API key for tenant

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id` (role: tenant_admin)
- **Body**:
```typescript
{
  name: string;               // Descriptive name
  expiresInDays?: number;     // Optional expiry (default: never)
}
```

#### Response
- **Success (201)**:
```typescript
{
  id: string;
  name: string;
  apiKey: string;             // Full key - ONLY shown once
  keyPrefix: string;
  createdAt: string;
  expiresAt?: string;
  warning: "This API key will only be shown once. Store it securely.";
}
```

---

### Revoke API Key
- **Path**: `/api/dashboard/settings/api-keys/:id`
- **Method**: `DELETE`
- **Description**: Revoke API key

#### Request
- **Headers**: `Authorization: Bearer <access_token>`, `X-Tenant-Id` (role: tenant_admin)
- **Path Params**: `id` - API key UUID

#### Response
- **Success (204)**: No content

---

## 11. WebSocket Events

### Connection
- **URL**: `wss://api.aegis.ai/ws`
- **Auth**: Pass `?token=<access_token>` as query param

### Subscribe to Events
After connection, send:
```typescript
{
  type: "subscribe";
  channels: string[];         // e.g., ["agent.status", "container.health"]
}
```

---

### Event: Agent Status Changed
```typescript
{
  event: "agent.status.changed";
  data: {
    agentId: string;
    tenantId: string;
    status: "active" | "idle" | "error" | "paused";
    timestamp: string;
  };
}
```

---

### Event: Container Health Changed
```typescript
{
  event: "container.health.changed";
  data: {
    tenantId: string;
    health: {
      status: "healthy" | "degraded" | "down";
      cpu: number;
      memory: number;
      disk: number;
    };
    timestamp: string;
  };
}
```

---

### Event: Provisioning Progress
```typescript
{
  event: "provisioning.progress";
  data: {
    tenantId: string;
    step: "creating_namespace" | "spinning_container" | "configuring" | "installing_skills" | "health_check";
    progress: number;         // 0-100
    message: string;
    timestamp: string;
  };
}
```

---

## 12. Global Types

### PaginationMeta
```typescript
interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

### Agent
```typescript
interface Agent {
  id: string;
  name: string;
  description?: string;
  role: "pm" | "engineering" | "operations" | "custom";
  status: "active" | "idle" | "error" | "paused";
  modelTier: "haiku" | "sonnet" | "opus";
  thinkingMode: "off" | "low" | "high";
  toolPolicy: {
    allow: string[];
    deny: string[];
  };
  channel?: {
    type: "telegram" | "slack";
    connected: boolean;
  };
  lastActive: string;
  createdAt: string;
  updatedAt: string;
}
```

### Tenant
```typescript
interface Tenant {
  id: string;
  companyName: string;
  adminEmail: string;
  status: "active" | "suspended" | "provisioning" | "failed";
  plan: "starter" | "growth" | "enterprise";
  agentCount: number;
  createdAt: string;
  updatedAt: string;
}
```

### Skill
```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  category: "productivity" | "analytics" | "engineering" | "communication";
  version: string;
  compatibleRoles: string[];
  permissions: {
    network: string[];
    files: string[];
    env: string[];
  };
  rating: number;
  installCount: number;
}
```

---

## Rate Limits

| Endpoint Pattern | Limit | Window |
|------------------|-------|--------|
| `POST /api/auth/login` | 5 requests | 15 minutes |
| `POST /api/auth/*` | 10 requests | 15 minutes |
| `GET /api/dashboard/*` | 60 requests | 1 minute |
| `GET /api/admin/*` | 60 requests | 1 minute |
| `POST /api/dashboard/*` | 20 requests | 1 minute |
| `POST /api/admin/*` | 20 requests | 1 minute |
| WebSocket connections | 5 connections | per user |

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1675612800
```

**Rate Limit Exceeded (429)**:
```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 30 seconds",
  "retryAfter": 30,
  "timestamp": "2026-02-05T10:30:00.000Z",
  "path": "/api/dashboard/agents"
}
```

---

## Caching Strategy

| Endpoint | Cache Duration | Invalidation |
|----------|---------------|--------------|
| `GET /api/admin/dashboard/stats` | 30 seconds | On tenant status change |
| `GET /api/admin/tenants/:id/health` | 30 seconds | On health check update |
| `GET /api/dashboard/agents` | 30 seconds | On agent create/update/delete |
| `GET /api/dashboard/skills` | 5 minutes | On skill publish |
| `GET /api/dashboard/team` | 1 minute | On member add/remove |

**Cache Headers:**
```http
Cache-Control: private, max-age=30
ETag: "abc123"
Last-Modified: Wed, 05 Feb 2026 10:30:00 GMT
```

---

## CORS Configuration

**Allowed Origins:**
- `https://admin.aegis.ai` (Platform Admin Dashboard)
- `https://app.aegis.ai` (Tenant Dashboard)
- `http://localhost:3000` (Development only)

**Allowed Methods:**
- `GET, POST, PATCH, DELETE, OPTIONS`

**Allowed Headers:**
- `Authorization, Content-Type, X-Tenant-Id`

**Credentials:**
- `Access-Control-Allow-Credentials: true`

---

## Security Notes

### JWT Token Structure
```typescript
{
  sub: string;              // User ID
  email: string;
  role: string;
  tenantId?: string;        // Null for platform admins
  permissions: string[];
  iat: number;              // Issued at
  exp: number;              // Expires at
}
```

### Token Expiry
- **Access Token**: 15 minutes
- **Refresh Token**: 7 days
- **Invite Token**: 7 days

### Password Requirements
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### MFA (Platform Admins Only)
- TOTP (Time-based One-Time Password)
- 6-digit code
- 30-second window
- Backup codes provided on setup

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | 2026-02-06 | Added assistedUser fields to agent creation, API key management endpoints, and sorting parameters to list endpoints |
| 1.0.0 | 2026-02-05 | Initial API contract for MVP |

---

**END OF API CONTRACT**

This document is the SINGLE SOURCE OF TRUTH for the Aegis Platform API. Backend engineers MUST implement all endpoints exactly as specified. Frontend engineers MUST use these endpoints without deviation.

**Zero Tolerance Policy**: Any deviation from this contract requires explicit approval and version update.
