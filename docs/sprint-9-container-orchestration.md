# Sprint 9: Container Orchestration (Est. 34 pts)

## Context

Sprints 1-7 built the entire Aegis control plane as a database-only simulation: provisioning creates DB records with fake `containerId`/`containerUrl`, health probes return random data via `MockHealthProbe`, and `restartContainer()` is a no-op stub. The Channel Proxy (Sprint 7) already calls `POST ${containerUrl}/hooks/aegis` to forward inbound events — but there's no real container at the other end.

**Sprint 9 bridges the gap** by implementing real Docker container lifecycle management. Each tenant gets an isolated OpenClaw container with hardened security (SOPS+age secrets, tmpfs, `--cap-drop=ALL`). The existing `coding/docker-security/` folder already has `Dockerfile.secrets`, `docker-compose.secure-test.yml`, and `secrets-entrypoint.sh` — Sprint 9 integrates these into the platform's automated provisioning pipeline.

## What Already Exists

| Component | Location | Current State |
|-----------|----------|--------------|
| Provisioning queue | `backend/src/provisioning/` | BullMQ pipeline with 5 simulated steps (`sleep()` delays), generates fake containerId/URL |
| Health monitoring | `backend/src/health/` | `HealthProbeStrategy` interface + `MockHealthProbe` (random data). Real probe swap via DI token `HEALTH_PROBE_STRATEGY` |
| Restart stub | `backend/src/admin/tenants/tenants.service.ts:594` | `restartContainer()` returns `{ message, estimatedDowntime }` — no actual restart |
| Channel Proxy | `backend/src/channel-proxy/` | `processInbound()` reads `tenant.containerUrl` and enqueues `forward-to-container` job with real HTTP POST |
| Docker security layer | `coding/docker-security/` | `Dockerfile.secrets`, `secrets-entrypoint.sh`, SOPS+age scripts, docker-compose files |
| Tenant model | `backend/prisma/schema.prisma:225` | Has `containerId`, `containerUrl`, `resourceLimits`, `modelDefaults`, `deploymentRegion` |
| Config history | `backend/prisma/schema.prisma:282` | `TenantConfigHistory` model — config snapshots with changedBy and description |
| Platform dispatcher | `backend/src/channel-proxy/platform-dispatcher.service.ts` | Stub dispatchers for Slack/Teams/Discord |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ContainerOrchestrator (Interface)                  │
│  createContainer() | deleteContainer() | restartContainer()          │
│  getContainerStatus() | getContainerLogs() | updateContainerConfig() │
├───────────────────────┬─────────────────────────────────────────────┤
│  DockerOrchestrator   │  KubernetesOrchestrator                      │
│  (Dockerode API)      │  (@kubernetes/client-node)                   │
│  Dev + single-server  │  Production multi-node                       │
└───────────────────────┴─────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ProvisioningProcessor  HealthProbe   TenantsService
        (replace sleep stubs)  (real HTTP)   (real restart)
