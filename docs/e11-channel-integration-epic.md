# E11: Channel Integration Framework -- Epic Specification

**Version:** 1.0.0
**Date:** 2026-02-08
**Status:** Ready for Sprint Planning
**Priority:** P0 (post-E8)
**Architecture:** [channel-integration-architecture.md](channel-integration-architecture.md)
**Depends On:** E8 (Audit Trail), existing Agent CRUD, existing Tenant Settings

---

## Epic Summary

Enable Aegis platform agents to communicate with users through enterprise messaging platforms (Slack, Microsoft Teams, Discord). Agents can respond to user messages (reactive) and proactively initiate communication (cron jobs, heartbeats, monitoring alerts). All messages flow through an Aegis Channel Proxy that handles tenant routing, audit logging, and platform-specific delivery, while each tenant's isolated OpenClaw container handles agent execution.

**User Story:** As a Tenant Admin, I want to connect my team's Slack/Teams/Discord workspace to Aegis so that my agents can communicate with team members in the tools they already use -- both when users ask questions and when agents proactively send updates.

---

## Feature Breakdown

### E11-F1: Channel Data Model & Aegis Channel Plugin

**Priority:** P0 (foundation for all other features)
**Effort:** 1.5 weeks
**Dependencies:** E8-F1 (Audit Service)

#### Description

Create the Prisma data model for channel connections and routing rules. Build the custom OpenClaw "aegis" channel plugin that bridges tenant containers to the Aegis proxy bidirectionally.

#### Scope

**Backend (NestJS):**
- Prisma schema: `ChannelConnection`, `ChannelRouting` models with enums
- `ChannelModule` with `ChannelConnectionService` and `ChannelRoutingService`
- CRUD endpoints for connections and routing rules (tenant-scoped)
- Seed data for development/testing

**OpenClaw Plugin (`@aegis/openclaw-channel-plugin`):**
- TypeScript npm package following OpenClaw plugin manifest structure
- Inbound: webhook listener at `/hooks/aegis` (OpenClaw native)
- Outbound: HTTP POST to Aegis proxy's `/api/v1/channel/outbound`
- Metadata: agent ID, session key, target type, message type (reply/proactive)
- Auth: Bearer token per tenant container
- Error handling: retry with exponential backoff, dead-letter queue

**Data Model:**

```prisma
model ChannelConnection {
  id                    String            @id @default(uuid())
  tenantId              String
  platform              ChannelPlatform
  platformWorkspaceId   String
  platformWorkspaceName String
  credentials           Json              // Encrypted OAuth tokens
  status                ConnectionStatus
  connectedBy           String
  connectedAt           DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  tenant                Tenant            @relation(fields: [tenantId], references: [id])
  routings              ChannelRouting[]

  @@unique([platform, platformWorkspaceId])
  @@index([tenantId])
}

model ChannelRouting {
  id                String            @id @default(uuid())
  tenantId          String
  connectionId      String
  routeType         RouteType         // USER, CHANNEL, DEFAULT
  platformEntityId  String            // Platform user/channel ID, or "*"
  agentId           String
  priority          Int               @default(0)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  connection        ChannelConnection @relation(fields: [connectionId], references: [id])
  agent             Agent             @relation(fields: [agentId], references: [id])
  tenant            Tenant            @relation(fields: [tenantId], references: [id])

  @@unique([connectionId, routeType, platformEntityId])
  @@index([tenantId])
  @@index([connectionId, routeType])
}

enum ChannelPlatform { SLACK  TEAMS  DISCORD  GOOGLE_CHAT }
enum ConnectionStatus { ACTIVE  DISCONNECTED  REVOKED  PENDING }
enum RouteType { USER  CHANNEL  DEFAULT }
```

#### API Endpoints

