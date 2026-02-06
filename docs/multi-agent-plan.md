# Multi-Agent OpenClaw Plan for Breadfast

**Author:** Aegis (for Zidan)  
**Date:** 2025-07-13  
**Status:** Draft — pilot-ready

---

## 3-Layer Architecture (AI Transformation 2027)

The agent system follows a 3-layer architecture aligned with the AI Transformation 2027 deck:

```
┌─────────────────────────────────────────────┐
│  Layer 3: Individual Agent Configs          │
│  SOUL.md per person (Nadia for Nesma, etc.) │
│  Personality, daily routine, preferences    │
├─────────────────────────────────────────────┤
│  Layer 2: Role Skills                       │
│  breadfast-pm   — PM-specific skills        │
│  breadfast-em   — EM-specific skills        │
│  (reusable across all people in that role)  │
├─────────────────────────────────────────────┤
│  Layer 1: Shared Toolbox                    │
│  breadfast-toolbox — Tableau, Amplitude,    │
│  Calendar, Email, Slack, Jira, GitHub       │
│  (shared across ALL agents)                 │
└─────────────────────────────────────────────┘
```

**Project structure:**
- `projects/breadfast-toolbox/` — Layer 1: shared composable tools
- `projects/breadfast-pm/` — Layer 2: PM role skills (discussion tracker, PRD writer, metrics)
- `projects/breadfast-pm/assets/{name}-soul.md` — Layer 3: individual agent configs

This separation means:
1. New tools benefit ALL agents immediately (Layer 1)
2. New PM skills benefit ALL PM agents (Layer 2)
3. Each person's agent is personalized without duplicating logic (Layer 3)

---

## TL;DR

Use a **single shared gateway** with multiple agents routed via `bindings`. Each colleague gets their own Telegram bot, workspace, and session isolation. Start the pilot with Sonnet on the colleague's agent. Total extra cost: ~$30–80/month depending on usage.

---

## 1. Architecture Options

### Option A: Shared Gateway (Recommended ✅)

One OpenClaw instance running multiple agents via `agents.list[]` + `bindings[]`.

```
┌─────────────────────────────────────┐
│         Single Gateway (VPS)        │
│                                     │
│  Agent: aegis (Zidan)    ──→ Bot A  │
│  Agent: colleague-agent  ──→ Bot B  │
│                                     │
│  Shared: API keys, infra, config    │
│  Isolated: workspace, sessions      │
└─────────────────────────────────────┘
```

**Pros:**
- One server to manage, one process to monitor
- Native multi-agent support built into OpenClaw (`agents.list`, `bindings`, per-agent tool policies)
- Shared API keys — one Anthropic/OpenAI account, easier billing
- Easy to add/remove agents (config change + restart)
- Agents can optionally communicate via `tools.agentToAgent`

**Cons:**
- Single point of failure (mitigated by rescue bot profile if needed)
- Admin (Zidan) has root access to all workspaces
- Resource contention at high concurrency (mitigated by `maxConcurrent`)

### Option B: Isolated Instances (Separate Servers)

Each person runs their own OpenClaw gateway.

**Pros:**
- Complete isolation (no shared state)
- Each person manages their own config
- No single point of failure

**Cons:**
- 2x infrastructure cost and management
- Each person needs their own API keys
- Harder to coordinate/manage centrally
- Requires technical setup per person (not realistic for non-engineers)

### Verdict

**Go with Option A.** OpenClaw is designed for multi-agent on a single gateway. The isolation is strong (separate workspaces, separate sessions, configurable tool policies). Option B only makes sense if you need regulatory-level separation.

---

## 2. Channel Setup

### Telegram: One Bot Per Person (Recommended ✅)

Each colleague gets their own Telegram bot via BotFather. This is the cleanest approach.

**Why separate bots:**
- Each person DMs "their" bot — no confusion
- Session isolation is automatic (different `accountId` → different `bindings` → different agent)
- Each bot can have its own name, avatar, and personality
- No shared conversation leakage

**Config example:**

