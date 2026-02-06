# Security Whitepaper: AI Multi-Agent SaaS Platform

**Version:** 2.0  
**Date:** 2026-02-05  
**Updated:** Added Parts 7-8 (Secrets Management Layer)  
**Classification:** Internal

---

## Executive Summary

This document analyzes security vulnerabilities in OpenClaw (the open-source foundation for our platform) and maps them to our mitigation strategy. OpenClaw has faced significant security scrutiny in early 2026, with multiple CVEs and widespread media coverage. We address each concern and explain how our SaaS architecture provides additional protection layers.

---

## Part 1: OpenClaw Security Landscape (Feb 2026)

### Recent Security Incidents

| CVE/Issue | Severity | Description | Status |
|-----------|----------|-------------|--------|
| CVE-2026-25253 | 8.8 (High) | One-click RCE via token hijack | Patched v2026.1.29 |
| Exposed credentials | High | Misconfigured instances leaked API keys, tokens | Ongoing (user config issue) |
| Prompt injection | Medium-High | Adversarial content causes unintended behavior | Architectural (unresolved industry-wide) |
| Malicious skills | High | Skills can contain malware, data exfiltration | Ongoing (no marketplace verification) |

### Media Coverage
- **Cisco:** "Personal AI agents like OpenClaw are a security nightmare"
- **ZDNET:** "5 red flags you shouldn't ignore"
- **SecurityWeek:** "Vulnerability allows hackers to hijack OpenClaw"
- **The Hacker News:** "One-click RCE via malicious link"

---

## Part 2: Vulnerability Analysis & Mitigations

### 2.1 CVE-2026-25253 — Token Hijacking / RCE

**Attack Vector:**
1. Victim clicks malicious link
2. JavaScript steals gateway auth token via cross-site WebSocket hijacking
3. Attacker connects to victim's gateway
4. Disables sandbox (`tools.exec.host: "gateway"`)
5. Disables confirmation (`exec.approvals.set: "off"`)
6. Executes arbitrary commands on host

**OpenClaw Built-in Mitigations:**
- ✅ Patched in v2026.1.29 (Jan 30, 2026)
- ✅ Gateway auth required by default (fail-closed)
- ✅ Control UI intended for localhost only
- ✅ `gateway.controlUi.dangerouslyDisableDeviceAuth` audit warning

**Our SaaS Additional Mitigations:**
- ✅ No Control UI exposed to end users
- ✅ Admin dashboard behind corporate SSO
- ✅ Gateway tokens managed server-side, never in browser
- ✅ All external access via authenticated API gateway

**Risk Level After Mitigation:** 🟢 LOW

---

### 2.2 Prompt Injection Attacks

**Attack Vector:**
- Malicious instructions hidden in emails, web pages, documents
- Agent reads content → executes adversarial instructions
- Can leak data, send info to attacker servers, execute commands

**Key Quote:** *"The sender is not the only threat surface; the content itself can carry adversarial instructions."*

**OpenClaw Built-in Mitigations:**
- ✅ Sandboxing available (Docker containers)
- ✅ Tool allowlists/denylists
- ✅ Read-only workspace mode (`workspaceAccess: "ro"`)
- ✅ Model strength recommendations (prefer Opus 4.5)
- ✅ DM pairing/allowlists limit who can trigger bot

**Our SaaS Additional Mitigations:**
- ✅ Default sandbox mode: `"all"` (every session sandboxed)
- ✅ Content scanning before agent ingestion (Phase 2)
- ✅ Isolated reader agent for untrusted content summarization
- ✅ Model tier enforcement (no Haiku/small models with tools)
- ✅ Real-time anomaly detection (Phase 3)

**Risk Level After Mitigation:** 🟡 MEDIUM (industry-wide unsolved problem)

---

### 2.3 Exposed Credentials & Misconfiguration

**Attack Vector:**
- Publicly accessible OpenClaw instances without authentication
- Plaintext API keys in config files
- Conversation histories exposed