```
# Channel Connections (Tenant Admin)
GET    /api/v1/tenant/channels                     # List connections
POST   /api/v1/tenant/channels                     # Create connection (after OAuth)
GET    /api/v1/tenant/channels/:id                  # Get connection details
PATCH  /api/v1/tenant/channels/:id                  # Update connection
DELETE /api/v1/tenant/channels/:id                  # Disconnect (revoke)

# Channel Routing (Tenant Admin)
GET    /api/v1/tenant/channels/:id/routing          # List routing rules
POST   /api/v1/tenant/channels/:id/routing          # Create routing rule
PATCH  /api/v1/tenant/channels/:id/routing/:ruleId  # Update rule
DELETE /api/v1/tenant/channels/:id/routing/:ruleId  # Delete rule

# Proxy Endpoints (Internal)
POST   /api/v1/channel/outbound                     # Receive from OpenClaw containers
```

#### Acceptance Criteria

- [ ] Prisma migration runs cleanly
- [ ] CRUD operations for connections and routing rules work with tenant scoping
- [ ] Aegis channel plugin sends outbound messages to proxy endpoint
- [ ] Proxy endpoint receives and validates outbound messages
- [ ] All mutations write audit log entries (E8 dependency)
- [ ] Unit tests for services and routing resolution logic

---

### E11-F2: Channel Proxy Core & Routing Engine

**Priority:** P0
**Effort:** 2 weeks
**Dependencies:** E11-F1

#### Description

Build the core Channel Proxy as a NestJS module: tenant resolution, agent routing engine, session management, and the outbound dispatcher. This is the central nervous system for all channel communication.

#### Scope

**Inbound Pipeline:**
1. Receive platform event (Slack/Teams/Discord webhook or socket event)
2. Extract: workspace ID, user ID, channel ID, message text, attachments
3. Tenant resolution: `platformWorkspaceId` → `tenantId` (DB lookup with cache)
4. Tenant validation: active status, plan allows this platform, rate limit check
5. Agent routing: resolve target agent using priority rules (slash cmd > channel > user > default)
6. Session key generation: `{platform}-{userId}-{channelId}`
7. Forward to tenant's OpenClaw container: `POST /hooks/aegis`
8. Audit log entry: `CHANNEL_MESSAGE_INBOUND`

**Outbound Pipeline:**
1. Receive from tenant's aegis channel plugin: `POST /api/v1/channel/outbound`
2. Validate tenant token and agent ownership
3. Resolve delivery target:
   - For replies: use the originating platform/channel/user from the session
   - For proactive: resolve `agentId` → assigned user → platform + user ID
4. Dispatch to correct platform API (Slack, Teams, Discord)
5. Audit log entry: `CHANNEL_MESSAGE_OUTBOUND` or `AGENT_PROACTIVE_MESSAGE`

**Routing Engine:**
- Priority-based resolution: slash command > channel mapping > user mapping > tenant default
- Caching: routing rules cached in Redis with TTL, invalidated on CRUD operations
- Fallback: if no routing match, return error to user ("No agent configured for this channel")

**Session Management:**
- Session keys stored in Redis: `channel-session:{tenantId}:{sessionKey}`
- Maps to OpenClaw session for continuity (proactive message → user reply = same session)
- TTL: 24h idle timeout, configurable per tenant

#### Acceptance Criteria

- [ ] Inbound pipeline correctly resolves tenant and agent from platform events
- [ ] Outbound pipeline correctly dispatches to the right platform
- [ ] Routing engine respects priority order
- [ ] Redis caching for routing rules with proper invalidation
- [ ] Rate limiting per tenant (configurable)
- [ ] Graceful handling of container unavailability (queue and retry)
- [ ] Audit log entries for all inbound and outbound messages
- [ ] Integration tests with mocked platform APIs

---

### E11-F3: Slack App Integration

**Priority:** P0
**Effort:** 2 weeks
**Dependencies:** E11-F2

#### Description

Build the Aegis Slack App: a multi-workspace distributable Slack application using Socket Mode and Events API. Handles OAuth2 installation flow, event subscriptions, slash commands, and message delivery.

#### Scope

**Slack App Configuration:**
- App Manifest with required scopes:
  - `chat:write` - Send messages
  - `channels:history`, `groups:history`, `im:history` - Read messages in channels/DMs
  - `channels:read`, `groups:read` - List channels
  - `users:read` - Resolve user info
  - `commands` - Slash commands
  - `app_mentions:read` - Respond to @mentions
