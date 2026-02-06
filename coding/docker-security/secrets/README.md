# OpenClaw Secrets Management

Two-layer defense for credential protection:
1. **At-rest encryption** — SOPS + age encrypts all credentials on disk
2. **Runtime isolation** — Credentials live in tmpfs, injected at startup, wiped at shutdown

## Quick Start

### 1. Install Prerequisites

```bash
# macOS
brew install age sops jq

# Linux (Debian/Ubuntu)
apt install age sops jq
```

### 2. Generate Encryption Keys

```bash
./secrets/scripts/generate-keys.sh
```

This creates:
- `secrets/keys/age.key` — Private key (NEVER commit!)
- `secrets/keys/age.pub` — Public key (used in .sops.yaml)

**Back up `age.key` to a secure location (1Password, etc.)**

### 3. Encrypt Existing Configs

```bash
./secrets/scripts/encrypt-configs.sh ./clawdbot-data
```

This encrypts sensitive fields in:
- `openclaw.json`
- `identity/device-auth.json`
- `agents/*/agent/auth-profiles.json`
- `openclaw.json.bak.*`

### 4. Test in Isolated Environment

```bash
# Create test copy of data
cp -r clawdbot-data clawdbot-data-secure-test

# Encrypt the test copy
./secrets/scripts/encrypt-configs.sh ./clawdbot-data-secure-test

# Build and start test container
docker compose -f docker-compose.secure-test.yml up --build
```

Verify in logs:
```
[secrets-manager] Decrypted N configs to tmpfs
```

### 5. Promote to Production

Once validated:

```bash
# Stop production
docker compose down

# Backup production data
cp -r clawdbot-data clawdbot-data-backup-$(date +%Y%m%d)

# Encrypt production configs
./secrets/scripts/encrypt-configs.sh ./clawdbot-data

# Update docker-compose.yml to use Dockerfile.secrets
# (see Production Configuration below)

# Start production
docker compose up --build -d
```

## How It Works

```
Host (encrypted .enc files on disk)
  → Docker startup: decrypt to tmpfs (RAM)
    → Symlink ~/.openclaw/*.json → /run/secrets/*
      → OpenClaw reads/writes normally (unaware of encryption)
        → Shutdown: re-encrypt from tmpfs back to disk
          → Wipe tmpfs
```

### Encrypted Fields

Only sensitive JSON keys are encrypted (the rest stays readable):
- `token`, `key`, `password`, `secret`
- `apiKey`, `botToken`, `appToken`
- `credential`, `access`, `refresh`
- `sessionKey`, `cookie`, `privateKey`

### File Locations

| File | Sensitive Keys |
|------|---------------|
| `openclaw.json` | `channels.telegram.botToken`, `channels.slack.*.botToken`, etc. |
| `auth-profiles.json` | `profiles.*.credential.*` |
| `device-auth.json` | `tokens.operator.token` |

## Production Configuration

Update `docker-compose.yml`:

```yaml
services:
  clawdbot-gateway:
    build:
      context: .
      dockerfile: Dockerfile.secrets
    # ... existing config ...

    tmpfs:
      - /run/secrets/openclaw:size=50M,mode=0700,uid=1000,gid=1000

    environment:
      - OPENCLAW_AGE_KEY_FILE=/run/secrets/age_key
      - OPENCLAW_DATA_DIR=/home/node/.openclaw
      - OPENCLAW_SECRETS_DIR=/run/secrets/openclaw

    secrets:
      - age_key

secrets:
  age_key:
    file: ./secrets/keys/age.key
```

## Key Rotation

When you need to rotate encryption keys:

```bash
./secrets/scripts/rotate-keys.sh ./clawdbot-data
```

This will:
1. Generate new keypair
2. Decrypt all .enc files with old key
3. Re-encrypt with new key
4. Update .sops.yaml

After rotation, update Docker secrets and restart containers.

## Runtime Security (Prompt Injection Defense)

### Defense Layer 1: Path Deny List

Add to `openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "tools": {
        "sandbox": {
          "denyPaths": [
            "~/.openclaw/**",
            "/run/secrets/**"
          ]
        }
      }
    }
  }
}
```

### Defense Layer 2: Output Filtering

The `redact-secrets` hook (in `extensions/redact-secrets/`) scans outgoing messages for credential patterns and replaces them with `[REDACTED]`.

Enable in `openclaw.json`:

```json
{
  "extensions": {
    "redact-secrets": {
      "enabled": true
    }
  }
}
```

### Defense Layer 3: Environment Variable Injection

Instead of storing tokens in JSON:

**Before:**
```json
{ "botToken": "8359489163:AAHxR..." }
```

**After:**
```json
{ "botToken": "${TELEGRAM_BOT_TOKEN}" }
```

Then inject via Docker environment variables (not stored in any file the agent can read).

## Verification

```bash
# On host: encrypted file
cat clawdbot-data/openclaw.json.enc | head -20
# Should show SOPS-encrypted JSON

# On host: no plaintext
ls clawdbot-data/openclaw.json
# Should not exist (only .enc version)

# In container: decrypted (via symlink to tmpfs)
docker exec clawdbot-gateway cat /home/node/.openclaw/openclaw.json
# Should show decrypted JSON

# After shutdown: no plaintext remains
docker compose down
ls clawdbot-data/openclaw.json
# Should not exist
```

## Troubleshooting

### "Age key not found"
Ensure the key file exists and Docker secret is configured:
```bash
ls -la ./secrets/keys/age.key
docker secret ls | grep age
```

### "Failed to decrypt"
The age key might not match the encryption. Check:
```bash
# Verify key matches
cat secrets/keys/age.pub
grep -A1 "age:" secrets/.sops.yaml
```

### Plaintext files remain after migration
The script asks before deleting. Re-run:
```bash
./secrets/scripts/encrypt-configs.sh ./clawdbot-data
```
And answer `y` when prompted to delete plaintext.

## Security Audit Checklist

- [ ] `secrets/keys/age.key` is NOT in version control
- [ ] `.enc` files show encrypted content (not plaintext)
- [ ] No plaintext credential files on disk after migration
- [ ] tmpfs is mounted in container (`mount | grep tmpfs`)
- [ ] Symlinks point to tmpfs (`ls -la ~/.openclaw/openclaw.json`)
- [ ] `redact-secrets` hook is enabled
- [ ] Path deny list is configured
- [ ] Graceful shutdown re-encrypts (check logs)