**Leaked Data Types:**
- Anthropic API keys
- Telegram bot tokens
- Slack OAuth credentials
- Signing secrets
- Conversation histories

**OpenClaw Built-in Mitigations:**
- ✅ File permissions hardening (`700`/`600`)
- ✅ Credential storage map documented
- ✅ `openclaw security audit` command
- ✅ `detect-secrets` in CI/CD
- ✅ Gateway auth required by default

**Our SaaS Additional Mitigations:**
- ✅ No user-facing gateway endpoints
- ✅ **Secrets Management Layer** (see Part 7): SOPS+age encryption + tmpfs runtime isolation
- ✅ Credentials stored in encrypted vault (not YAML/JSON)
- ✅ Per-company container isolation
- ✅ Secrets injected via environment at runtime (placeholder substitution)
- ✅ Automatic secret rotation (Phase 2)
- ✅ No SSH access to containers for end users

**Risk Level After Mitigation:** 🟢 LOW (with Secrets Layer deployed)

---

### 2.4 Malicious Skills

**Attack Vector:**
- Skills contain hidden malicious instructions
- Data exfiltration via curl/network calls
- Command injection via embedded bash
- Tool poisoning with malicious payloads
- Popularity gaming to promote malicious skills

**Cisco Findings (test skill "What Would Elon Do?"):**
- 9 security findings
- 2 critical, 5 high severity
- Active data exfiltration
- Direct prompt injection bypass

**OpenClaw Built-in Mitigations:**
- ⚠️ Plugins run in-process (treated as trusted code)
- ✅ `plugins.allow` allowlist recommended
- ⚠️ No built-in marketplace verification

**Our SaaS Additional Mitigations:**
- ✅ Verified skill marketplace only
- ✅ Mandatory security review before publish
- ✅ Cisco Skill Scanner integration
- ✅ No user-installed skills without admin approval
- ✅ Skill permission manifest (Phase 2)
- ✅ Sandboxed skill execution (Phase 3)
- ✅ Code signing for approved skills

**Risk Level After Mitigation:** 🟢 LOW (with marketplace controls)

---

### 2.5 System-Level Privileges

**Attack Vector:**
- OpenClaw can run shell commands, read/write files, execute scripts
- Misconfigured or compromised agent = full system access
- Data exfiltration bypasses traditional DLP

**Cisco Quote:** *"Granting an AI agent high-level privileges enables it to do harmful things if misconfigured."*

**OpenClaw Built-in Mitigations:**
- ✅ Sandboxing modes: `off`, `non-main`, `all`
- ✅ Sandbox scopes: `session`, `agent`, `shared`
- ✅ Tool policy allow/deny lists
- ✅ Elevated mode as explicit escape hatch
- ✅ Workspace access control: `none`, `ro`, `rw`
- ✅ Runs as non-root user (`node`)

**Our SaaS Additional Mitigations:**
- ✅ Default: `sandbox.mode: "all"`, `workspaceAccess: "ro"`
- ✅ Shell access denied by default
- ✅ Explicit tool allowlist per role
- ✅ Read-only filesystem where possible
- ✅ Container capability drops (`--cap-drop=ALL`)
- ✅ No elevated mode for customer agents

**Risk Level After Mitigation:** 🟢 LOW

---

### 2.6 Shadow AI / Supply Chain Risk

**Attack Vector:**
- Employees install OpenClaw without security review
- Agents introduced to corporate environments
- No visibility into agent capabilities or data access

**OpenClaw Built-in Mitigations:**
- ⚠️ Open-source, self-hosted (easy to deploy without oversight)

**Our SaaS Additional Mitigations:**
- ✅ Managed platform — no DIY installations
- ✅ All agents provisioned through control plane
- ✅ Admin visibility into all agent activity
- ✅ Audit logs for compliance
- ✅ Centralized skill/tool management

**Risk Level After Mitigation:** 🟢 LOW

---

