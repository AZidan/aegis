# Architecture Decisions

**Date:** 2026-02-05  
**Status:** Decided  
**Participants:** Zidan, Aegis

---

## Context

Designing a multi-tenant AI agent platform. Key concern: preventing agents from accessing other agents' files/credentials (triggered by Nadia accessing Zidan's Jira credentials incident).

---

## Decision 1: Multi-Tenant Isolation Model

### Decision
**OpenClaw-per-Company** — Each company gets its own isolated OpenClaw container/instance.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 SAAS CONTROL PLANE                       │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │   Acme Co   │  │  Globex Inc │  │  Initech    │      │
│  │  (OpenClaw) │  │  (OpenClaw) │  │  (OpenClaw) │      │
│  │   3 agents  │  │   5 agents  │  │   2 agents  │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│       Container       Container       Container          │
└─────────────────────────────────────────────────────────┘
```

### Rationale
- **Hard isolation between companies** — non-negotiable for enterprise
- **Soft isolation within company** — agents in same org, acceptable risk
- Standard multi-tenant pattern, proven at scale

### Alternatives Considered
| Option | Verdict |
|--------|---------|
| Shared OpenClaw, namespace isolation | Rejected — one bug = catastrophic breach |
| Container per agent | Rejected — overkill, heavy orchestration |

---

## Decision 2: Intra-Company Agent Isolation

### Decision
**Hard filesystem isolation + messaging-only communication via allowlists**

### Filesystem
- Each agent owns their files **completely**
- **No cross-agent file access** — ever
- Agents can have internal policies (e.g., "don't share WIP work")

### Communication
- **Messaging only** via `sessions_send`
- **Default: deny all**
- Main agent ↔ all subagents: **always allowed**
- Subagent ↔ subagent: **explicit allowlist required**

### Visualization

```
         ┌──────────────────────────────────┐
         │           MAIN AGENT             │
         │  (hub - can reach all subagents) │
         └──────────────────────────────────┘
              ▲   │   │   │   ▲
              │   ▼   ▼   ▼   │
         ┌────┴───┬───┴───┬───┴────┐
         │        │       │        │
      ┌──▼──┐  ┌──▼──┐ ┌──▼──┐  ┌──▼──┐
      │ PM  │  │ Eng │ │ Ops │  │ HR  │
      │Agent│  │Agent│ │Agent│  │Agent│
      └──┬──┘  └──┬──┘ └─────┘  └─────┘
         │       │
         └───────┘  (explicit peer allowlist)
```

### Rationale
- Zero-trust by default
- Clear hierarchy — main agent is coordinator
- Audit-friendly — all paths explicit
- Prevents lateral movement if one agent compromised

---

## Decision 3: Allowlist Management

### Decision
| Who | Can Configure |
|-----|---------------|
| Main agent | Subagent ↔ subagent links (when instructed by human) |
| Company admin | Role-based rules (PM↔Eng) or individual agent pairs via dashboard |

### Rationale
- Flexibility for different org structures
- Main agent can self-manage within bounds
- Admin has override authority

---

## Decision 4: Shared Resources

### Decision
Three patterns supported:

| Pattern | Use Case | Example |
|---------|----------|---------|
| **Shared folder (R/O)** | Company knowledge base | `/shared/docs/` mounted read-only |
| **Per-agent credentials** | Tools requiring audit trail | Jira, GCal — each agent has own token |
| **Shared credentials** | Company-wide read resources | Tableau dashboards, internal APIs |

### Default
**Per-agent credentials** — simpler, auditable. Add shared credentials as optional tier for read-only resources (BI, knowledge bases).

---

## Decision 5: Skills & Tools Architecture

### Decision
**Hybrid model (Option C)**: Core skills shared + company custom skills as overlay

### Layers

```
┌─────────────────────────────────────────────────┐
│  Layer 3: Company Custom Skills                 │
│  (company-specific, can override core)          │
├─────────────────────────────────────────────────┤
│  Layer 2: Role Skills (from marketplace)        │
│  PM skills, Eng skills, Ops skills              │
├─────────────────────────────────────────────────┤
│  Layer 1: Core Tools (read-only, shared)        │
│  Tableau, Jira, Calendar, Email, etc.           │
└─────────────────────────────────────────────────┘
```

### Credentials
- **Per-agent** by default
- **Per-company** optional for shared read-only resources

---

## Decision 6: Skill Governance & Security

### Decision
**Verified skill marketplace + phased sandboxing**

### Governance Model
| Actor | Permissions |
|-------|-------------|
| Platform team | Maintains verified skill registry, reviews code |
| Company admin | Installs from registry, can request custom skills |
| Agents | Use installed skills, cannot self-install |

### Sandboxing Roadmap

**Phase 1 (MVP):** 
- Verified marketplace only
- Code review before publish
- No runtime sandboxing

**Phase 2:**
- Deno-style permission manifest
- Skills declare: `network`, `files`, `env` access
- Runtime logs violations (soft enforce)

**Phase 3:**
- Hard enforcement
- Skills violating declared permissions get killed
- Container execution for untrusted skills

### Permission Manifest Example (Phase 2+)
```yaml
# In SKILL.md
permissions:
  network: ["api.tableau.com", "amplitude.com"]
  files: ["read:workspace/*", "write:workspace/output/*"]
  env: ["TABLEAU_TOKEN"]
```

---

## Open Items

| Item | Status | Notes |
|------|--------|-------|
| Control plane architecture | Not started | Admin dashboard, provisioning API |
| Pricing model | Not started | Per-agent? Per-company? Usage-based? |
| Skill marketplace UX | Not started | How admins discover/install |
| Onboarding flow | Not started | Company signup → first agent |

---

## References

- [Multi-Agent Technical Plan](../docs/multi-agent-plan.md) — Original detailed architecture
- [Skill Governance Doc](~/.openclaw/docs/skill-governance.md) — Current Breadfast governance model
- [Agent Onboarding Playbook](~/.openclaw/docs/agent-onboarding.md) — How we onboard agents today
