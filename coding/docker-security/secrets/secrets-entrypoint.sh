#!/bin/bash
# OpenClaw Secrets Entrypoint
# Handles SOPS decryption on startup and re-encryption on shutdown
#
# Environment variables:
#   OPENCLAW_AGE_KEY_FILE - Path to age private key (default: /run/secrets/age_key)
#   OPENCLAW_DATA_DIR - Path to OpenClaw data directory (default: /home/node/.openclaw)
#   OPENCLAW_SECRETS_DIR - Path to tmpfs secrets mount (default: /run/secrets/openclaw)

set -euo pipefail

# Configuration
AGE_KEY_FILE="${OPENCLAW_AGE_KEY_FILE:-/run/secrets/age_key}"
DATA_DIR="${OPENCLAW_DATA_DIR:-/home/node/.openclaw}"
SECRETS_DIR="${OPENCLAW_SECRETS_DIR:-/run/secrets/openclaw}"
LOG_PREFIX="[secrets-manager]"

# Colors (for TTY output)
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    CYAN='\033[0;36m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' CYAN='' NC=''
fi

log_info() { echo -e "${GREEN}${LOG_PREFIX}${NC} $1"; }
log_warn() { echo -e "${YELLOW}${LOG_PREFIX}${NC} $1"; }
log_error() { echo -e "${RED}${LOG_PREFIX}${NC} $1"; }
log_debug() { [[ "${DEBUG:-}" == "1" ]] && echo -e "${CYAN}${LOG_PREFIX}${NC} $1" || true; }

# Track decryption state for cleanup
DECRYPTED_FILES=()
SYMLINKS_CREATED=()
TMPFS_MOUNTED=0
# Files that had credential extraction (don't re-encrypt - they have placeholders in tmpfs)
CREDENTIAL_EXTRACTED_FILES=()

# Files to encrypt/decrypt (relative to DATA_DIR)
# Agent auth-profiles are auto-discovered, so only core files needed here
CONFIG_FILES=(
    "openclaw.json"
    "identity/device-auth.json"
)

# Backup files (relative to DATA_DIR)
BACKUP_FILES=(
    "openclaw.json.bak"
    "openclaw.json.bak.1"
    "openclaw.json.bak.2"
    "openclaw.json.bak.3"
    "openclaw.json.bak.4"
)

# Cleanup handler for graceful shutdown
cleanup() {
    local exit_code=$?
    log_info "Shutdown signal received, re-encrypting secrets..."

    # Re-encrypt all files (except those with credential extraction - they have placeholders)
    for file in "${DECRYPTED_FILES[@]}"; do
        # Skip files that had credential extraction (tmpfs has placeholders, not real values)
        local skip=0
        for extracted in "${CREDENTIAL_EXTRACTED_FILES[@]}"; do
            if [[ "$file" == "$extracted" ]]; then
                log_info "Skipping re-encryption of $(basename "$file") (credential extraction - original .enc preserved)"
                skip=1
                break
            fi
        done
        [[ $skip -eq 1 ]] && continue

        local enc_file="${file}.enc"
        local src_file="$SECRETS_DIR/$(basename "$file")"

        if [[ -f "$src_file" ]]; then
            log_debug "Re-encrypting: $file"
            if sops --encrypt --age "$(cat "${AGE_KEY_FILE}.pub" 2>/dev/null || get_public_key)" \
                    --input-type json --output-type json \
                    "$src_file" > "${enc_file}.tmp" 2>/dev/null; then
                mv "${enc_file}.tmp" "${enc_file}"
                log_info "Re-encrypted: $(basename "$enc_file")"
            else
                log_warn "Failed to re-encrypt: $file (keeping existing .enc)"
            fi
        fi
    done

    # Remove symlinks
    for link in "${SYMLINKS_CREATED[@]}"; do
        if [[ -L "$link" ]]; then
            rm -f "$link"
            log_debug "Removed symlink: $link"
        fi
    done

    # Unmount and remove tmpfs
    if [[ $TMPFS_MOUNTED -eq 1 ]]; then
        # Sync to ensure all data is written
        sync

        # Wipe sensitive data before unmounting
        if [[ -d "$SECRETS_DIR" ]]; then
            find "$SECRETS_DIR" -type f -exec shred -u {} \; 2>/dev/null || true
        fi

        # Unmount tmpfs
        if mountpoint -q "$SECRETS_DIR" 2>/dev/null; then
            umount "$SECRETS_DIR" 2>/dev/null || true
            log_info "Unmounted tmpfs at $SECRETS_DIR"
        fi

        rmdir "$SECRETS_DIR" 2>/dev/null || true
    fi

    log_info "Cleanup complete"
    exit $exit_code
}