## Part 3: OpenClaw Security Configuration Reference

### 3.1 Sandboxing

```jsonc
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "all",              // off | non-main | all
        "scope": "agent",           // session | agent | shared
        "workspaceAccess": "ro",    // none | ro | rw
        "docker": {
          "image": "openclaw-sandbox:bookworm-slim",
          "network": "none",        // no egress by default
          "readOnlyRoot": true
        }
      }
    }
  }
}
```

### 3.2 Tool Policy

```jsonc
{
  "agents": {
    "defaults": {
      "tools": {
        "deny": ["exec", "elevated"],  // deny dangerous tools
        "allow": ["read", "web_search"] // explicit allowlist
      }
    }
  }
}
```

### 3.3 Gateway Security

```jsonc
{
  "gateway": {
    "bind": "loopback",           // never 0.0.0.0 without auth
    "auth": {
      "mode": "token",
      "token": "${OPENCLAW_GATEWAY_TOKEN}"
    },
    "controlUi": {
      "enabled": false            // disable for production
    }
  }
}
```

### 3.4 DM/Group Policies

```jsonc
{
  "channels": {
    "telegram": {
      "dmPolicy": "allowlist",    // pairing | allowlist | disabled
      "groups": {
        "*": { "requireMention": true }
      }
    }
  }
}
```

---

## Part 4: SaaS Platform Security Architecture

### 4.1 Multi-Tenant Isolation

