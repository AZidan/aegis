# AI Transformation SaaS

**Status:** Planning  
**Started:** 2026-02-05  
**Owner:** Zidan

## Vision

A multi-tenant SaaS/IaaS platform that enables companies to deploy AI-powered multi-agent systems for their teams. Companies onboard through a control plane, get their own isolated environment with multiple agents, and configure via admin dashboard.

## Key Differentiators

1. **True Isolation** — Companies are fully isolated at infra level (container per company)
2. **Zero-Trust Agent Communication** — Agents can't see each other's files; messaging via explicit allowlists
3. **Verified Skill Marketplace** — Curated, security-reviewed skills that company admins can install
4. **Layered Architecture** — Core tools → Role skills → Individual agent configs

## Directory Structure

```
ai-transformation/
├── README.md
├── roadmap/
│   └── architecture.md      # Isolation & communication model (DECIDED)
├── coding/
│   └── (technical specs - TBD)
├── docs/
│   └── multi-agent-plan.md  # Original detailed technical plan
├── marketing/
│   └── (positioning, pitch decks - TBD)
└── assets/
```

## Related Internal Projects

- `projects/breadfast-toolbox/` — Layer 1 pilot implementation (shared tools)
- `projects/breadfast-pm/` — Layer 2 pilot implementation (PM role skills)
- Nadia agent — First production multi-agent deployment

## Quick Links

- [Architecture Decisions](roadmap/architecture.md)
- [Multi-Agent Technical Plan](docs/multi-agent-plan.md)
