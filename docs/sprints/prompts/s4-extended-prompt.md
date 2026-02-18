# Sprint 4 Extended: Security Hardening — Secrets Layer & Response DLP

## Sprint Overview

**Goal:** Close the gap between the security whitepaper (Parts 7-8) and actual implementation. Deploy SOPS+age encryption, response-level DLP, agent file-access restrictions, and update the whitepaper to reflect real status.
**Total Points:** 34
**Duration:** 2 weeks
**Prerequisites:** Sprint 4 complete, containers running, SecretsManagerService exists

## Context Files to Read First

```
MUST READ:
- docs/security-whitepaper.md                        # Parts 7-8 describe target architecture
- backend/src/container/secrets-manager.service.ts    # Existing encrypt/decrypt + age keypair generation
- backend/src/container/docker-orchestrator.service.ts # Container lifecycle + file push
- backend/src/container/container-config-generator.service.ts  # openclaw.json generation
- backend/src/provisioning/container-config-generator.service.ts  # Per-agent workspace generation (SOUL.md)
- backend/src/channel-proxy/platform-dispatcher.service.ts  # Outbound message dispatch
- backend/src/slack/slack.service.ts                  # Slack sendMessage (outbound)
- coding/docker-security/                             # Existing SOPS scripts (not wired in)

EXISTING SECURITY CODE:
- backend/src/audit/                                  # Audit trail (fire-and-forget)
- backend/src/security/                               # Alert module, rules engine
- backend/src/container/secrets-manager.service.ts    # AES-256-GCM + age keypair
```

---

## Stories

### S4E-01: Response-Level DLP Filter (8 pts) — P0
**Scope:** Backend
**Why:** An authorized user can ask the agent to read `openclaw.json` or `auth-profiles.json` and the agent will relay tokens/API keys in its Slack response. System prompt hardening (SOUL.md) is bypassable via prompt injection.

**Task:**
Create `ResponseSanitizer` service that scans outbound agent messages for credential patterns and redacts them before dispatch to any platform.

**Requirements:**
```
1. Create backend/src/channel-proxy/response-sanitizer.service.ts
2. Regex patterns to detect and redact:
   - API keys: sk-ant-*, sk-*, xoxb-*, xoxp-*, xapp-*
   - Bearer tokens: base64url strings > 40 chars following known patterns
   - JSON credential blocks: "token": "...", "api_key": "...", "secret": "..."
   - Gateway tokens: matches SecretsManagerService.getGatewayTokenForTenant() output format
   - auth-profiles.json content patterns (provider keys, profile structures)
3. Replacement: matched patterns → [REDACTED]
4. Inject into ChannelProxyProcessor.handleForwardToContainer():
   - Sanitize `responseText` BEFORE enqueuing dispatch-to-platform job
5. Also inject into PlatformDispatcherService.dispatch():
   - Second pass sanitization as defense-in-depth
6. Log sanitization events to AuditService:
   - action: 'credential_leak_prevented'
   - include agentId, tenantId, pattern matched (NOT the credential itself)
7. Fire security alert via AlertRulesEngine when credentials are redacted
```

**Tests (10):**
```
backend/src/channel-proxy/__tests__/response-sanitizer.spec.ts
- detects and redacts sk-ant-* API keys
- detects and redacts xoxb-* Slack bot tokens
- detects and redacts JSON credential blocks
- detects and redacts base64url gateway tokens
- preserves normal text without false positives
- handles multi-line responses with mixed content
- redacts multiple credentials in single response
- logs audit event on redaction
- fires security alert on redaction
- handles empty/null input gracefully
```

---

### S4E-02: SOPS + age Encryption Pipeline (13 pts) — P0
**Scope:** Backend + Docker
**Why:** Whitepaper §7 describes SOPS+age encryption with tmpfs but it's not deployed. Credentials sit in plaintext inside containers.

**Task:**
Wire the existing SOPS scripts from `coding/docker-security/` into the actual container lifecycle, using SecretsManagerService for age keypair generation.