# Extract public key from private key
get_public_key() {
    if [[ -f "$AGE_KEY_FILE" ]]; then
        grep -o 'age1[a-z0-9]*' "$AGE_KEY_FILE" | head -1
    else
        echo ""
    fi
}

# Setup tmpfs mount
setup_tmpfs() {
    log_info "Setting up tmpfs at $SECRETS_DIR..."

    # Create mount point
    mkdir -p "$SECRETS_DIR"

    # Mount tmpfs with restrictive permissions (50MB max)
    if command -v mount &> /dev/null && [[ $EUID -eq 0 ]]; then
        mount -t tmpfs -o size=50M,mode=0700 tmpfs "$SECRETS_DIR"
        TMPFS_MOUNTED=1
        log_info "Mounted tmpfs (50MB) at $SECRETS_DIR"
    else
        # Fallback: just create directory with restrictive perms
        # Docker compose will handle tmpfs mount
        chmod 700 "$SECRETS_DIR"
        log_warn "Running as non-root, relying on Docker tmpfs mount"
    fi
}

# Decrypt a single file
decrypt_file() {
    local src_file="$1"  # Full path to .enc file
    local dest_file="$2" # Full path in tmpfs
    local original="$3"  # Original path for symlink

    if [[ ! -f "$src_file" ]]; then
        log_debug "No encrypted file: $src_file"
        return 0
    fi

    log_debug "Decrypting: $src_file -> $dest_file"

    # Create parent directory in tmpfs if needed
    mkdir -p "$(dirname "$dest_file")"

    # Decrypt using SOPS + age
    if SOPS_AGE_KEY_FILE="$AGE_KEY_FILE" sops --decrypt \
            --input-type json --output-type json \
            "$src_file" > "$dest_file" 2>/dev/null; then

        chmod 600 "$dest_file"
        DECRYPTED_FILES+=("${original}")

        # Create symlink from original location to tmpfs
        local original_dir=$(dirname "$original")
        mkdir -p "$original_dir"

        # Remove existing file/link if present
        if [[ -e "$original" ]] || [[ -L "$original" ]]; then
            rm -f "$original"
        fi

        ln -sf "$dest_file" "$original"
        SYMLINKS_CREATED+=("$original")

        log_info "Decrypted and linked: $(basename "$src_file" .enc)"
        return 0
    else
        log_error "Failed to decrypt: $src_file"
        return 1
    fi
}

# Auto-discover agent auth-profiles
discover_agent_configs() {
    if [[ -d "$DATA_DIR/agents" ]]; then
        find "$DATA_DIR/agents" -path "*/agent/auth-profiles.json.enc" -type f 2>/dev/null | \
            sed "s|$DATA_DIR/||" | sed 's|\.enc$||' || true
    fi
}

# Decrypt all config files
decrypt_all() {
    local count=0

    # Main config files
    for rel_path in "${CONFIG_FILES[@]}"; do
        local enc_file="$DATA_DIR/${rel_path}.enc"
        local dest_file="$SECRETS_DIR/$(basename "$rel_path")"
        local original="$DATA_DIR/$rel_path"

        if decrypt_file "$enc_file" "$dest_file" "$original"; then
            ((count++)) || true
        fi
    done

    # Auto-discovered agent auth-profiles
    while IFS= read -r rel_path; do
        [[ -z "$rel_path" ]] && continue
        local enc_file="$DATA_DIR/${rel_path}.enc"
        local dest_file="$SECRETS_DIR/$(basename "$rel_path")"
        local original="$DATA_DIR/$rel_path"

        if decrypt_file "$enc_file" "$dest_file" "$original"; then
            ((count++)) || true
        fi
    done < <(discover_agent_configs)

    # Backup files
    for rel_path in "${BACKUP_FILES[@]}"; do
        local enc_file="$DATA_DIR/${rel_path}.enc"
        local dest_file="$SECRETS_DIR/$(basename "$rel_path")"
        local original="$DATA_DIR/$rel_path"

        if decrypt_file "$enc_file" "$dest_file" "$original"; then
            ((count++)) || true
        fi
    done

    log_info "Decrypted $count configs to tmpfs"
}