```json5
{
  channels: {
    telegram: {
      accounts: {
        default: {
          name: "Aegis (Zidan)",
          botToken: "111111:AAA..."  // Zidan's existing bot
        },
        colleague: {
          name: "Atlas (Ahmed)",
          botToken: "222222:BBB..."  // New bot for colleague
        }
      }
    }
  },
  agents: {
    list: [
      {
        id: "aegis",
        default: true,
        workspace: "~/.openclaw/workspace",
        identity: { name: "Aegis", emoji: "🛡️" }
      },
      {
        id: "atlas",
        workspace: "~/.openclaw/workspace-atlas",
        model: "anthropic/claude-sonnet-4-5",
        identity: { name: "Atlas", emoji: "🗺️" }
      }
    ]
  },
  bindings: [
    { agentId: "aegis", match: { channel: "telegram", accountId: "default" } },
    { agentId: "atlas", match: { channel: "telegram", accountId: "colleague" } }
  ]
}
```

### Shared Bot (Not Recommended)

A single bot where different Telegram users get routed to different agents via `bindings[].match.peer`. Technically possible but confusing — the colleague would DM the same bot as Zidan.

### Other Channels

| Channel | Effort | Notes |
|---------|--------|-------|
| **Telegram** | Low | Best for pilot. One BotFather command. |
| **Slack** | Medium | Good for Breadfast-wide rollout. Requires Slack app + socket mode tokens. |
| **Discord** | Medium | Good if team already uses Discord. Similar to Telegram setup. |
| **WhatsApp** | High | Requires phone number per account. Not ideal for work. |

**For the pilot: stick with Telegram.** If scaling to 5+ people at Breadfast, consider Slack (one workspace bot, route by user/channel).

---

## 3. Model Tiers & Cost Estimates

### Pricing (USD per 1M tokens, Anthropic API as of mid-2025)

| Model | Input | Output | Cache Read | Cache Write |
|-------|-------|--------|------------|-------------|
| **Haiku 3.5** | $0.80 | $4.00 | $0.08 | $1.00 |
| **Sonnet 4.5** | $3.00 | $15.00 | $0.30 | $3.75 |
| **Opus 4.5** | $15.00 | $75.00 | $1.50 | $18.75 |

### Usage Assumptions

- Average message: ~500 tokens input (user msg + context), ~800 tokens output
- System prompt + workspace context: ~5,000 tokens (cached after first message)
- Thinking tokens (when enabled): 2x–5x output tokens

### Monthly Cost Estimates (per agent, no thinking)

| Usage Level | Msgs/Day | Haiku 3.5 | Sonnet 4.5 | Opus 4.5 |
|-------------|----------|-----------|------------|----------|
| **Light** | ~50 | $3–5 | $10–18 | $50–90 |
| **Moderate** | ~150 | $8–15 | $30–50 | $150–250 |
| **Heavy** | ~300 | $15–30 | $60–100 | $300–500 |

### With Thinking Enabled (low level)

Thinking roughly doubles output costs. Add 50–100% to the output portion:

| Usage Level | Sonnet + thinking:low | Opus + thinking:low |
|-------------|----------------------|---------------------|
| **Light** | $15–28 | $75–140 |
| **Moderate** | $45–80 | $225–400 |
| **Heavy** | $90–160 | $450–800 |

### Recommended Tier for Pilot

**Sonnet 4.5 with thinking:low** — best quality-to-cost ratio.

- Smart enough for real work (coding, analysis, writing)
- ~$30–50/month at moderate usage
- Can downgrade to Haiku for specific agents that just do simple tasks

**Cost optimization tips:**
- Heartbeats burn tokens every 30min. Set colleague's heartbeat to `every: "0m"` (disabled) or `every: "2h"` to save ~$5–15/month
- Use `contextPruning: { mode: "adaptive" }` to trim old tool results
- Set `compaction.memoryFlush.enabled: true` to avoid losing context on long sessions
- Cache warmth: Anthropic caches last ~5min by default. Conversations with gaps > 5min re-cache the full prompt

---

## 4. Security & Privacy

### Session Isolation (Built-in)

Each agent gets:
- **Separate workspace** (`~/.openclaw/workspace-atlas/`) — files, memories, SOUL.md are isolated
- **Separate session store** (`~/.openclaw/agents/atlas/sessions/`) — conversation history is per-agent
- **Separate agentDir** (`~/.openclaw/agents/atlas/agent/`) — auth profiles, models.json

Conversations between Zidan and his agent **never** appear in the colleague's sessions and vice versa.

### What the Admin (Zidan) Can See

| Access | Can See? | Notes |
|--------|----------|-------|
| Colleague's workspace files | ✅ Yes | Admin has filesystem access on the server |
| Colleague's session history | ✅ Yes | JSONL files on disk |
| Colleague's messages in real-time | ❌ No | Unless you read the session files |
| Colleague's Telegram messages | ❌ No | Bot only receives msgs sent to it |

