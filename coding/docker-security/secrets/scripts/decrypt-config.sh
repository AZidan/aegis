#!/bin/bash
# Decrypt a .enc file for manual inspection (temporary)
# The decrypted output is sent to stdout (not saved to disk)
#
# Usage: decrypt-config.sh <encrypted-file.enc>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS_DIR="$(dirname "$SCRIPT_DIR")"
KEYS_DIR="$SECRETS_DIR/keys"

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <encrypted-file.enc>"
    echo ""
    echo "Example: $0 ./clawdbot-data/openclaw.json.enc"
    exit 1
fi

ENC_FILE="$1"

if [[ ! -f "$ENC_FILE" ]]; then
    echo "Error: File not found: $ENC_FILE"
    exit 1
fi

if [[ ! -f "$KEYS_DIR/age.key" ]]; then
    echo "Error: Age key not found at: $KEYS_DIR/age.key"
    echo "Run: secrets/scripts/generate-keys.sh first"
    exit 1
fi

# Decrypt to stdout
SOPS_AGE_KEY_FILE="$KEYS_DIR/age.key" sops --decrypt \
    --input-type json --output-type json \
    "$ENC_FILE"
