# Sprint 9: Container Orchestration (Est. 34 pts)

## Context

Sprints 1-7 built the Aegis control plane as a database-first simulation:
- provisioning creates DB records with fake `containerId` and `containerUrl`
- health probes return synthetic data via `MockHealthProbe`
- `restartContainer()` is a no-op stub

The Channel Proxy already routes inbound events to tenant runtime via `POST ${containerUrl}/hooks/aegis`, but no real tenant container is running yet.

Sprint 9 replaces simulation with real container lifecycle management while preserving the existing architectural decisions:
- OpenClaw-per-Company isolation
- messaging-only coordination
- unified channel layer via Aegis proxy
- runtime hardening with secrets isolation

## Scope Boundary

This sprint delivers the container runtime abstraction and Docker-backed implementation required to make provisioning real.

Kubernetes support is included behind the same abstraction layer for production, with explicit environment gating:
- `CONTAINER_RUNTIME=docker` for local/dev and single-host deployments
- `CONTAINER_RUNTIME=kubernetes` for production multi-node deployments

If production rollout requires strict MVP parity with K8s namespace/service/network policy in this sprint, treat Kubernetes items below as mandatory acceptance criteria. Otherwise mark them as follow-up gate criteria before production cutover.

Runtime abstraction guarantee (mandatory):
- all provisioning/health/restart flows depend on `ContainerOrchestrator` only
- dev path: `CONTAINER_RUNTIME=docker`
- production path: `CONTAINER_RUNTIME=kubernetes`
- runtime-specific clients are isolated behind adapter services; no direct Docker/K8s calls in business services

## What Already Exists

| Component | Location | Current State |
|-----------|----------|--------------|
| Provisioning queue | `backend/src/provisioning/` | BullMQ pipeline with 5 simulated steps (`sleep()` delays), fake containerId/URL |
| Health monitoring | `backend/src/health/` | `HealthProbeStrategy` + `MockHealthProbe` (random data) |
| Restart stub | `backend/src/admin/tenants/tenants.service.ts` | `restartContainer()` returns static response |
| Channel Proxy | `backend/src/channel-proxy/` | Inbound pipeline forwards to `tenant.containerUrl` |
| Docker security assets | `coding/docker-security/` | `Dockerfile.secrets`, `secrets-entrypoint.sh`, secure compose + scripts |
| Tenant model | `backend/prisma/schema.prisma` | Includes `containerId`, `containerUrl`, limits/defaults/region |
| Config history | `backend/prisma/schema.prisma` | `TenantConfigHistory` snapshots |
| Dispatcher stubs | `backend/src/channel-proxy/platform-dispatcher.service.ts` | Slack/Teams/Discord placeholders |

## Unified Channel Layer (Non-Negotiable)

Aegis uses one unified channel ingress/egress layer and routes into tenant runtimes.

Inbound:
1. Platform event arrives at Aegis Channel Proxy.
2. Proxy resolves tenant and agent routing.
3. Proxy forwards to tenant OpenClaw via `POST /hooks/aegis`.

Outbound:
1. Tenant OpenClaw aegis plugin posts to Aegis `POST /api/v1/channel/outbound`.
2. Proxy validates tenant context and dispatches to platform API.

Constraint:
- platform connectors never talk directly to tenant containers
- tenant container ingress is only from trusted control-plane/proxy path

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    ContainerOrchestrator (Interface)               │
│ create() | delete() | restart() | stop() | getStatus() | getLogs()│
│ updateConfig()                                                     │
├───────────────────────┬─────────────────────────────────────────────┤
│ DockerOrchestrator    │ KubernetesOrchestrator                     │
│ Dockerode API         │ @kubernetes/client-node                    │
│ Dev/single-host       │ Production multi-node                      │
└───────────────────────┴─────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ProvisioningProcessor  HealthProbe   TenantsService
        (real create/config)   (real HTTP)   (real restart)