- Socket Mode enabled (enterprise-friendly, no public URL needed)
- Event subscriptions: `message.channels`, `message.groups`, `message.im`, `app_mention`

**OAuth2 Installation Flow:**
1. Tenant admin clicks "Connect Slack" in Aegis settings
2. Redirect to Slack OAuth2 authorization URL
3. User authorizes in their Slack workspace
4. Callback receives `code`, exchanges for `access_token` + `bot_token`
5. Store tokens in `ChannelConnection.credentials` (encrypted)
6. Create default routing rule (tenant default agent)
7. Auto-discover workspace users and channels for routing configuration

**Slash Commands:**
- `/aegis ask <agent> <message>` - Direct message to specific agent (override routing)
- `/aegis status` - Show connected agents and routing config
- `/aegis help` - Show available commands

**Message Handling:**
- App mentions (`@Aegis ...`) in channels → route to channel-mapped or user-mapped agent
- DMs to the bot → route to user-mapped agent
- Thread replies → maintain same session/agent as parent message

**Outbound Delivery:**
- Send messages as the Aegis bot user
- Support: plain text, markdown (mrkdwn), code blocks
- Future: Slack Block Kit for rich formatting, buttons, modals

#### Acceptance Criteria

- [ ] OAuth2 "Add to Slack" flow creates connection and stores tokens
- [ ] App receives and processes messages from channels, DMs, and mentions
- [ ] Slash commands work: `/aegis ask`, `/aegis status`, `/aegis help`
- [ ] Thread continuity: replies in threads maintain session
- [ ] Outbound messages posted correctly (DMs and channels)
- [ ] Proactive messages from agent cron/heartbeat delivered as DMs
- [ ] Error handling: workspace disconnected, token revoked, rate limited
- [ ] Works across multiple workspaces simultaneously

---

### E11-F4: Microsoft Teams App Integration

**Priority:** P0
**Effort:** 2 weeks
**Dependencies:** E11-F2

#### Description

Build the Aegis Teams App using the M365 Agents SDK (successor to Bot Framework). Supports org-wide deployment via Teams Admin Center.

#### Scope

**Teams App Package:**
- App manifest (teams-app-manifest.json)
- Bot registration via Azure Bot Service
- Scopes: personal (1:1 chat), team (channel messages), groupchat

**Installation Flow:**
1. Tenant admin clicks "Connect Teams" in Aegis settings
2. Redirect to Microsoft identity platform consent flow
3. Admin grants org-wide permissions
4. Store tokens in `ChannelConnection.credentials`
5. Map Teams tenant ID → Aegis tenant ID

**Message Handling:**
- Personal chat (1:1 with bot) → route to user-mapped agent
- Channel messages (@mention) → route to channel-mapped agent
- Adaptive Cards for rich responses (future)

**Outbound Delivery:**
- Proactive messaging via stored conversation references
- Requires: service URL, conversation ID, tenant ID (stored per user on first interaction)

#### Acceptance Criteria

- [ ] Teams App installable via Admin Center
- [ ] Personal chat and channel mentions processed correctly
- [ ] Proactive messages delivered to users who have interacted with the bot
- [ ] Conversation reference storage for outbound capability
- [ ] Works across multiple Teams organizations

---

### E11-F5: Discord Bot Integration

**Priority:** P0
**Effort:** 1.5 weeks
**Dependencies:** E11-F2

#### Description

Build the Aegis Discord Bot: multi-guild capable with slash commands and message handling.

#### Scope

**Bot Configuration:**
- Discord Application with Bot user
- Required intents: `GUILDS`, `GUILD_MESSAGES`, `DIRECT_MESSAGES`, `MESSAGE_CONTENT`
- Slash commands registered globally via REST API

**Installation Flow:**
1. Tenant admin clicks "Connect Discord" in Aegis settings
2. OAuth2 authorization URL with `bot` + `applications.commands` scopes
3. Admin adds bot to their guild
4. Store guild ID mapping in `ChannelConnection`

**Message Handling:**
- Slash commands: `/aegis ask <agent> <message>`
- Bot mentions in channels → route to channel-mapped agent
- DMs to bot → route to user-mapped agent