# Validate environment
validate_env() {
    # Check for age key
    if [[ ! -f "$AGE_KEY_FILE" ]]; then
        log_error "Age key not found at: $AGE_KEY_FILE"
        log_error "Ensure Docker secret 'openclaw_age_key' is configured"
        return 1
    fi

    # Check for sops
    if ! command -v sops &> /dev/null; then
        log_error "sops not found in PATH"
        return 1
    fi

    # Check data directory
    if [[ ! -d "$DATA_DIR" ]]; then
        log_warn "Data directory not found: $DATA_DIR (will be created)"
        mkdir -p "$DATA_DIR"
    fi

    log_debug "Environment validated"
    return 0
}

# Check if encryption is set up
is_encryption_enabled() {
    # Look for any .enc files
    local enc_count=$(find "$DATA_DIR" -maxdepth 3 -name "*.enc" -type f 2>/dev/null | wc -l)
    [[ $enc_count -gt 0 ]]
}

# Extract credentials from decrypted config to environment variables
# and replace credential values with ${VAR} placeholders
extract_credentials_to_env() {
    log_info "Extracting credentials to environment variables..."

    local config_file="$SECRETS_DIR/openclaw.json"

    if [[ ! -f "$config_file" ]]; then
        log_warn "Config file not found in tmpfs, skipping credential extraction"
        return 0
    fi

    # Check for jq
    if ! command -v jq &> /dev/null; then
        log_warn "jq not found, skipping credential extraction"
        return 0
    fi

    local count=0

    # Credential mappings: JSON path -> ENV var name
    declare -A CRED_MAP=(
        # Top-level channel tokens (legacy/simple config)
        [".channels.telegram.botToken"]="TELEGRAM_BOT_TOKEN"
        [".channels.slack.botToken"]="SLACK_BOT_TOKEN"
        [".channels.slack.appToken"]="SLACK_APP_TOKEN"
        [".channels.discord.botToken"]="DISCORD_BOT_TOKEN"
        # Gateway auth
        [".gateway.auth.token"]="GATEWAY_AUTH_TOKEN"
    )

    # Process each credential from static map
    for json_path in "${!CRED_MAP[@]}"; do
        local env_name="${CRED_MAP[$json_path]}"
        local value=$(jq -r "$json_path // empty" "$config_file" 2>/dev/null || true)

        # Skip if empty, null, or already a placeholder
        if [[ -z "$value" ]] || [[ "$value" == "null" ]] || [[ "$value" =~ ^\$\{ ]]; then
            continue
        fi

        # Export the credential
        export "$env_name=$value"
        log_debug "Exported: $env_name"

        # Replace in config with placeholder
        local placeholder="\${$env_name}"
        local tmp_file="${config_file}.tmp"
        if jq "$json_path = \"$placeholder\"" "$config_file" > "$tmp_file" 2>/dev/null; then
            mv "$tmp_file" "$config_file"
            log_debug "Replaced: $json_path → $placeholder"
            ((count++)) || true
        else
            rm -f "$tmp_file"
        fi
    done

    # Auto-discover channel account credentials (for any channel with accounts)
    for channel in telegram slack discord; do
        local accounts=$(jq -r ".channels.$channel.accounts // {} | keys[]" "$config_file" 2>/dev/null || true)
        for account in $accounts; do
            # Bot token
            local json_path=".channels.$channel.accounts.$account.botToken"
            local env_name="${channel^^}_${account^^}_BOT_TOKEN"
            local value=$(jq -r "$json_path // empty" "$config_file" 2>/dev/null || true)

            if [[ -n "$value" ]] && [[ "$value" != "null" ]] && [[ ! "$value" =~ ^\$\{ ]]; then
                export "$env_name=$value"
                log_debug "Exported: $env_name"

                local placeholder="\${$env_name}"
                local tmp_file="${config_file}.tmp"
                if jq "$json_path = \"$placeholder\"" "$config_file" > "$tmp_file" 2>/dev/null; then
                    mv "$tmp_file" "$config_file"
                    log_debug "Replaced: $json_path → $placeholder"
                    ((count++)) || true
                else
                    rm -f "$tmp_file"
                fi
            fi

            # App token (Slack)
            json_path=".channels.$channel.accounts.$account.appToken"
            env_name="${channel^^}_${account^^}_APP_TOKEN"
            value=$(jq -r "$json_path // empty" "$config_file" 2>/dev/null || true)

            if [[ -n "$value" ]] && [[ "$value" != "null" ]] && [[ ! "$value" =~ ^\$\{ ]]; then
                export "$env_name=$value"
                log_debug "Exported: $env_name"

                local placeholder="\${$env_name}"
                local tmp_file="${config_file}.tmp"
                if jq "$json_path = \"$placeholder\"" "$config_file" > "$tmp_file" 2>/dev/null; then
                    mv "$tmp_file" "$config_file"
                    log_debug "Replaced: $json_path → $placeholder"
                    ((count++)) || true
                else
                    rm -f "$tmp_file"
                fi
            fi
        done
    done

    # Also extract skill API keys dynamically
    local skills=$(jq -r '.skills.entries // {} | to_entries[] | select(.value.apiKey != null) | .key' "$config_file" 2>/dev/null || true)
    for skill in $skills; do
        local env_name="SKILL_$(echo "$skill" | tr '[:lower:]-' '[:upper:]_')_API_KEY"
        local json_path=".skills.entries[\"$skill\"].apiKey"
        local value=$(jq -r "$json_path // empty" "$config_file" 2>/dev/null || true)

        if [[ -n "$value" ]] && [[ "$value" != "null" ]] && [[ ! "$value" =~ ^\$\{ ]]; then
            export "$env_name=$value"
            log_debug "Exported: $env_name"

            local placeholder="\${$env_name}"
            local tmp_file="${config_file}.tmp"
            if jq "$json_path = \"$placeholder\"" "$config_file" > "$tmp_file" 2>/dev/null; then
                mv "$tmp_file" "$config_file"
                log_debug "Replaced: $json_path → $placeholder"
                ((count++)) || true
            else
                rm -f "$tmp_file"
            fi
        fi
    done

    # Mark this file as having credential extraction (don't re-encrypt, keep original .enc)
    CREDENTIAL_EXTRACTED_FILES+=("$DATA_DIR/openclaw.json")

    log_info "Extracted $count credentials to environment variables"
}

# Main execution
main() {
    log_info "Starting OpenClaw with secrets management..."

    # Validate environment
    if ! validate_env; then
        log_error "Environment validation failed"
        exit 1
    fi

    # Check if encryption is enabled
    if ! is_encryption_enabled; then
        log_warn "No .enc files found - running without secrets layer"
        log_warn "Run 'secrets/scripts/encrypt-configs.sh' to enable encryption"
        exec "$@"
    fi

    # Setup tmpfs
    setup_tmpfs

    # Decrypt all configs
    decrypt_all

    # Extract credentials to env vars and replace with placeholders (Layer 2)
    if [[ "${OPENCLAW_ENV_VAR_INJECTION:-1}" == "1" ]]; then
        extract_credentials_to_env
    fi

    log_info "Secrets ready, starting OpenClaw gateway..."

    # Debug: Show exported env vars count
    local cred_count=$(env | grep -cE "^(TELEGRAM|SLACK|DISCORD|GATEWAY|SKILL)_" || echo "0")
    log_info "Verified $cred_count credential env vars are set"

    # Run command in background and wait (so traps work)
    "$@" &
    CHILD_PID=$!

    # Register cleanup handler AFTER starting child
    trap 'cleanup; kill $CHILD_PID 2>/dev/null; wait $CHILD_PID 2>/dev/null' SIGTERM SIGINT

    # Wait for child process
    wait $CHILD_PID
    EXIT_CODE=$?

    # Run cleanup on normal exit too
    cleanup
    exit $EXIT_CODE
}

# Run main with all arguments
main "$@"