**Bottom line:** As the server admin, Zidan has theoretical access to everything on disk. This is the same as any self-hosted tool. Be transparent with colleagues about this.

### Tool Policy Isolation

Restrict what the colleague's agent can do:

```json5
{
  agents: {
    list: [
      {
        id: "atlas",
        workspace: "~/.openclaw/workspace-atlas",
        // Sandbox non-main sessions (optional, for safety)
        sandbox: { mode: "non-main", scope: "agent", workspaceAccess: "rw" },
        // Restrict tools
        tools: {
          deny: ["nodes", "cron", "gateway"]  // No device control, no cron, no gateway restart
        }
      }
    ]
  }
}
```

### Recommendations

1. **Set `session.dmScope: "per-account-channel-peer"`** — ensures DMs from different Telegram accounts never share sessions
2. **Run `openclaw security audit`** after setup — catches common misconfigurations
3. **Don't share API keys with the colleague** — they interact through Telegram only, never SSH
4. **Colleague should NOT have SSH access** to the server (unless explicitly needed)

---

## 5. Pilot Recommendation: Step-by-Step

### Prerequisites
- Existing OpenClaw gateway running (Zidan's setup)
- Colleague has Telegram installed
- ~15 minutes of setup time

### Step 1: Create a New Telegram Bot

1. Colleague (or Zidan) opens Telegram → `@BotFather`
2. `/newbot` → Name: "Atlas" (or whatever) → Username: `breadfast_atlas_bot`
3. Copy the bot token

### Step 2: Create the Colleague's Workspace

```bash
mkdir -p ~/.openclaw/workspace-atlas
```

Create a minimal `SOUL.md`:

```bash
cat > ~/.openclaw/workspace-atlas/SOUL.md << 'EOF'
# Atlas

You are Atlas, an AI assistant for [Colleague Name] at Breadfast.

## About You
- Helpful, direct, and efficient
- You work in [colleague's domain — e.g., product, engineering, ops]
- You communicate in English (and Arabic when asked)

## Your Human
- [Colleague Name], [Role] at Breadfast
- Based in Cairo

## Guidelines
- Keep responses concise unless asked for detail
- Use bullet points for lists
- Ask clarifying questions when the request is ambiguous
EOF
```

Create `AGENTS.md` and `TOOLS.md`:
```bash
cp ~/.openclaw/workspace/AGENTS.md ~/.openclaw/workspace-atlas/AGENTS.md
touch ~/.openclaw/workspace-atlas/TOOLS.md
```

### Step 3: Update OpenClaw Config

Add to `~/.openclaw/openclaw.json`:

```json5
{
  // ... existing config ...

  agents: {
    defaults: {
      // ... existing defaults ...
    },
    list: [
      {
        id: "main",  // Zidan's agent (Aegis) — keep as-is
        default: true,
        workspace: "~/.openclaw/workspace",
        identity: { name: "Aegis", emoji: "🛡️" }
      },
      {
        id: "atlas",
        workspace: "~/.openclaw/workspace-atlas",
        model: "anthropic/claude-sonnet-4-5",  // Sonnet for cost efficiency
        identity: { name: "Atlas", emoji: "🗺️" },
        heartbeat: { every: "0m" },  // Disabled initially — save tokens
        tools: {
          deny: ["nodes", "cron", "gateway"]  // Restrictive for pilot
        }
      }
    ]
  },

  channels: {
    telegram: {
      accounts: {
        default: {
          // Zidan's existing bot token (or keep using env var)
        },
        atlas: {
          name: "Atlas",
          botToken: "222222:BBB..."  // The new bot token
        }
      }
    }
  },

  bindings: [
    { agentId: "atlas", match: { channel: "telegram", accountId: "atlas" } }
    // Zidan's agent is the default — no explicit binding needed
  ]
}
```

### Step 4: Restart Gateway

```bash
openclaw gateway restart
```

### Step 5: Verify

```bash
openclaw agents list          # Should show "main" + "atlas"
openclaw channels status      # Should show both Telegram accounts connected
openclaw security audit       # Check for issues
```

### Step 6: Onboard the Colleague

1. Send them the bot link: `t.me/breadfast_atlas_bot`
2. They DM the bot → get a pairing code
3. Zidan approves: `openclaw pairing approve telegram <code>`
4. Done — they can start chatting

### Step 7: Customize Over Time

Things to tweak based on feedback:
- **SOUL.md** — refine personality, add domain-specific context
- **Skills** — install relevant skills in `~/.openclaw/workspace-atlas/.openclaw/skills/`
- **Tools** — enable/disable based on what the colleague needs
- **Model** — upgrade to Opus if they need stronger reasoning, or downgrade to Haiku for simple Q&A
- **Heartbeat** — enable if the colleague wants proactive check-ins

---

## 6. Scaling Considerations

### At 5 Agents

| Concern | Impact | Mitigation |
|---------|--------|------------|
| Config complexity | Moderate | Use `$include` to split agent configs into separate files |
| Concurrency | Low-medium | Set `agents.defaults.maxConcurrent: 3-5` |
| API costs | $150-400/mo (Sonnet) | Monitor with `/usage cost` per agent |
| Bot management | 5 Telegram bots | Script BotFather setup |
| Server resources | Minimal | Single VPS is fine (2GB+ RAM) |

### At 10 Agents

| Concern | Impact | Mitigation |
|---------|--------|------------|
| Config management | High | **Must** use `$include` per-agent configs |
| Concurrency | Medium | `maxConcurrent: 5-8`, queue mode for overflow |
| API costs | $300-800/mo | Consider Haiku for light-use agents, tiered models |
| Disk space | Growing | Session pruning, compaction, archival policy |
| Monitoring | Needed | Set up log aggregation, cost alerts |

### At 20 Agents

| Concern | Impact | Mitigation |
|---------|--------|------------|
| Single gateway | Bottleneck risk | Consider 2 gateways (profiles) for resilience |
| Config | Complex | Build tooling/scripts for agent provisioning |
| API costs | $600-1600/mo | Negotiate Anthropic volume pricing; mix models aggressively |
| Onboarding | Repeated work | Script the entire flow (bot creation, workspace setup, config update) |
| Support | Real overhead | Need documentation, FAQ, and a "how to use your agent" guide |

### Infrastructure at Scale

| Agents | Server | RAM | CPU | Storage |
|--------|--------|-----|-----|---------|
| 1-5 | Single VPS | 2GB | 2 vCPU | 20GB |
| 5-15 | Single VPS | 4GB | 4 vCPU | 50GB |
| 15-30 | Beefier VPS or 2 instances | 8GB | 4-8 vCPU | 100GB |

The bottleneck is never compute — it's the API calls. OpenClaw itself is lightweight (Node.js). The main scaling concern is managing configs and costs.

### Management Automation (at 10+)

Build a simple script:

```bash
#!/bin/bash
# provision-agent.sh <agent-id> <bot-token> <colleague-name> <role>
AGENT_ID=$1
BOT_TOKEN=$2
NAME=$3
ROLE=$4

mkdir -p ~/.openclaw/workspace-${AGENT_ID}
# Generate SOUL.md, AGENTS.md, TOOLS.md from templates
# Update openclaw.json (or write an $include file)
# Restart gateway
```

---

## Appendix: Quick Reference

### Chat Commands (for colleagues)

| Command | What it does |
|---------|-------------|
| `/status` | Check model, token usage, costs |
| `/new` | Start a fresh session |
| `/model sonnet` | Switch model (if configured) |
| `/compact` | Summarize long conversation |
| `/reasoning off\|low\|high` | Toggle thinking |

### Cost Monitoring

```bash
# Check all sessions and their usage
openclaw sessions --active 60

# Check specific agent sessions  
openclaw sessions | grep atlas
```

### Emergency Controls

```bash
# Disable a colleague's agent quickly
openclaw config set "agents.list[1].enabled" false
openclaw gateway restart

# Or just stop the Telegram account
openclaw channels remove --channel telegram --account atlas
```

---

## Decision Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Shared gateway | Native support, simpler ops |
| Channel | Telegram (separate bots) | Lowest friction, clean isolation |
| Pilot model | Sonnet 4.5, thinking:low | Best quality/cost ratio |
| Pilot cost | ~$30-50/mo | Moderate usage estimate |
| Heartbeat | Disabled for pilot | Save tokens, enable later if wanted |
| Tools | Restricted | No cron/nodes/gateway for safety |
| Scaling path | $include configs + provisioning script at 10+ | Keep it manageable |
