#!/bin/bash
# Generate age keypair for SOPS encryption
# Run this ONCE during initial setup

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS_DIR="$(dirname "$SCRIPT_DIR")"
KEYS_DIR="$SECRETS_DIR/keys"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if age is installed
if ! command -v age-keygen &> /dev/null; then
    log_error "age-keygen not found. Install with: brew install age (macOS) or apt install age (Linux)"
    exit 1
fi

# Check for existing keys
if [[ -f "$KEYS_DIR/age.key" ]]; then
    log_warn "Private key already exists at $KEYS_DIR/age.key"
    log_warn "To regenerate, first run: secrets/scripts/rotate-keys.sh"
    exit 1
fi

# Generate keypair
log_info "Generating age keypair..."
mkdir -p "$KEYS_DIR"

# Generate key and extract public key
age-keygen -o "$KEYS_DIR/age.key" 2>&1 | grep "public key" | cut -d: -f2 | tr -d ' ' > "$KEYS_DIR/age.pub"

# Set restrictive permissions
chmod 600 "$KEYS_DIR/age.key"
chmod 644 "$KEYS_DIR/age.pub"

# Read the public key
AGE_PUB=$(cat "$KEYS_DIR/age.pub")

log_info "Keys generated successfully!"
log_info "Private key: $KEYS_DIR/age.key (KEEP SECRET!)"
log_info "Public key: $AGE_PUB"

# Update .sops.yaml with the public key
SOPS_CONFIG="$SECRETS_DIR/.sops.yaml"
if [[ -f "$SOPS_CONFIG" ]]; then
    log_info "Updating .sops.yaml with public key..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/AGE_PUBLIC_KEY_PLACEHOLDER/$AGE_PUB/" "$SOPS_CONFIG"
    else
        sed -i "s/AGE_PUBLIC_KEY_PLACEHOLDER/$AGE_PUB/" "$SOPS_CONFIG"
    fi
    log_info ".sops.yaml updated!"
fi

echo ""
log_info "Next steps:"
echo "  1. Back up $KEYS_DIR/age.key to a secure location (password manager, etc.)"
echo "  2. Add the key to Docker secrets: docker secret create openclaw_age_key $KEYS_DIR/age.key"
echo "  3. Run: secrets/scripts/encrypt-configs.sh to encrypt existing configs"
echo ""
log_warn "NEVER commit age.key to version control!"