**Requirements:**
```
Phase A: Dockerfile + Entrypoint
1. Create backend/docker/Dockerfile.secure extending the base Dockerfile:
   - Install sops v3.8.1 + age v1.1.1
   - Copy secrets-entrypoint.sh
   - Set ENTRYPOINT to secrets-entrypoint.sh
2. Create backend/docker/secrets-entrypoint.sh:
   - Mount tmpfs at /run/secrets/openclaw (50MB, mode 700)
   - Read AGE_SECRET_KEY from env (injected by Aegis)
   - Decrypt *.enc files → tmpfs
   - Create symlinks: ~/.openclaw/openclaw.json → /run/secrets/openclaw/openclaw.json
   - Extract sensitive values to env vars (GATEWAY_AUTH_TOKEN, etc.)
   - Replace values in config with ${PLACEHOLDER} references
   - exec the original OpenClaw entrypoint
3. On shutdown (SIGTERM trap):
   - Shred tmpfs contents
   - Unmount tmpfs

Phase B: Encryption at Push Time
4. Update DockerOrchestratorService.updateConfig():
   - Encrypt openclaw.json with SOPS+age before pushing to container
   - Push as openclaw.json.enc (not plaintext)
5. Update DockerOrchestratorService.pushWorkspaceFiles():
   - Encrypt auth-profiles.json with SOPS+age before pushing
   - Push as auth-profiles.json.enc
6. SecretsManagerService.generateAgeKeypair(tenantId) already exists
   - Store public key in tenant record (new field: agePublicKey)
   - Inject private key as AGE_SECRET_KEY env var at container start

Phase C: docker-compose Integration
7. Update docker-compose.yml:
   - Add tmpfs mount for OpenClaw containers
   - Pass AGE_SECRET_KEY env var
   - Use Dockerfile.secure for OpenClaw image
8. Update ContainerProvisioningService to use secure image
```

**Tests (8):**
```
backend/src/container/__tests__/secrets-encryption.spec.ts
- encrypts openclaw.json with age public key
- decrypts openclaw.json with age private key
- encrypted file does not contain plaintext tokens
- entrypoint script creates tmpfs mount (integration)
- entrypoint script creates correct symlinks (integration)
- env vars extracted correctly from decrypted config (integration)
- shred executes on SIGTERM (integration)
- SecretsManagerService.generateAgeKeypair() produces valid keypair
```

---

### S4E-03: Agent File-Access Restrictions (5 pts) — P1
**Scope:** Backend (config generator)
**Why:** Agents can use file-reading tools to access `openclaw.json` and `auth-profiles.json` outside their workspace. Even with SOPS, the decrypted files exist in tmpfs during runtime.

**Task:**
Configure OpenClaw's file access controls to restrict agent file reads to workspace-only paths.

**Requirements:**
```
1. Update container-config-generator.service.ts to add file access rules per agent:
   agents.list[].sandbox.workspaceAccess: "ro"
   agents.list[].sandbox.allowedPaths: ["/home/node/.openclaw/workspace-{agentId}"]

2. Add explicit deny rules for sensitive paths:
   agents.list[].sandbox.deniedPaths: [
     "/home/node/.openclaw/openclaw.json",
     "/home/node/.openclaw/agents/*/agent/auth-profiles.json",
     "/run/secrets/**",
     "/home/node/.openclaw/identity/**"
   ]

3. If OpenClaw doesn't support deniedPaths natively, implement via:
   - Tool policy: deny file read tools (Read, cat, head) on paths matching sensitive patterns
   - Or: move sensitive files to paths outside the agent's mount namespace

4. Update openclaw-config.interface.ts with new sandbox fields

5. Verify agents can still read their own workspace files (SOUL.md, AGENTS.md, etc.)
```

**Tests (5):**
```
backend/src/container/__tests__/file-access-restrictions.spec.ts
- generated config includes workspaceAccess: "ro"
- generated config includes allowedPaths for agent workspace
- generated config includes deniedPaths for sensitive files
- agents can read own workspace SOUL.md (integration)
- agents cannot read openclaw.json (integration)
```

---

