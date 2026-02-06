#!/bin/bash
# Rotate age encryption keys
# Generates a new keypair and re-encrypts all .enc files
#
# Usage: rotate-keys.sh [DATA_DIR]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS_DIR="$(dirname "$SCRIPT_DIR")"
KEYS_DIR="$SECRETS_DIR/keys"

# Default data directory
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

# Validate prerequisites
validate() {
    log_step "Validating prerequisites..."

    if ! command -v sops &> /dev/null; then
        log_error "sops not found. Install with: brew install sops"
        exit 1
    fi

    if ! command -v age-keygen &> /dev/null; then
        log_error "age-keygen not found. Install with: brew install age"
        exit 1
    fi

    if [[ ! -f "$KEYS_DIR/age.key" ]]; then
        log_error "Current age key not found at: $KEYS_DIR/age.key"
        log_error "Run: secrets/scripts/generate-keys.sh first"
        exit 1
    fi

    if [[ ! -d "$DATA_DIR" ]]; then
        log_error "Data directory not found: $DATA_DIR"
        exit 1
    fi
}

main() {
    echo ""
    echo "======================================"
    echo "  OpenClaw Key Rotation Tool"
    echo "======================================"
    echo ""

    validate

    # Find all .enc files
    local enc_files=()
    while IFS= read -r -d '' file; do
        enc_files+=("$file")
    done < <(find "$DATA_DIR" -name "*.enc" -type f -print0 2>/dev/null)

    if [[ ${#enc_files[@]} -eq 0 ]]; then
        log_error "No .enc files found in $DATA_DIR"
        exit 1
    fi

    log_info "Found ${#enc_files[@]} encrypted files to rotate"
    echo ""

    # Confirm
    log_warn "This will:"
    echo "  1. Generate a new age keypair"
    echo "  2. Decrypt all .enc files with the OLD key"
    echo "  3. Re-encrypt them with the NEW key"
    echo "  4. Update .sops.yaml with the new public key"
    echo ""

    read -p "Proceed with key rotation? [y/N] " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warn "Aborted"
        exit 0
    fi

    # Backup old key
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local old_key_backup="$KEYS_DIR/age.key.backup.$timestamp"

    log_step "Backing up old key to: $old_key_backup"
    cp "$KEYS_DIR/age.key" "$old_key_backup"
    chmod 600 "$old_key_backup"

    # Store old key path for decryption
    local old_key="$old_key_backup"
    local old_pub=$(cat "$KEYS_DIR/age.pub")

    # Generate new key
    log_step "Generating new age keypair..."
    age-keygen -o "$KEYS_DIR/age.key.new" 2>&1 | grep "public key" | cut -d: -f2 | tr -d ' ' > "$KEYS_DIR/age.pub.new"
    chmod 600 "$KEYS_DIR/age.key.new"

    local new_pub=$(cat "$KEYS_DIR/age.pub.new")
    log_info "New public key: $new_pub"

    # Re-encrypt each file
    log_step "Re-encrypting files..."
    local success=0
    local failed=0

    for enc_file in "${enc_files[@]}"; do
        local tmp_file="${enc_file}.tmp"
        local decrypted_file="${enc_file}.decrypted"

        log_info "Rotating: $(basename "$enc_file")"

        # Decrypt with old key
        if ! SOPS_AGE_KEY_FILE="$old_key" sops --decrypt \
                --input-type json --output-type json \
                "$enc_file" > "$decrypted_file" 2>/dev/null; then
            log_error "Failed to decrypt: $enc_file"
            rm -f "$decrypted_file"
            ((failed++)) || true
            continue
        fi

        # Re-encrypt with new key
        if SOPS_AGE_KEY_FILE="$KEYS_DIR/age.key.new" sops --encrypt \
                --age "$new_pub" \
                --input-type json --output-type json \
                --encrypted-regex '^(token|key|password|secret|apiKey|botToken|appToken|credential|access|refresh|sessionKey|cookie|privateKey)$' \
                "$decrypted_file" > "$tmp_file" 2>/dev/null; then

            # Replace old encrypted file
            mv "$tmp_file" "$enc_file"
            ((success++)) || true
        else
            log_error "Failed to re-encrypt: $enc_file"
            rm -f "$tmp_file"
            ((failed++)) || true
        fi

        # Securely delete decrypted temp file
        if command -v shred &> /dev/null; then
            shred -u "$decrypted_file" 2>/dev/null || rm -f "$decrypted_file"
        else
            rm -P "$decrypted_file" 2>/dev/null || rm -f "$decrypted_file"
        fi
    done

    echo ""
    log_info "Rotated: $success files, Failed: $failed files"

    if [[ $failed -gt 0 ]]; then
        log_error "Some files failed to rotate. Old key preserved at: $old_key_backup"
        exit 1
    fi

    # Swap in new keys
    log_step "Installing new keys..."
    mv "$KEYS_DIR/age.key" "$KEYS_DIR/age.key.old"
    mv "$KEYS_DIR/age.key.new" "$KEYS_DIR/age.key"
    mv "$KEYS_DIR/age.pub" "$KEYS_DIR/age.pub.old"
    mv "$KEYS_DIR/age.pub.new" "$KEYS_DIR/age.pub"

    # Update .sops.yaml
    local sops_config="$SECRETS_DIR/.sops.yaml"
    if [[ -f "$sops_config" ]]; then
        log_step "Updating .sops.yaml with new public key..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/$old_pub/$new_pub/" "$sops_config"
        else
            sed -i "s/$old_pub/$new_pub/" "$sops_config"
        fi
    fi

    echo ""
    log_info "Key rotation complete!"
    echo ""
    echo "Important:"
    echo "  1. Update Docker secret with new key:"
    echo "     docker secret rm openclaw_age_key"
    echo "     docker secret create openclaw_age_key $KEYS_DIR/age.key"
    echo "  2. Restart the container to use new keys"
    echo "  3. Verify everything works, then delete old keys:"
    echo "     rm $KEYS_DIR/age.key.old $KEYS_DIR/age.pub.old"
    echo "     rm $old_key_backup"
    echo ""
}

main "$@"