**Outbound Delivery:**
- Channel messages via channel ID
- DMs via user ID (create DM channel, then send)

#### Acceptance Criteria

- [ ] Bot installable to multiple guilds via OAuth2
- [ ] Slash commands registered and functional
- [ ] Channel and DM messages routed to correct agent
- [ ] Proactive DMs from agent cron/heartbeat delivered
- [ ] Works across multiple guilds simultaneously

---

### E11-F6: Channel Admin UI

**Priority:** P1
**Effort:** 1.5 weeks
**Dependencies:** E11-F1, E11-F3 (Slack at minimum)

#### Description

Build the tenant dashboard UI for managing channel connections and agent routing. New "Channels" tab in tenant settings.

#### Scope

**Channel Connections Page:**
- List connected platforms with status indicators
- "Connect" buttons for each platform (triggers OAuth flow)
- "Disconnect" with confirmation dialog
- Connection health indicator (last message received, token valid)

**Routing Configuration:**
- Agent assignment table: map platform users → agents
- Channel mapping table: map platform channels → agents
- Default agent selector
- Auto-discovery: pull user/channel lists from platform APIs for dropdown selection
- Drag-and-drop priority reordering (future)

**Connection Status:**
- Real-time connection status (WebSocket from proxy)
- Message count (last 24h, last 7d)
- Last message timestamp per agent

#### Acceptance Criteria

- [ ] Connect/disconnect flow for all three platforms
- [ ] User → agent mapping CRUD with platform user picker
- [ ] Channel → agent mapping CRUD with platform channel picker
- [ ] Default agent selection
- [ ] Connection status indicators
- [ ] Responsive design (matches existing tenant dashboard)

---

### E11-F7: Proactive Agent Configuration UI

**Priority:** P1
**Effort:** 1 week
**Dependencies:** E11-F6

#### Description

Enable tenant admins to configure proactive agent behaviors (cron schedules, heartbeat intervals, monitoring prompts) through the Aegis UI. These settings are synced to the tenant's OpenClaw container configuration.

#### Scope

**Agent Detail Page Enhancement:**
- New "Proactive Behaviors" section in agent detail view
- Cron job configuration:
  - Schedule (cron expression with human-readable helper)
  - Prompt template
  - Target: specific user, specific channel, or agent's default
  - Enable/disable toggle
- Heartbeat configuration:
  - Interval (minutes)
  - Prompt template
  - Enable/disable toggle

**Config Sync:**
- When admin saves proactive config, Aegis API updates the agent record
- Container orchestrator syncs config to tenant's OpenClaw `openclaw.json`
- Gateway restart or hot-reload triggered

#### Acceptance Criteria

- [ ] Tenant admin can add/edit/remove cron jobs per agent
- [ ] Tenant admin can configure heartbeat interval and prompt per agent
- [ ] Config changes sync to tenant's OpenClaw container
- [ ] Cron/heartbeat messages flow through proxy and reach target users
- [ ] Enable/disable toggle works without deleting configuration

---

## Sprint Plan

### Sprint 6 (Post E8): Foundation

| Feature | Tasks | Effort |
|---------|-------|--------|
| **E11-F1** | Prisma schema, migration, Channel module, CRUD services, aegis plugin skeleton | 1.5 weeks |
| **E11-F2** (start) | Inbound pipeline, routing engine, Redis caching | 1 week |

**Sprint 6 Exit Criteria:**
- Data model deployed
- Routing engine resolves tenant + agent from test payloads
- Aegis channel plugin sends/receives messages in dev environment

### Sprint 7: Slack + Proxy Complete

| Feature | Tasks | Effort |
|---------|-------|--------|
| **E11-F2** (complete) | Outbound pipeline, session management, audit integration | 1 week |
| **E11-F3** | Slack App: OAuth flow, events, slash commands, outbound delivery | 2 weeks |

**Sprint 7 Exit Criteria:**
- End-to-end Slack flow working: user message → agent response → Slack reply
- Proactive messages from cron/heartbeat delivered to Slack DMs
- Audit logs for all channel messages

### Sprint 8: Teams + Discord + UI