```

## Stories (3 stories, 3 waves)

### Story 1: Container Orchestration Module (13 pts, backend)

New module `backend/src/container/` with abstracted orchestrator.

| File | Action | Description |
|------|--------|-------------|
| `backend/src/container/container.module.ts` | Create | Module: register orchestrator based on `CONTAINER_RUNTIME` env var (`docker` or `kubernetes`) |
| `backend/src/container/interfaces/container-orchestrator.interface.ts` | Create | `ContainerOrchestrator` interface: `create()`, `delete()`, `restart()`, `stop()`, `getStatus()`, `getLogs()`, `updateConfig()` |
| `backend/src/container/interfaces/container-config.interface.ts` | Create | `ContainerCreateOptions`, `ContainerStatus`, `ContainerLogOptions` types |
| `backend/src/container/container.constants.ts` | Create | `CONTAINER_ORCHESTRATOR` DI token, image name, default resource limits, network names |
| `backend/src/container/docker-orchestrator.service.ts` | Create | Dockerode-based implementation. Creates containers from `Dockerfile.secrets` image with: tmpfs `/run/secrets/openclaw`, `--cap-drop=ALL`, `--read-only`, port allocation (18789 base + tenant offset), health check, named `aegis-{tenantId.slice(0,8)}` |
| `backend/src/container/kubernetes-orchestrator.service.ts` | Create | K8s client-node implementation. Creates: Namespace `aegis-{slug}`, Deployment (1 replica, same image), Service (ClusterIP), NetworkPolicy (deny all ingress except control plane), ConfigMap, Secret |
| `backend/src/container/container-config-generator.service.ts` | Create | **OpenClaw config generator**: reads tenant's agents (roles, model tiers, tool policies, allowlists, channel connections) and builds a full `openclaw.json` config (see Config Gen section below) |
| `backend/src/config/configuration.ts` | Modify | Add `container.runtime` (`docker`\|`kubernetes`), `container.dockerHost`, `container.openclawImage`, `container.networkName`, `container.basePort` |

### Story 2: Provisioning + Restart Integration (13 pts, backend)

Replace all stubs with real orchestrator calls.

| File | Action | Description |
|------|--------|-------------|
| `backend/src/provisioning/provisioning.processor.ts` | Modify | Replace `sleep()` stubs: step 1 = `orchestrator.create()`, step 2 = wait for container healthy, step 3 = `configGenerator.generate()` + `orchestrator.updateConfig()`, step 4 = install skills (existing), step 5 = health check via `orchestrator.getStatus()`. Save real `containerId` and `containerUrl` |
| `backend/src/provisioning/provisioning.module.ts` | Modify | Import `ContainerModule` |
| `backend/src/admin/tenants/tenants.service.ts` | Modify | Replace `restartContainer()` stub -> inject orchestrator, call `orchestrator.restart()`. Replace `getTenantHealth()` to use real container status as fallback |
| `backend/src/admin/tenants/tenants.module.ts` | Modify | Import `ContainerModule` |
| `backend/src/health/health.module.ts` | Modify | Swap `MockHealthProbe` -> `DockerHealthProbe` (conditional: use mock if `CONTAINER_RUNTIME=mock`) |
| `backend/src/health/docker-health-probe.ts` | Create | Real probe: `GET ${containerUrl}/health`, parse response, map to `HealthProbeResult`. Timeout 5s, treat timeout as `down` |
| `backend/src/app.module.ts` | Modify | Register `ContainerModule` |

### Story 3: Config Generation + Security Integration (8 pts, backend)

OpenClaw config generator + secrets management integration.

| File | Action | Description |
|------|--------|-------------|
| `backend/src/container/container-config-generator.service.ts` | (Created in S1) | Generates complete `openclaw.json` from DB state |
| `backend/src/container/interfaces/openclaw-config.interface.ts` | Create | TypeScript types matching OpenClaw's config schema (from security whitepaper Part 3) |
| `backend/src/container/secrets-manager.service.ts` | Create | Manages per-tenant age keypairs: `generateKeys()`, `encryptConfig()`, `rotateKeys()`. Wraps `age-keygen` CLI or native age library |
| `backend/src/container/container-network.service.ts` | Create | Docker network management: create tenant-isolated bridge, connect/disconnect containers |

---

## Config Generation Detail

The `ContainerConfigGeneratorService` reads tenant state from DB and produces `openclaw.json`:

```typescript
// Input: tenantId
// Reads from DB: Tenant (model defaults, resource limits), Agent[] (roles, tool policies, model tiers),
//   ChannelConnection[] (platform tokens), AgentAllowlist[] (communication graph), SkillInstallation[] + Skill[]