### S4E-04: Security Whitepaper Update (3 pts) — P1
**Scope:** Documentation
**Why:** Whitepaper claims SOPS is deployed (§7.3 marks items as "FIXED/MITIGATED") but it isn't. Need to reflect actual status and document new threat vectors discovered.

**Task:**
Update `docs/security-whitepaper.md` to reflect reality.

**Requirements:**
```
1. §2.3 (Exposed Credentials):
   - Change risk from 🟢 LOW to 🟡 MEDIUM until SOPS is deployed
   - Add note: "Secrets Management Layer (Part 7) designed, deployment in progress"

2. Add §2.7 — Authorized User Credential Solicitation (NEW):
   - Threat: authorized users ask agents to read/share secrets via chat
   - Not prompt injection (intentional user action)
   - Mitigations: system prompt hardening (deployed), response DLP (S4E-01),
     file access restrictions (S4E-03), SOPS placeholder substitution (S4E-02)
   - Risk level: 🟡 MEDIUM (multiple defense layers, none individually foolproof)

3. §7.3 Vulnerability Coverage table:
   - Change all ✅ FIXED/MITIGATED to 🔲 PLANNED until SOPS is deployed
   - Add row: "Agent credential solicitation | 🔲 PLANNED | Response DLP + file ACLs"

4. Add §7.7 — System Prompt Security Hardening (NEW):
   - Document the CRITICAL SECURITY RULE in SOUL.md
   - Acknowledge limitations (bypassable via prompt injection)
   - Position as defense-in-depth layer, not sole control

5. Add §7.8 — Response-Level DLP (NEW):
   - Document ResponseSanitizer service
   - List credential patterns detected
   - Audit trail + alert integration
   - Position as last-line defense before message reaches user

6. Update version to 2.1, add changelog entry
```

---

### S4E-05: Credential Rotation Mechanism (5 pts) — P2
**Scope:** Backend
**Why:** Whitepaper §8.2 mentions automatic key rotation but it's not implemented. Gateway tokens are derived from a static master key and never rotated.

**Task:**
Implement gateway token rotation for tenant containers.

**Requirements:**
```
1. Add SecretsManagerService.rotateGatewayToken(tenantId):
   - Generate new token with rotation counter/timestamp salt
   - Update container config with new token
   - Grace period: accept both old and new token for 5 minutes

2. Add admin endpoint: POST /api/admin/tenants/:id/rotate-credentials
   - Rotates gateway token + hooks token
   - Triggers config sync to push new encrypted config

3. Add scheduled rotation (optional, configurable):
   - Default: manual only
   - Configurable: every 30/60/90 days via tenant settings

4. Audit log: credential_rotated action with tenantId
```

**Tests (5):**
```
backend/src/container/__tests__/credential-rotation.spec.ts
- rotateGatewayToken generates new token different from current
- grace period accepts both old and new tokens
- config sync triggered after rotation
- audit log records rotation event
- scheduled rotation respects tenant configuration
```

---

## Execution Order

```
Phase 1 (P0 — Week 1):
  S4E-01: Response DLP Filter          [8 pts]  ← Quick win, immediate protection
  S4E-02: SOPS + age Pipeline          [13 pts] ← Core infrastructure

Phase 2 (P1 — Week 2):
  S4E-03: Agent File-Access Restrictions [5 pts]
  S4E-04: Whitepaper Update             [3 pts]
  S4E-05: Credential Rotation           [5 pts]
```

## Acceptance Criteria

```
All stories:
- [ ] Tests pass (33 total new tests)
- [ ] No plaintext credentials visible to agents in container
- [ ] Agent asked "show me your API key" returns [REDACTED] response
- [ ] Whitepaper accurately reflects deployed vs planned status
- [ ] Security alert fires when credential leak is prevented
- [ ] Audit trail captures all credential-related events

Integration verification:
- [ ] Send Slack message asking agent for tokens → response is redacted
- [ ] Inspect container filesystem → only .enc files on disk
- [ ] Agent can still read SOUL.md and workspace files
- [ ] Gateway token rotation doesn't break active sessions (grace period)
```