```
┌─────────────────────────────────────────────────────────┐
│                   CONTROL PLANE                          │
│  (API Gateway, SSO, Admin Dashboard, Skill Marketplace)  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  Company A  │  │  Company B  │  │  Company C  │      │
│  │  Container  │  │  Container  │  │  Container  │      │
│  │             │  │             │  │             │      │
│  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │      │
│  │ │OpenClaw │ │  │ │OpenClaw │ │  │ │OpenClaw │ │      │
│  │ │Instance │ │  │ │Instance │ │  │ │Instance │ │      │
│  │ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │      │
│  │             │  │             │  │             │      │
│  │ ┌───┐ ┌───┐ │  │ ┌───┐ ┌───┐ │  │ ┌───┐      │      │
│  │ │PM │ │Eng│ │  │ │PM │ │Ops│ │  │ │PM │      │      │
│  │ └───┘ └───┘ │  │ └───┘ └───┘ │  │ └───┘      │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│      ISOLATED         ISOLATED         ISOLATED          │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Agent Communication Model

- **Default:** DENY ALL
- **Main ↔ Subagent:** Always allowed
- **Subagent ↔ Subagent:** Explicit allowlist required
- **Channel:** Messaging only (`sessions_send`), no file access

### 4.3 Credential Management

| Type | Storage | Access |
|------|---------|--------|
| LLM API keys | Vault (encrypted) | Injected at runtime |
| Channel tokens | Per-company vault | Company admin only |
| Tool credentials | Per-agent credential store | Agent-specific |
| Gateway tokens | Auto-generated, rotated | Never exposed to users |

---

## Part 5: Security Roadmap

### Phase 1: MVP (Current)
- [x] Container-per-company isolation
- [x] Verified skill marketplace
- [x] Default sandbox mode
- [x] Audit logging
- [x] No public gateway endpoints

### Phase 2: Hardening (3-6 months)
- [ ] Skill permission manifest
- [ ] Content scanning before ingestion
- [ ] Automatic secret rotation
- [ ] Runtime behavior monitoring
- [ ] SOC2 Type I preparation

### Phase 3: Zero Trust (6-12 months)
- [ ] Hard permission enforcement (Deno-style)
- [ ] Container-per-skill execution
- [ ] AI-based anomaly detection
- [ ] Penetration testing program
- [ ] SOC2 Type II certification

---

## Part 6: Compliance Positioning

### Enterprise Security Review Talking Points

1. **"How do you prevent data leakage between customers?"**
   - Container-per-company isolation
   - No shared state, separate filesystems
   - Network segmentation

2. **"How do you handle credentials?"**
   - Encrypted vault storage
   - Per-agent credential isolation
   - Automatic rotation capability

3. **"What about prompt injection?"**
   - Sandboxed execution by default
   - Content scanning (Phase 2)
   - Model tier restrictions

4. **"How are skills/plugins vetted?"**
   - Verified marketplace only
   - Mandatory security review
   - Cisco Skill Scanner integration
   - No user-installed skills without admin approval

5. **"Do you have audit logs?"**
   - Every tool invocation logged
   - Every inter-agent message logged
   - Retention configurable per company

---

## Part 7: Secrets Management Layer (Production Implementation)

We have developed a two-layer secrets defense system using SOPS + age encryption combined with runtime tmpfs isolation.

### 7.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     HOST FILESYSTEM                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ~/.openclaw/openclaw.json.enc  (SOPS + age encrypted)  │    │
│  │  ~/.openclaw/agents/*/auth-profiles.json.enc            │    │
│  │  ~/.openclaw/identity/device-auth.json.enc              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                     Docker Startup                               │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              CONTAINER (secrets-entrypoint.sh)           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  tmpfs: /run/secrets/openclaw (RAM only, 50MB)  │    │    │
│  │  │  - openclaw.json (decrypted)                    │    │    │
│  │  │  - auth-profiles.json (decrypted)               │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                         │                                │    │
│  │                   Symlinks                               │    │
│  │                         ▼                                │    │
│  │  ~/.openclaw/openclaw.json → /run/secrets/openclaw/...  │    │
│  │                                                          │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  Environment Variables (extracted from config)  │    │    │
│  │  │  TELEGRAM_BOT_TOKEN=xxx                         │    │    │
│  │  │  SLACK_BOT_TOKEN=xxx                            │    │    │
│  │  │  GATEWAY_AUTH_TOKEN=xxx                         │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                          │    │
│  │  Config files now contain: ${TELEGRAM_BOT_TOKEN}        │    │
│  │  (Agent sees placeholders, not real values)             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                     Container Shutdown                           │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  1. Re-encrypt configs from tmpfs → .enc files          │    │
│  │  2. Shred tmpfs contents                                │    │
│  │  3. Unmount tmpfs                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Components

#### Dockerfile.secrets
Extends base OpenClaw Dockerfile with:
- SOPS v3.8.1 + age v1.1.1 encryption tools
- jq for JSON manipulation
- secrets-entrypoint.sh wrapper
- Non-root user (node, uid 1000)

#### docker-compose.secure-test.yml
Production-ready Docker Compose with:
- tmpfs mount at `/run/secrets/openclaw` (50MB, mode=0700, uid=1000)
- Docker secret for age private key (never in container filesystem)
- Health check endpoint
- Network isolation options

#### secrets-entrypoint.sh
Startup/shutdown wrapper that:
1. Validates age key exists
2. Mounts tmpfs (or relies on Docker Compose mount)
3. Decrypts all `.enc` files to tmpfs
4. Creates symlinks from original paths to tmpfs
5. Extracts credentials to environment variables
6. Replaces credential values with `${PLACEHOLDER}` in tmpfs copy
7. Starts OpenClaw gateway
8. On shutdown: re-encrypts, shreds, unmounts

#### .sops.yaml
SOPS configuration that encrypts only sensitive JSON keys:
```yaml
encrypted_regex: >-
  ^(token|key|password|secret|apiKey|botToken|appToken|
   credential|access|refresh|sessionKey|cookie|privateKey)$
