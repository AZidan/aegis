# Channel Integration Architecture: Discussion & Conclusions

**Version:** 1.0.0
**Date:** 2026-02-08
**Status:** Approved Architecture
**Participants:** Zidan (Founder), Claude (Architecture)
**Related:** [Security Whitepaper](security-whitepaper.md), [Multi-Agent Plan](multi-agent-plan.md), [Phase 2 Priority Analysis](phase-2-priority-analysis.md)

---

## 1. Context & Motivation

Channel integration was deferred during Sprint 1-4 (MVP phase). The platform currently has no way for agents to communicate with users through their daily communication tools. Users must interact with agents solely through the Aegis web dashboard.

**The goal:** Enable agents (Nadia, Ola, Tamer, etc.) to communicate with their assigned users through Slack, Microsoft Teams, Discord, and other enterprise communication platforms -- both reactively (user initiates) and proactively (agent initiates via cron/heartbeat).

**Why it matters:**
- Agents that live in the tools people already use (Slack, Teams) are 10x more useful than dashboard-only agents
- Proactive agent behavior (morning standups, metric alerts, PR reminders) is a critical differentiator
- Breadfast pilot feedback: "Can Nadia message me in Slack with my morning brief?"
- Enterprise prospects expect channel integration as table stakes

---

## 2. Enterprise Communication Landscape (Research)

### Tier 1 -- Must Have (Day 1)

| Platform | Market Position | Integration Method | Key Considerations |
|----------|----------------|-------------------|-------------------|
| **Slack** | Global enterprise, startups | Modern Slack Apps (Socket Mode / Events API) | Legacy bots deprecated Mar 2025; classic apps EOL Nov 2026. Must use new app format. Multi-workspace install supported natively. |
| **Microsoft Teams** | Enterprise, Microsoft ecosystem | M365 Agents SDK (successor to Bot Framework) | Bot Framework SDK EOL Dec 2025. Teams AI v2 for Teams-only. M365 Agents SDK for multi-channel. |
| **Discord** | Dev teams, gaming, communities | Discord API v10 + Slash Commands | Guild-level install via OAuth2. Application commands (slash) are first-class. |

### Tier 2 -- High Value (Future)

| Platform | Market Position | Integration Method |
|----------|----------------|-------------------|
| **Google Chat** | Google Workspace orgs | Google Chat API + Pub/Sub, Workspace Marketplace distribution |
| **Mattermost** | Security-conscious, self-hosted | Apps Framework (legacy bots deprecated), REST API |
| **Webex** | Cisco enterprise ecosystem | Webex Bot Framework via developer.webex.com |

### Tier 3 -- Regional/Niche (Future)

| Platform | Market Position | Integration Method |
|----------|----------------|-------------------|
| **Lark/Feishu** | MENA, Asia-Pacific (ByteDance) | Open Platform API; relevant for Breadfast regional ops |
| **Rocket.Chat** | Self-hosted, government | Apps-Engine (bots deprecated), REST API |
| **Zoho Cliq** | Zoho ecosystem orgs | Webhook + bot integrations |