// Output structure (maps to security whitepaper Part 3 + 7.4):
{
  gateway: {
    bind: "lan",
    port: 18789,
    auth: { mode: "token", token: "${GATEWAY_AUTH_TOKEN}" },
    controlUi: { enabled: false }
  },
  agents: {
    defaults: {
      sandbox: { mode: "all", scope: "agent", workspaceAccess: "ro" }
    },
    list: {
      // Per-agent from DB: name, role -> description, modelTier -> model config
      "agent-slug": {
        model: { tier: "sonnet", temperature: 0.3, thinkingMode: "standard" },
        tools: { allow: [...toolPolicy.allow], deny: ["elevated"] },
        sandbox: { mode: "all" }
      }
    }
  },
  channels: {
    // From ChannelConnection records -- tokens as ${PLACEHOLDER} env vars
    telegram: { botToken: "${TELEGRAM_BOT_TOKEN}", dmPolicy: "allowlist" },
    slack: { botToken: "${SLACK_BOT_TOKEN}" }
  },
  messaging: {
    // From AgentAllowlist -- translate to OpenClaw allowlist format
    allowlist: { "agent-a": ["agent-b"], "agent-b": ["agent-a"] }
  },
  skills: {
    // From SkillInstallation + Skill records -- installed skill configs
    entries: { "skill-slug": { enabled: true, permissions: {...} } }
  },
  logging: {
    redactSensitive: "tools",
    redactPatterns: [
      "\\bsk-[A-Za-z0-9_-]{20,}\\b",     // Anthropic keys
      "\\bxoxb-[A-Za-z0-9-]+\\b",         // Slack tokens
      "\\b[0-9]+:[A-Za-z0-9_-]{35}\\b"    // Telegram tokens
    ]
  },
  tools: {
    deny: ["elevated"],
    sandbox: { tools: { deny: ["exec", "process"] } }
  }
}
```

## Execution Order

| Wave | Stories | Agent | Rationale |
|------|---------|-------|-----------|
| 1 | Story 1 (Container Module) | `api-engineer` | Core abstraction, no deps on existing code except interfaces |
| 2 | Story 3 (Config Gen + Secrets) | `api-engineer` | Needs container module from Wave 1 |
| 3 | Story 2 (Integration) | `api-engineer` | Rewires existing provisioning/health/tenant code to use real orchestrator. Must come last |

## New Dependencies

```bash
cd backend
npm install dockerode @types/dockerode        # Docker Engine API
npm install @kubernetes/client-node            # K8s API (optional, can defer install)
```

## Tests (~60)

| File | Tests | Description |
|------|-------|-------------|
| `test/container/docker-orchestrator.service.spec.ts` | ~10 | Create, delete, restart, getStatus, getLogs (mocked Dockerode) |
| `test/container/kubernetes-orchestrator.service.spec.ts` | ~10 | Create namespace+deployment+service, delete, restart (mocked K8s client) |
| `test/container/container-config-generator.service.spec.ts` | ~12 | Config gen from various DB states: single agent, multi-agent, with channels, with skills, with allowlists |
| `test/container/secrets-manager.service.spec.ts` | ~6 | Key generation, config encryption, rotation |
| `test/container/container-network.service.spec.ts` | ~4 | Network create, connect, disconnect |
| `test/container/docker-health-probe.spec.ts` | ~6 | Healthy response, timeout -> down, degraded metrics, connection refused |
| `test/provisioning/provisioning.processor.spec.ts` | ~8 (update existing) | Replace mock tests with orchestrator-call assertions |
| `test/admin/tenants/tenants.service.spec.ts` | ~4 (update existing) | restartContainer now calls orchestrator |

## Modified Files Summary

| File | Change |
|------|--------|
| `backend/src/app.module.ts` | Add `ContainerModule` |
| `backend/src/config/configuration.ts` | Add container config section |
| `backend/src/config/validation.ts` | Add `CONTAINER_RUNTIME` env validation |
| `backend/src/provisioning/provisioning.processor.ts` | Replace sleep stubs with real orchestrator calls |
| `backend/src/provisioning/provisioning.module.ts` | Import ContainerModule |
| `backend/src/admin/tenants/tenants.service.ts` | Real `restartContainer()` |
| `backend/src/admin/tenants/tenants.module.ts` | Import ContainerModule |
| `backend/src/health/health.module.ts` | Conditional real/mock probe |
| `backend/package.json` | Add dockerode + @kubernetes/client-node |

## New Files Summary

| File | Purpose |
|------|---------|
| `backend/src/container/container.module.ts` | Module with conditional orchestrator registration |
| `backend/src/container/interfaces/container-orchestrator.interface.ts` | Core abstraction |
| `backend/src/container/interfaces/container-config.interface.ts` | Container lifecycle types |
| `backend/src/container/interfaces/openclaw-config.interface.ts` | OpenClaw config schema types |
| `backend/src/container/container.constants.ts` | DI tokens, defaults |
| `backend/src/container/docker-orchestrator.service.ts` | Docker implementation |
| `backend/src/container/kubernetes-orchestrator.service.ts` | K8s implementation |
| `backend/src/container/container-config-generator.service.ts` | DB -> openclaw.json |
| `backend/src/container/secrets-manager.service.ts` | Age key + SOPS encryption |
| `backend/src/container/container-network.service.ts` | Docker network isolation |
| `backend/src/health/docker-health-probe.ts` | Real HTTP health probe |
| + 8 test files | See Tests section |

## Environment Variables

```env
# Container runtime: "docker" | "kubernetes" | "mock" (default: mock for dev)
CONTAINER_RUNTIME=docker