```

## Stories (3 stories, 3 waves)

### Story 1: Container Orchestration Module (13 pts)

| File | Action | Description |
|------|--------|-------------|
| `backend/src/container/container.module.ts` | Create | Register orchestrator by `CONTAINER_RUNTIME` |
| `backend/src/container/interfaces/container-orchestrator.interface.ts` | Create | Interface for lifecycle/status/log/config ops |
| `backend/src/container/interfaces/container-config.interface.ts` | Create | Types: create options, status, logs, config payload |
| `backend/src/container/container.constants.ts` | Create | DI token, defaults, image/network constants |
| `backend/src/container/docker-orchestrator.service.ts` | Create | Real Docker implementation using secure image and runtime flags |
| `backend/src/container/kubernetes-orchestrator.service.ts` | Create | K8s implementation for namespace/deployment/service/network policy/config/secret |
| `backend/src/container/container-config-generator.service.ts` | Create | DB state to full `openclaw.json` generator |
| `backend/src/config/configuration.ts` | Modify | Add `container.*` config keys |

Docker hardening requirements:
- image: `Dockerfile.secrets` build output
- `tmpfs /run/secrets/openclaw`
- `--cap-drop=ALL`
- `--read-only`
- explicit writable mounts for required runtime paths
- healthcheck against `GET /health` on container port `18789`

Port allocation requirements:
- deterministic allocation per tenant
- collision detection and retry
- clear failure if exhausted
- no implicit random host-port assignment in production

### Story 2: Provisioning + Restart Integration (13 pts)

| File | Action | Description |
|------|--------|-------------|
| `backend/src/provisioning/provisioning.processor.ts` | Modify | Replace simulated steps with orchestrator calls and real status checks |
| `backend/src/provisioning/provisioning.module.ts` | Modify | Import `ContainerModule` |
| `backend/src/admin/tenants/tenants.service.ts` | Modify | Replace restart stub with orchestrator-backed restart |
| `backend/src/admin/tenants/tenants.module.ts` | Modify | Import `ContainerModule` |
| `backend/src/health/health.module.ts` | Modify | Conditional probe strategy (`mock` vs real HTTP) |
| `backend/src/health/docker-health-probe.ts` | Create | Real probe with timeout and status mapping |
| `backend/src/app.module.ts` | Modify | Register `ContainerModule` |

Provisioning pipeline target:
1. `orchestrator.create()`
2. wait healthy with bounded timeout/backoff
3. generate config and apply via `orchestrator.updateConfig()`
4. run skill install step
5. final status check and persist real `containerId` + `containerUrl`

### Story 3: Config + Secrets Integration (8 pts)

| File | Action | Description |
|------|--------|-------------|
| `backend/src/container/interfaces/openclaw-config.interface.ts` | Create | TS schema for generated OpenClaw config |
| `backend/src/container/secrets-manager.service.ts` | Create | Key lifecycle + encrypt/decrypt orchestration |
| `backend/src/container/container-network.service.ts` | Create | Tenant network isolation helpers |
| `backend/src/container/container-config-generator.service.ts` | Modify | Include security defaults, bindings, allowlists, channel config |

## Config Generation Detail

`ContainerConfigGeneratorService` reads:
- tenant defaults and limits
- agents + policies
- channel connections/routing context
- allowlist graph
- skill installs

It produces `openclaw.json` with required defaults:

```ts
{
  gateway: {
    bind: "lan",
    port: 18789,
    auth: { mode: "token", token: "${GATEWAY_AUTH_TOKEN}" },
    controlUi: { enabled: false }
  },
  agents: {
    defaults: {
      sandbox: { mode: "all", scope: "agent", workspaceAccess: "ro" },
      tools: {
        sandbox: {
          denyPaths: ["~/.openclaw/**", "/run/secrets/**"]
        }
      }
    },
    list: {
      "agent-slug": {
        model: { tier: "sonnet", temperature: 0.3, thinkingMode: "standard" },
        tools: { allow: ["..."], deny: ["elevated"] },
        sandbox: { mode: "all" },
        workspace: "/home/node/.openclaw/workspaces/agent-slug"
      }
    }
  },
  bindings: [
    { agentId: "agent-slug", match: { channel: "telegram", accountId: "default" } }
  ],
  channels: {
    telegram: { botToken: "${TELEGRAM_BOT_TOKEN}", dmPolicy: "allowlist" },
    slack: { botToken: "${SLACK_BOT_TOKEN}" }
  },
  messaging: {
    allowlist: { "agent-a": ["agent-b"] }
  },
  extensions: {
    "redact-secrets": { enabled: true }
  },
  logging: {
    redactSensitive: "tools",
    redactPatterns: [
      "\\bsk-[A-Za-z0-9_-]{20,}\\b",
      "\\bxoxb-[A-Za-z0-9-]+\\b",
      "\\b[0-9]+:[A-Za-z0-9_-]{35}\\b"
    ]
  },
  tools: {
    deny: ["elevated"],
    sandbox: { tools: { deny: ["exec", "process"] } }
  }
}
```

## Secrets Integration Contract

Use existing secure runtime conventions from `coding/docker-security/`:
- `OPENCLAW_AGE_KEY_FILE=/run/secrets/age_key`
- `OPENCLAW_DATA_DIR=/home/node/.openclaw`
- `OPENCLAW_SECRETS_DIR=/run/secrets/openclaw`
- tmpfs mount at `/run/secrets/openclaw`
- decrypt secrets only into tmpfs at startup
- re-encrypt and wipe plaintext on shutdown
- key delivered via Docker secret (K8s Secret volume in production)

## Health Semantics

Source of truth:
- container runtime health status + HTTP `/health` must both be considered
- provisioning waits for healthy state with max timeout
- health probe timeout = 5s default
- timeout/refusal maps to `down`
- degraded responses map to `degraded`, not hard-fail unless policy says so

## Runtime Selection Matrix

| Environment | Runtime | Required Flags | Notes |
|------------|---------|----------------|-------|
| Local dev | docker | `CONTAINER_RUNTIME=docker` | Uses Docker CLI with tenant network + deterministic host ports |
| CI/unit tests | mock | `CONTAINER_RUNTIME=mock` | No container runtime dependency |
| Production | kubernetes | `CONTAINER_RUNTIME=kubernetes`, `CONTAINER_K8S_ENABLED=true` (or cluster env) | Uses Kubernetes adapter with namespace-scoped deployments/services |

Kubernetes enablement guard:
- if runtime is `kubernetes` but kube env is not available (`CONTAINER_K8S_ENABLED` false and no `KUBECONFIG` / `KUBERNETES_SERVICE_HOST`), orchestrator fails fast with explicit `ServiceUnavailableException`

## Execution Order

| Wave | Stories | Owner | Rationale |
|------|---------|-------|-----------|
| 1 | Story 1 | `api-engineer` | Core abstraction first |
| 2 | Story 3 | `api-engineer` | Config/secrets depend on module skeleton |
| 3 | Story 2 | `api-engineer` | Integrate into existing flows last |

## Dependencies

```bash
cd backend
npm install dockerode @types/dockerode
npm install @kubernetes/client-node
```

## Tests (~60)

| File | Tests | Description |
|------|-------|-------------|
| `test/container/docker-orchestrator.service.spec.ts` | ~10 | Docker lifecycle/status/logs/update |
| `test/container/kubernetes-orchestrator.service.spec.ts` | ~10 | Namespace/deployment/service/policy lifecycle |
| `test/container/container-config-generator.service.spec.ts` | ~12 | Config output across tenant/agent/channel/skills variants |
| `test/container/secrets-manager.service.spec.ts` | ~6 | Key generation, encrypt/decrypt, rotation |
| `test/container/container-network.service.spec.ts` | ~4 | Network create/connect/disconnect |
| `test/health/docker-health-probe.spec.ts` | ~6 | Healthy, timeout, refusal, degraded cases |
| `test/provisioning/provisioning.processor.spec.ts` | ~8 | Real orchestration step assertions |
| `test/admin/tenants/tenants.service.spec.ts` | ~4 | Restart path uses orchestrator |

## Modified Files Summary

| File | Change |
|------|--------|
| `backend/src/app.module.ts` | Register `ContainerModule` |
| `backend/src/config/configuration.ts` | Add `container.*` settings |
| `backend/src/config/validation.ts` | Validate `CONTAINER_RUNTIME` and required vars |
| `backend/src/provisioning/provisioning.processor.ts` | Replace simulated provisioning steps |
| `backend/src/provisioning/provisioning.module.ts` | Import `ContainerModule` |
| `backend/src/admin/tenants/tenants.service.ts` | Real restart integration |
| `backend/src/admin/tenants/tenants.module.ts` | Import `ContainerModule` |
| `backend/src/health/health.module.ts` | Probe strategy switch |
| `backend/package.json` | Add orchestration deps |

## New Files Summary

| File | Purpose |
|------|---------|
| `backend/src/container/container.module.ts` | Runtime abstraction registration |
| `backend/src/container/interfaces/container-orchestrator.interface.ts` | Core orchestrator contract |
| `backend/src/container/interfaces/container-config.interface.ts` | Lifecycle/config/status/log types |
| `backend/src/container/interfaces/openclaw-config.interface.ts` | Generated config schema typing |
| `backend/src/container/container.constants.ts` | Tokens/defaults/constants |
| `backend/src/container/docker-orchestrator.service.ts` | Docker implementation |
| `backend/src/container/kubernetes-orchestrator.service.ts` | Kubernetes implementation |
| `backend/src/container/container-config-generator.service.ts` | DB-to-config generator |
| `backend/src/container/secrets-manager.service.ts` | Secrets lifecycle integration |
| `backend/src/container/container-network.service.ts` | Tenant network isolation |
| `backend/src/health/docker-health-probe.ts` | Runtime HTTP health probe |

## Alignment Notes

- ORM source of truth in current implementation docs is Prisma; keep roadmap docs consistent.
- Unified channel architecture remains in Channel Proxy docs; Sprint 9 only makes tenant runtimes real behind that existing flow.
- This sprint does not redefine channel product behavior; it upgrades runtime execution fidelity and security posture.