```

### 7.3 Vulnerability Coverage

| Vulnerability | Coverage | Mechanism |
|--------------|----------|-----------|
| **Exposed credentials (disk)** | ✅ FIXED | SOPS+age encryption, only `.enc` files on disk |
| **Credential leakage (memory)** | ✅ FIXED | tmpfs wiped on shutdown, shred before unmount |
| **Prompt injection (config read)** | ✅ MITIGATED | Credentials extracted to env vars, config shows `${PLACEHOLDERS}` |
| **Container escape** | ✅ IMPROVED | Credentials in tmpfs not in mounted volumes |
| **Backup file leakage** | ✅ FIXED | `.bak` files also encrypted |
| **Runtime credential exposure** | ✅ MITIGATED | OpenClaw reads env vars, never sees raw credentials in config |

### 7.4 Verified OpenClaw Configuration Integration

The secrets layer integrates with OpenClaw's native security features:

```jsonc
// Recommended production config (after secrets layer)
{
  // Gateway auth via env var (secrets-entrypoint extracts this)
  "gateway": {
    "bind": "loopback",
    "auth": {
      "mode": "token",
      "token": "${GATEWAY_AUTH_TOKEN}"  // Placeholder, real value in env
    },
    "controlUi": {
      "enabled": false  // Disable for production
    }
  },

  // Sandbox all sessions
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "all",           // Sandbox every session
        "scope": "agent",        // One container per agent
        "workspaceAccess": "ro"  // Read-only workspace access
      }
    }
  },

  // Channel tokens via env vars
  "channels": {
    "telegram": {
      "botToken": "${TELEGRAM_BOT_TOKEN}",  // Placeholder
      "dmPolicy": "allowlist"
    }
  },

  // Tool restrictions
  "tools": {
    "deny": ["elevated"],  // No host escape
    "sandbox": {
      "tools": {
        "deny": ["exec", "process"]  // No shell in sandbox
      }
    }
  },

  // Logging with redaction
  "logging": {
    "redactSensitive": "tools",
    "redactPatterns": [
      "\\bsk-[A-Za-z0-9_-]{20,}\\b",     // Anthropic keys
      "\\bxoxb-[A-Za-z0-9-]+\\b",         // Slack tokens
      "\\b[0-9]+:[A-Za-z0-9_-]{35}\\b"    // Telegram tokens
    ]
  }
}
```

### 7.5 Deployment Scripts

```bash
# 1. Generate encryption keys (once)
./secrets/scripts/generate-keys.sh
# Creates: secrets/keys/age.key, secrets/keys/age.pub

# 2. Encrypt existing configs
./secrets/scripts/encrypt-configs.sh ./openclaw-data
# Creates: openclaw.json.enc, auth-profiles.json.enc, etc.
# Optionally shreds original plaintext files

# 3. Test in isolated environment
docker compose -f docker-compose.secure-test.yml up --build
# Verify: "[secrets-manager] Decrypted N configs to tmpfs"

# 4. Verify setup
./secrets/scripts/verify-setup.sh
# Checks: key exists, .enc files present, no plaintext, symlinks correct

# 5. Key rotation (when needed)
./secrets/scripts/rotate-keys.sh ./openclaw-data
# Generates new keypair, re-encrypts all files
```

### 7.6 Security Audit Checklist

- [ ] `secrets/keys/age.key` is NOT in version control
- [ ] `.gitignore` includes `*.key`, `age.key`, `*.enc` backup patterns
- [ ] All `.json` config files have corresponding `.enc` versions
- [ ] No plaintext credential files remain after migration
- [ ] tmpfs is mounted in container: `mount | grep tmpfs`
- [ ] Symlinks point to tmpfs: `ls -la ~/.openclaw/openclaw.json`
- [ ] `logging.redactSensitive` is set to `"tools"`
- [ ] `gateway.controlUi.enabled` is `false` in production
- [ ] `agents.defaults.sandbox.mode` is `"all"` for production
- [ ] Graceful shutdown re-encrypts (check container logs)
- [ ] Key backup stored in secure location (1Password, Vault, etc.)

---

## Part 8: Multi-Tenant SaaS Adaptations

For the multi-tenant SaaS platform, the secrets layer requires additional considerations:

### 8.1 Per-Company Key Management

Replace Docker secrets with HashiCorp Vault or AWS KMS:

```
┌─────────────────────────────────────────────────────────┐
│                  SaaS Control Plane                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │          Key Management Service (Vault)          │    │
│  │  /secret/companies/acme/age-key                 │    │
│  │  /secret/companies/globex/age-key               │    │
│  │  /secret/companies/initech/age-key              │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│              Per-company containers                      │
│                         ▼                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │    Acme     │ │   Globex    │ │  Initech    │        │
│  │  (fetches   │ │  (fetches   │ │  (fetches   │        │
│  │   own key)  │ │   own key)  │ │   own key)  │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Automatic Key Rotation