**Sources:**
- [Slack Developer Docs](https://docs.slack.dev/)
- [Slack Legacy Deprecation](https://docs.slack.dev/changelog/2024-09-legacy-custom-bots-classic-apps-deprecation/)
- [MS Teams SDK Evolution 2025](https://www.voitanos.io/blog/microsoft-teams-sdk-evolution-2025/)
- [Discord Slash Commands Guide](https://discordjs.guide/creating-your-bot/slash-commands.html)
- [Google Chat API](https://developers.google.com/workspace/chat)

---

## 3. OpenClaw Channel Capabilities

OpenClaw already has a mature channel adapter architecture with support for Slack, Discord, MS Teams, Google Chat, Signal, Telegram, WhatsApp, iMessage, and Mattermost.

### Architecture Components

- **Gateway**: WebSocket control plane handling sessions, presence, config, cron, webhooks
- **Channels**: Inbound/outbound adapters connecting messaging platforms to agent runtime
- **Skills**: Modular capability extensions (AgentSkills standard format)
- **Plugin SDK**: TypeScript types and utilities for custom channel/skill development

### Configuration Pattern

Channels are configured declaratively via `channels.<channelId>` sections in `openclaw.json`, controlling authentication, allowlists, group policies, and session routing.

### Webhook API

OpenClaw exposes a webhook endpoint at `/hooks/<name>` for external triggers. Payloads include `message` (required), `sessionKey` (optional for multi-turn), and `channel` (optional delivery target).

### Custom Channel Plugin Development

OpenClaw's plugin architecture supports custom channels as npm packages. Recent examples include an XMPP channel plugin (PR #9741) with full bidirectional messaging support.

**Sources:**
- [OpenClaw Channels Documentation](https://docs.openclaw.ai/channels)
- [OpenClaw Webhook Documentation](https://docs.openclaw.ai/automation/webhook)
- [OpenClaw Plugin Architecture (DeepWiki)](https://deepwiki.com/openclaw/openclaw/10-extensions-and-plugins)
- [OpenClaw Channel Routing (DeepWiki)](https://deepwiki.com/openclaw/openclaw/8-channels)

---

## 4. Architectural Options Evaluated

### Option A: OpenClaw Instance Per Tenant (Direct Channel Connection)

Each tenant's OpenClaw container connects directly to Slack/Teams/Discord using native channel adapters.

```
Tenant A Container: OpenClaw → channels.slack → Slack Workspace A
Tenant B Container: OpenClaw → channels.slack → Slack Workspace B
```

**Pros:**
- OpenClaw handles all channel protocol complexity natively
- Complete tenant isolation (container-per-company)
- Each tenant's skills, agents, sessions are fully isolated

**Cons:**
- Each tenant needs their own Slack/Teams/Discord App (terrible admin UX)
- OR: shared app tokens injected into each container (credential management nightmare)
- No centralized audit trail -- bypasses Aegis logging
- No platform-level controls (rate limiting, plan enforcement, usage metering)
- No unified "Aegis" brand experience across channels

**Verdict:** Rejected -- operational complexity and lack of centralized control make this impractical for a SaaS platform.

### Option B: Aegis Gateway Only (No OpenClaw Channels)

Build all channel adapters as NestJS modules in Aegis. Use OpenClaw only as a skill/LLM execution engine via REST.

```
Slack → Aegis NestJS → REST call → OpenClaw (skill engine only)
```

**Pros:**
- Maximum control over channel handling
- Single codebase for all channel logic
- Tight integration with Aegis auth/tenant/audit systems

**Cons:**
- Loses OpenClaw's native proactive features (heartbeat, cron)
- Must rebuild session management, message threading, media handling
- Agent-initiated messages have no path out of OpenClaw
- Massive maintenance burden

**Verdict:** Rejected -- loses critical proactive agent behavior, which is a core value proposition.

### Option C: Shared OpenClaw Pool (Multi-Tenant)

Multiple tenants share a pool of stateless OpenClaw workers. Aegis routes messages to any available worker.

```
Aegis Proxy → Load Balancer → OpenClaw Worker Pool (shared)
```

**Pros:**
- Resource-efficient (N workers, not N containers)
- Simple deployment

**Cons:**
- **VIOLATES CORE SECURITY ARCHITECTURE** -- project_context.md UVP #1 is container-per-company isolation
- Giskard January 2026 research: "Direct messages shared a single context, secrets loaded for one user became visible to others"
- Session context bleed, environment variable exposure, memory-level data leakage
- Cannot pass enterprise security reviews

**Verdict:** REJECTED -- violates the platform's #1 security guarantee and introduces proven cross-tenant data leakage risks.

**Security Sources:**
- [Giskard: OpenClaw Security Issues](https://www.giskard.ai/knowledge/openclaw-security-vulnerabilities-include-data-leakage-and-prompt-injection-risks)
- [The Register: OpenClaw Ecosystem Security](https://www.theregister.com/2026/02/02/openclaw_security_issues/)
- [Hunt.io: CVE-2026-25253 Exposure](https://hunt.io/blog/cve-2026-25253-openclaw-ai-agent-exposure)
- [Composio: Secure OpenClaw Setup](https://composio.dev/blog/secure-openclaw-moltbot-clawdbot-setup)

### Option D: Aegis Channel Proxy + Per-Tenant OpenClaw + Aegis Channel Plugin (APPROVED)

A hybrid architecture where:
1. One Slack App / Teams App / Discord Bot (shared, multi-workspace capable)
2. Aegis Channel Proxy (NestJS) handles all platform communication and tenant routing
3. Per-tenant OpenClaw containers (isolated) handle agent execution
4. A custom "aegis" OpenClaw channel plugin bridges the proxy and containers bidirectionally

**Verdict:** APPROVED -- preserves security isolation, enables proactive agent behavior, centralizes audit/control.

---

## 5. Approved Architecture: Detailed Design

### 5.1 High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    CHANNEL LAYER (Shared)                       │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│  │ Aegis    │  │ Aegis    │  │ Aegis    │   One app per       │
│  │ Slack App│  │ Teams App│  │ Discord  │   platform,          │
│  │          │  │          │  │ Bot      │   multi-workspace    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                     │
│       └──────────────┼──────────────┘                          │
│                      ▼                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          Aegis Channel Proxy (NestJS)                     │  │
│  │                                                           │  │
│  │  POST /inbound   ← receives from Slack/Teams/Discord     │  │
│  │  POST /outbound  ← receives from tenant OpenClaw          │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │  │
│  │  │   Tenant    │  │   Routing    │  │   Platform     │  │  │
│  │  │   Resolver  │  │   Engine     │  │   Dispatcher   │  │  │
│  │  │             │  │              │  │                │  │  │
│  │  │ workspace   │  │ user→agent   │  │ Slack API      │  │  │
│  │  │ → tenant    │  │ channel→agent│  │ Teams API      │  │  │
│  │  │             │  │ agent→user   │  │ Discord API    │  │  │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │  │
│  └───────────┬──────────────────────────────┬───────────────┘  │
│              │ inbound                      │ outbound         │
├──────────────┼──────────────────────────────┼──────────────────┤
│              ▼                              ▲                   │
│              TENANT LAYER (Isolated)                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Breadfast Container                                      │  │
│  │                                                           │  │
│  │  OpenClaw Gateway                                         │  │
│  │  channels.aegis (← webhook in, → callback out)            │  │
│  │                                                           │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │  │
│  │  │ Nadia   │  │  Ola    │  │  Tamer  │                  │  │
│  │  │ cron 9am│  │ beat 30m│  │ beat 15m│                  │  │
│  │  │ beat 30m│  │         │  │ cron 10a│                  │  │
│  │  └─────────┘  └─────────┘  └─────────┘                  │  │
│  │                                                           │  │
│  │  tmpfs secrets (SOPS+age encrypted)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  Tenant B         │  │  Tenant C         │                    │
│  │  Container        │  │  Container        │                    │
│  └──────────────────┘  └──────────────────┘                    │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 The Aegis Channel Plugin (OpenClaw Side)

The critical bridge piece. A single custom OpenClaw channel plugin installed in every tenant container. It does NOT handle Slack/Teams/Discord directly -- it bridges to the Aegis proxy.

**Responsibilities:**
- **Inbound**: Receive messages from Aegis proxy via webhook at `/hooks/aegis`
- **Outbound**: POST agent responses and proactive messages to Aegis proxy's `/api/v1/channel/outbound`
- **Metadata**: Carry agent ID, session key, target type (user/channel), message type (reply/proactive)

**OpenClaw container config:**

```jsonc
{
  "channels": {
    "aegis": {
      "endpoint": "http://aegis-proxy:3000/api/v1/channel/outbound",
      "authToken": "${AEGIS_CHANNEL_TOKEN}",
      "tenantId": "${TENANT_ID}"
    }
  }
}
```

No `channels.slack`, `channels.teams`, or `channels.discord` configured inside tenant containers. All platform-specific communication is handled by the Aegis proxy.

### 5.3 Multi-Agent Routing Within a Tenant

Within each tenant's OpenClaw container, the multi-agent-plan.md 3-layer architecture applies:

```
Layer 3: SOUL.md per agent (Nadia persona, Ola persona, Tamer persona)
Layer 2: Role Skills (breadfast-pm, breadfast-em)
Layer 1: Shared Toolbox (Jira, Amplitude, Tableau, Calendar)
```

**Agent configuration (inside container):**

```jsonc
{
  "agents": {
    "list": [
      {
        "id": "nadia",
        "workspace": "~/.openclaw/workspace-nadia",
        "identity": { "name": "Nadia", "emoji": "📊" },
        "heartbeat": { "every": "30m", "prompt": "Check Amplitude for anomalies..." },
        "cron": [
          { "schedule": "0 9 * * 0-4", "prompt": "Morning standup brief for Nesma..." },
          { "schedule": "0 16 * * 4", "prompt": "Sprint velocity summary..." }
        ]
      },
      {
        "id": "ola",
        "workspace": "~/.openclaw/workspace-ola",
        "identity": { "name": "Ola", "emoji": "📈" },
        "heartbeat": { "every": "30m", "prompt": "Check product metrics..." }
      },
      {
        "id": "tamer",
        "workspace": "~/.openclaw/workspace-tamer",
        "identity": { "name": "Tamer", "emoji": "⚙️" },
        "heartbeat": { "every": "15m", "prompt": "Check Sentry for critical errors..." },
        "cron": [
          { "schedule": "0 10 * * 0-4", "prompt": "Check GitHub for stale PRs..." }
        ]
      }
    ]
  },
  "bindings": [
    { "agentId": "nadia", "match": { "channel": "aegis", "metadata.agent": "nadia" } },
    { "agentId": "ola",   "match": { "channel": "aegis", "metadata.agent": "ola" } },
    { "agentId": "tamer", "match": { "channel": "aegis", "metadata.agent": "tamer" } }
  ]
}
```

### 5.4 Routing Strategy (Proxy Side)

When a message arrives at the Aegis Channel Proxy, it resolves the target agent using three strategies in priority order:

```
1. Slash command override     →  /aegis ask nadia "..."  (highest priority)
2. Channel → agent mapping    →  #sprint-planning → Nadia
3. User → agent assignment    →  Nesma (U001) → Nadia
4. Tenant default agent       →  fallback (lowest priority)
```

For **outbound** (agent-initiated) messages, the proxy resolves the reverse:

```
Agent "nadia" sends proactive message
→ Lookup: nadia's primary user = Nesma
→ Lookup: Nesma's platform = Slack, user ID = U001
→ Send Slack DM to U001
```

### 5.5 Message Flow: User-Initiated (Inbound)

```
Nesma types in Slack #sprint-planning:
"@Aegis what's our velocity trend?"

  → Aegis Slack App receives event
  → Channel Proxy:
    1. Resolve workspace W_BREADFAST → tenant: breadfast
    2. Resolve channel #sprint-planning → agent: nadia
    3. Build session key: slack-U_NESMA-C_SP
    4. Write audit log
    5. POST http://breadfast-oc:18789/hooks/aegis
       { message, sessionKey, agent: "nadia", context: { platform, user, channel } }
  → Nadia processes (reads Jira, analyzes)
  → Response sent via aegis channel plugin
  → POST http://aegis-proxy:3000/api/v1/channel/outbound
    { tenantId, agentId: "nadia", message: "Sprint velocity...", type: "reply" }
  → Proxy posts reply to Slack #sprint-planning
```

### 5.6 Message Flow: Agent-Initiated (Outbound / Proactive)

```
9:00am cron fires in Breadfast container
→ Nadia agent triggered: "Send morning standup brief"
→ Nadia calls Jira skill, Amplitude skill
→ Synthesizes standup summary
→ Sends via aegis channel plugin:
  POST http://aegis-proxy:3000/api/v1/channel/outbound
  {
    tenantId: "breadfast-uuid",
    agentId: "nadia",
    type: "proactive",
    sessionKey: "cron-nadia-standup-2026-02-08",
    message: "Good morning Nesma! Here's your standup...",
    target: { type: "user", agentId: "nadia" }
  }
→ Proxy resolves: nadia → Nesma → Slack U001
→ Sends Slack DM to Nesma
→ Writes audit log: AGENT_PROACTIVE_MESSAGE

Nesma replies in the DM: "What's blocking BFAST-342?"
→ Inbound flow kicks in, same session key → conversation continues
```

---

## 6. Data Model

### New Prisma Models

```prisma
model ChannelConnection {
  id                    String            @id @default(uuid())
  tenantId              String
  platform              ChannelPlatform
  platformWorkspaceId   String            // Slack workspace ID, Teams tenant ID, Discord guild ID
  platformWorkspaceName String
  credentials           Json              // Encrypted: bot tokens, OAuth tokens
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
  routeType         RouteType
  platformEntityId  String            // Slack user ID, channel ID, or "*" for default
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

enum ChannelPlatform {
  SLACK
  TEAMS
  DISCORD
  GOOGLE_CHAT
}

enum ConnectionStatus {
  ACTIVE
  DISCONNECTED
  REVOKED
  PENDING
}

enum RouteType {
  USER
  CHANNEL
  DEFAULT
}
```

---

## 7. Security Analysis

### Why Shared OpenClaw Is Unacceptable

| Risk | Evidence | Impact |
|------|----------|--------|
| **Session context leakage** | Giskard Jan 2026: "secrets loaded for one user became visible to others" | Tenant A's data visible to Tenant B |
| **Environment variable exposure** | Group chats could read env vars, API keys, configs | API key theft across tenants |
| **Memory-level bleed** | Single process shares memory space | Agent memories/context cross-contaminate |
| **Prompt injection amplification** | Malicious content in one tenant could affect shared agent | Cross-tenant attack vector |
| **CVE-2026-25253** | 17,500+ exposed instances; token hijacking via Control UI | Full RCE if shared gateway compromised |

### How Our Architecture Mitigates

| Control | Implementation |
|---------|---------------|
| **Container-per-company** | Each tenant gets isolated OpenClaw container (UVP #1) |
| **No direct channel access** | OpenClaw never connects to Slack/Teams directly; aegis plugin only |
| **Centralized credential management** | Channel OAuth tokens stored in Aegis DB (encrypted), never in containers |
| **SOPS+age secrets layer** | Container secrets encrypted at rest, decrypted to tmpfs at runtime |
| **Audit trail** | Every inbound/outbound message logged by proxy before forwarding |
| **Proxy-level controls** | Rate limiting, plan enforcement, usage metering at proxy layer |
| **No Control UI exposed** | Containers run headless, no gateway UI for end users |

---

## 8. Tenant Admin UX: Channel Configuration

### Settings > Channels Tab

```
┌─────────────────────────────────────────────────────┐
│  Channels                                            │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ Slack -- Breadfast Workspace                 │    │
│  │    Connected by Ahmed, Jan 15, 2026          │    │
│  │    [Manage Routing]  [Disconnect]            │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ Microsoft Teams -- Not connected             │    │
│  │    [Connect Teams]                           │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ Discord -- Not connected                     │    │
│  │    [Connect Discord]                         │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  Agent Routing (Slack):                              │
│  ┌──────────────────────────────────────────────┐   │
│  │  People                                       │   │
│  │  Nesma Al-Saeed  (U001)  →  Nadia (PM)       │   │
│  │  Asmaa Karim     (U002)  →  Ola (PM)         │   │
│  │  Hany Mostafa    (U003)  →  Tamer (EM)       │   │
│  │  + Add person                                 │   │
│  │                                               │   │
│  │  Channels                                     │   │
│  │  #sprint-planning  →  Nadia (PM)              │   │
│  │  #engineering      →  Tamer (EM)              │   │
│  │  #product-metrics  →  Ola (PM)                │   │
│  │  + Add channel                                │   │
│  │                                               │   │
│  │  Default (unmatched) → Nadia (PM)             │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 9. Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Architecture** | Aegis Channel Proxy + Per-Tenant OpenClaw + Aegis Channel Plugin | Preserves container-per-company isolation; enables proactive agent behavior; centralizes audit and control |
| **Day 1 channels** | Slack + Teams + Discord | Top 3 enterprise platforms; covers Breadfast and prospect pipeline |
| **Plugin strategy** | Custom "aegis" OpenClaw channel plugin for bridging; OpenClaw skills for tool integrations | Clean separation: channels in Aegis NestJS, tools in OpenClaw skills |
| **Timing** | After E8 (Sprint 6-7) | Need audit logging before channel messages flow |
| **Shared vs isolated OpenClaw** | Isolated (container-per-company) | Shared violates UVP #1; proven cross-tenant leakage risks (Giskard, CVE-2026-25253) |
| **Channel apps** | One per platform, multi-workspace | Single "Aegis" Slack App installed across all customer workspaces |
| **Proactive messaging** | Via aegis channel plugin outbound callback | Enables cron, heartbeat, monitoring alerts through the proxy |
| **Agent routing** | User mapping + channel mapping + slash command override | Flexible routing with clear priority resolution |

---

## 10. Open Items for Future Discussion

1. **OAuth flow UX**: How does the tenant admin connect their Slack workspace? (Likely OAuth2 "Add to Slack" button in tenant settings)
2. **Rate limiting per tenant**: How many messages/minute per tenant? Per agent? (Depends on plan tier)
3. **Media handling**: How do file attachments, images, rich cards flow through the proxy?
4. **Threading**: Should agent replies maintain Slack threads? (Likely yes for channel messages, no for DMs)
5. **Presence/typing indicators**: Should the proxy emit typing indicators while OpenClaw processes? (Nice to have)
6. **Multi-platform routing**: Can Nesma be reached on Slack AND Teams simultaneously? (Future: yes, with platform preference)
7. **Fallback behavior**: What happens if OpenClaw container is down when a message arrives? (Queue in Redis, retry)

---

**Document Owner:** Architecture Team
**Next Review:** After E11-F1 implementation