| Feature | Tasks | Effort |
|---------|-------|--------|
| **E11-F4** | Teams App: manifest, consent flow, message handling, proactive | 2 weeks |
| **E11-F5** | Discord Bot: OAuth, slash commands, message handling | 1.5 weeks |
| **E11-F6** (start) | Channel settings UI: connections page, routing config | 1 week |

*Note: E11-F4 and E11-F5 can be developed in parallel by different engineers.*

**Sprint 8 Exit Criteria:**
- Teams and Discord working end-to-end
- Channel settings UI functional for Slack connections

### Sprint 9: UI Complete + Polish

| Feature | Tasks | Effort |
|---------|-------|--------|
| **E11-F6** (complete) | Routing UI for all platforms, status indicators | 0.5 weeks |
| **E11-F7** | Proactive config UI, config sync to containers | 1 week |
| Polish | Error handling, edge cases, documentation | 0.5 weeks |

**Sprint 9 Exit Criteria:**
- Tenant admin can fully self-serve: connect workspace, configure routing, set up proactive behaviors
- All three platforms working with proactive messaging

---

## Effort Summary

| Feature | Effort | Dependencies |
|---------|--------|-------------|
| E11-F1: Data Model & Aegis Plugin | 1.5 weeks | E8 |
| E11-F2: Channel Proxy Core | 2 weeks | E11-F1 |
| E11-F3: Slack App | 2 weeks | E11-F2 |
| E11-F4: Teams App | 2 weeks | E11-F2 |
| E11-F5: Discord Bot | 1.5 weeks | E11-F2 |
| E11-F6: Channel Admin UI | 1.5 weeks | E11-F1, E11-F3 |
| E11-F7: Proactive Config UI | 1 week | E11-F6 |
| **Total** | **~11.5 weeks** | |
| **Parallelized** | **~7 weeks (Sprint 6-9)** | F4+F5 parallel, F6+F7 after |

---

## Dependency Graph

```
E8 (Audit Trail) ←── MUST complete first
  │
  └──→ E11-F1 (Data Model + Aegis Plugin)
         │
         └──→ E11-F2 (Channel Proxy Core)
                │
                ├──→ E11-F3 (Slack App)
                │      │
                │      └──→ E11-F6 (Channel Admin UI) ──→ E11-F7 (Proactive Config UI)
                │
                ├──→ E11-F4 (Teams App)       ← parallel with F5
                │
                └──→ E11-F5 (Discord Bot)     ← parallel with F4
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Slack App review delays | Medium | Medium | Submit early; use Socket Mode (no public URL needed for review) |
| Teams consent flow complexity | Medium | Medium | Azure Bot Service simplifies; test with dev tenant first |
| OpenClaw webhook API limitations | Low | High | Aegis plugin abstracts; can extend webhook protocol if needed |
| Container orchestration for config sync (F7) | Medium | Medium | Start with manual restart; hot-reload as enhancement |
| Rate limiting by platforms | Low | Medium | Implement backoff; queue messages during throttling |
| OAuth token refresh/revocation | Medium | Low | Token refresh cron; connection status monitoring; alert on revocation |

---

## Testing Strategy

**Unit Tests:**
- Routing engine: all priority resolution paths
- Tenant resolver: cache hits, misses, invalid workspaces
- Session key generation and lookup

**Integration Tests:**
- End-to-end inbound: mock Slack event → proxy → mock OpenClaw container → response
- End-to-end outbound: mock OpenClaw proactive → proxy → mock Slack API
- Multi-tenant isolation: messages from workspace A never reach tenant B's container

**E2E Tests (extension of existing happy-path.e2e-spec.ts):**
- Channel connection CRUD
- Routing rule CRUD
- Simulated Slack message flow (with Slack API mocks)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Slack message round-trip latency | < 3 seconds | Proxy instrumentation |
| Proactive message delivery rate | > 99% | Audit log analysis |
| Tenant admin self-serve connection | < 5 minutes | UX testing |
| Cross-tenant message leakage | 0 incidents | Security testing |
| Channel uptime | > 99.5% | Connection status monitoring |

---

**Document Owner:** Architecture & Engineering Team
**Next Review:** Sprint 6 kickoff