Cron job for periodic rotation:
```bash
# Weekly key rotation per company
0 3 * * 0 /scripts/rotate-company-keys.sh --company-id $COMPANY_ID
```

### 8.3 Audit Logging

All decrypt/encrypt operations should be logged:
```json
{
  "timestamp": "2026-02-05T19:30:00Z",
  "company_id": "acme",
  "operation": "decrypt",
  "file": "openclaw.json.enc",
  "result": "success"
}
```

---

## Appendix A: OpenClaw Security Audit Commands

```bash
# Run security audit
openclaw security audit

# Deep audit (includes live probe)
openclaw security audit --deep

# Auto-fix common issues
openclaw security audit --fix

# Explain sandbox configuration
openclaw sandbox explain

# List sandbox containers
openclaw sandbox list
```

---

## Appendix B: Recommended Docker Run (Hardened)

```bash
docker run \
  --read-only \
  --cap-drop=ALL \
  --security-opt=no-new-privileges:true \
  --network=none \
  -v openclaw-data:/app/data:rw \
  -v openclaw-config:/home/node/.openclaw:ro \
  openclaw/openclaw:latest
```

---

## Appendix C: References

- [OpenClaw Security Documentation](https://docs.openclaw.ai/gateway/security)
- [OpenClaw Sandboxing Guide](https://docs.openclaw.ai/gateway/sandboxing)
- [OpenClaw Configuration Reference](https://docs.openclaw.ai/gateway/configuration)
- [CVE-2026-25253 Advisory](https://github.com/openclaw/openclaw/security/advisories/GHSA-g8p2-7wf7-98mq)
- [Cisco Skill Scanner](https://github.com/cisco-ai-defense/skill-scanner)
- [ZDNET: OpenClaw Security Analysis](https://www.zdnet.com/article/openclaw-moltbot-clawdbot-5-reasons-viral-ai-agent-security-nightmare/)
- [The Hacker News: RCE Vulnerability](https://thehackernews.com/2026/02/openclaw-bug-enables-one-click-remote.html)

---

## Appendix D: Secrets Layer File Inventory

Location: `projects/ai-transformation/coding/docker-security/`

| File | Purpose |
|------|---------|
| `Dockerfile.secrets` | Extended Dockerfile with SOPS+age tools |
| `docker-compose.secure-test.yml` | Test environment with tmpfs + Docker secrets |
| `docker-compose.yml` | Base Docker Compose reference |
| `secrets/secrets-entrypoint.sh` | Startup/shutdown wrapper for encrypt/decrypt |
| `secrets/.sops.yaml` | SOPS configuration (encrypted key patterns) |
| `secrets/README.md` | Setup guide and documentation |
| `secrets/scripts/generate-keys.sh` | Generate age keypair |
| `secrets/scripts/encrypt-configs.sh` | Encrypt existing plaintext configs |
| `secrets/scripts/rotate-keys.sh` | Rotate encryption keys |
| `secrets/scripts/verify-setup.sh` | Verify secrets setup is correct |
| `secrets/scripts/decrypt-config.sh` | Manual decrypt for debugging |
| `secrets/keys/age.key` | Private key (NEVER commit to VCS) |
| `secrets/keys/age.pub` | Public key (safe to commit) |

---

**Document Owner:** Security & Architecture Team  
**Last Updated:** 2026-02-05  
**Next Review:** After Phase 2 completion