# Docker-specific
DOCKER_HOST=unix:///var/run/docker.sock
OPENCLAW_IMAGE=openclaw/openclaw:secrets  # Built from coding/docker-security/Dockerfile.secrets
CONTAINER_NETWORK=aegis-tenant-network
CONTAINER_BASE_PORT=19000  # Tenant ports: 19000 + offset

# K8s-specific (when CONTAINER_RUNTIME=kubernetes)
K8S_NAMESPACE_PREFIX=aegis-
K8S_OPENCLAW_IMAGE=registry.aegis.ai/openclaw:secrets
```

## Verification

```bash
# Story 1: Container module unit tests
cd backend && npx jest test/container/ --verbose

# Story 2: Updated provisioning tests
npx jest test/provisioning/ --verbose

# Story 3: Config gen + secrets tests
npx jest test/container/container-config-generator --verbose
npx jest test/container/secrets-manager --verbose

# Full regression
npx jest --passWithNoTests

# Integration test (requires Docker running locally):
# 1. Build the OpenClaw image from coding/docker-security/
# 2. Set CONTAINER_RUNTIME=docker
# 3. Create a tenant via admin API -> observe real container spawned
# 4. Check container health -> real metrics returned
# 5. Restart container -> container actually restarts
# 6. Channel proxy inbound -> HTTP forwarded to real container
```

## Risks

| Risk | Mitigation |
|------|------------|
| Docker socket access in tests | All orchestrator tests mock Dockerode/K8s client. Real Docker only in manual integration tests |
| K8s implementation untestable locally | K8s orchestrator uses mocked client. Real K8s deferred to Phase 4 deployment |
| OpenClaw image not available | `CONTAINER_RUNTIME=mock` falls back to existing `MockHealthProbe` + simulated provisioning. Tests always work |
| Config gen complexity | Start with minimal viable config (gateway + agents + sandbox). Add channels/skills/allowlists incrementally |
| Port collision | Use `CONTAINER_BASE_PORT` offset strategy + port allocation table in Redis |

## Prerequisites

- Sprint 8 must be complete (Skill SDK + Network Policy enforcement feed into config generation)
- `coding/docker-security/Dockerfile.secrets` image must be buildable locally
- Docker Engine accessible via socket (dev) or K8s cluster available (prod)
