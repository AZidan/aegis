#!/bin/bash
# Encrypt existing plaintext configs to .enc files
# Run this ONCE to migrate from plaintext to encrypted configs
#
# Usage: encrypt-configs.sh [DATA_DIR]
#   DATA_DIR - Path to OpenClaw data directory (default: ./clawdbot-data)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS_DIR="$(dirname "$SCRIPT_DIR")"
KEYS_DIR="$SECRETS_DIR/keys"

# Default data directory (can be overridden via argument)
DATA_DIR="${1:-$(dirname "$SECRETS_DIR")/clawdbot-data}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

# Files to encrypt (relative to DATA_DIR)
CONFIG_FILES=(
    "openclaw.json"
    "identity/device-auth.json"
    "agents/main/agent/auth-profiles.json"
    "agents/nadia/agent/auth-profiles.json"
)

# Backup files to encrypt
BACKUP_FILES=(
    "openclaw.json.bak"
    "openclaw.json.bak.1"
    "openclaw.json.bak.2"
    "openclaw.json.bak.3"
    "openclaw.json.bak.4"
)

# Validate prerequisites
validate() {
    log_step "Validating prerequisites..."

    # Check for sops
    if ! command -v sops &> /dev/null; then
        log_error "sops not found. Install with: brew install sops (macOS) or apt install sops (Linux)"
        exit 1
    fi

    # Check for age
    if ! command -v age &> /dev/null; then
        log_error "age not found. Install with: brew install age (macOS) or apt install age (Linux)"
        exit 1
    fi

    # Check for age key
    if [[ ! -f "$KEYS_DIR/age.key" ]]; then
        log_error "Age private key not found at: $KEYS_DIR/age.key"
        log_error "Run: secrets/scripts/generate-keys.sh first"
        exit 1
    fi

    if [[ ! -f "$KEYS_DIR/age.pub" ]]; then
        log_error "Age public key not found at: $KEYS_DIR/age.pub"
        exit 1
    fi

    # Check data directory
    if [[ ! -d "$DATA_DIR" ]]; then
        log_error "Data directory not found: $DATA_DIR"
        exit 1
    fi

    log_info "Prerequisites validated"
}

# Encrypt a single file
encrypt_file() {
    local src_file="$1"
    local enc_file="${src_file}.enc"
    local age_pub=$(cat "$KEYS_DIR/age.pub")

    if [[ ! -f "$src_file" ]]; then
        log_warn "File not found (skipping): $src_file"
        return 0
    fi

    # Check if already encrypted
    if [[ -f "$enc_file" ]]; then
        log_warn "Encrypted file exists (skipping): $enc_file"
        return 0
    fi

    # Validate JSON
    if ! jq empty "$src_file" 2>/dev/null; then
        log_error "Invalid JSON (skipping): $src_file"
        return 1
    fi

    log_info "Encrypting: $(basename "$src_file")"

    # Encrypt with SOPS
    if SOPS_AGE_KEY_FILE="$KEYS_DIR/age.key" sops --encrypt \
            --age "$age_pub" \
            --input-type json --output-type json \
            --encrypted-regex '^(token|key|password|secret|apiKey|botToken|appToken|credential|access|refresh|sessionKey|cookie|privateKey)$' \
            "$src_file" > "$enc_file.tmp"; then

        mv "$enc_file.tmp" "$enc_file"
        chmod 600 "$enc_file"
        log_info "Created: $enc_file"
        return 0
    else
        rm -f "$enc_file.tmp"
        log_error "Failed to encrypt: $src_file"
        return 1
    fi
}

# Shred original plaintext files
shred_originals() {
    local dry_run="${1:-false}"

    log_step "Preparing to remove plaintext files..."

    local files_to_shred=()

    for rel_path in "${CONFIG_FILES[@]}" "${BACKUP_FILES[@]}"; do
        local src_file="$DATA_DIR/$rel_path"
        local enc_file="${src_file}.enc"

        if [[ -f "$src_file" ]] && [[ -f "$enc_file" ]]; then
            files_to_shred+=("$src_file")
        fi
    done

    if [[ ${#files_to_shred[@]} -eq 0 ]]; then
        log_info "No plaintext files to remove"
        return 0
    fi

    echo ""
    log_warn "The following plaintext files will be securely deleted:"
    for f in "${files_to_shred[@]}"; do
        echo "  - $f"
    done
    echo ""

    if [[ "$dry_run" == "true" ]]; then
        log_info "DRY RUN: No files were deleted"
        return 0
    fi

    read -p "Proceed with secure deletion? [y/N] " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warn "Aborted. Plaintext files remain on disk."
        log_warn "Encryption is complete, but you should manually remove plaintext files."
        return 0
    fi

    for f in "${files_to_shred[@]}"; do
        if command -v shred &> /dev/null; then
            shred -u "$f" 2>/dev/null || rm -f "$f"
        else
            # macOS doesn't have shred, use rm -P
            rm -P "$f" 2>/dev/null || rm -f "$f"
        fi
        log_info "Securely deleted: $f"
    done

    log_info "Plaintext files removed"
}

# Main execution
main() {
    echo ""
    echo "======================================"
    echo "  OpenClaw Config Encryption Tool"
    echo "======================================"
    echo ""

    log_info "Data directory: $DATA_DIR"
    echo ""

    # Validate
    validate

    # Encrypt config files
    log_step "Encrypting configuration files..."
    local encrypted=0
    local failed=0

    for rel_path in "${CONFIG_FILES[@]}"; do
        if encrypt_file "$DATA_DIR/$rel_path"; then
            ((encrypted++)) || true
        else
            ((failed++)) || true
        fi
    done

    # Encrypt backup files
    log_step "Encrypting backup files..."

    for rel_path in "${BACKUP_FILES[@]}"; do
        if encrypt_file "$DATA_DIR/$rel_path"; then
            ((encrypted++)) || true
        else
            ((failed++)) || true
        fi
    done

    echo ""
    log_info "Encryption complete: $encrypted files encrypted, $failed failed"

    if [[ $encrypted -gt 0 ]]; then
        # Offer to shred originals
        shred_originals

        echo ""
        log_info "Migration complete!"
        echo ""
        echo "Next steps:"
        echo "  1. Store $KEYS_DIR/age.key in a secure location (1Password, etc.)"
        echo "  2. Create Docker secret: docker secret create openclaw_age_key $KEYS_DIR/age.key"
        echo "  3. Use docker-compose.secure-test.yml to test the setup"
        echo ""
    fi
}

main "$@"
