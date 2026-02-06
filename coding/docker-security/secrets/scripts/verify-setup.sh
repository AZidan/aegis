#!/bin/bash
# Verify secrets management setup
# Run this after encryption to validate everything is configured correctly

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$SECRETS_DIR")"
KEYS_DIR="$SECRETS_DIR/keys"

DATA_DIR="${1:-$PROJECT_DIR/clawdbot-data}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS="${GREEN}[PASS]${NC}"
FAIL="${RED}[FAIL]${NC}"
WARN="${YELLOW}[WARN]${NC}"

errors=0
warnings=0

check() {
    local desc="$1"
    local result="$2"

    if [[ "$result" == "pass" ]]; then
        echo -e "$PASS $desc"
    elif [[ "$result" == "warn" ]]; then
        echo -e "$WARN $desc"
        ((warnings++)) || true
    else
        echo -e "$FAIL $desc"
        ((errors++)) || true
    fi
}

echo ""
echo "======================================"
echo "  OpenClaw Secrets Verification"
echo "======================================"
echo ""
echo "Data directory: $DATA_DIR"
echo ""

# Check prerequisites
echo "--- Prerequisites ---"

if command -v sops &> /dev/null; then
    check "sops installed" "pass"
else
    check "sops installed" "fail"
fi

if command -v age &> /dev/null; then
    check "age installed" "pass"
else
    check "age installed" "fail"
fi

if command -v jq &> /dev/null; then
    check "jq installed" "pass"
else
    check "jq installed" "warn"
fi

echo ""

# Check keys
echo "--- Encryption Keys ---"

if [[ -f "$KEYS_DIR/age.key" ]]; then
    check "Private key exists" "pass"

    # Check permissions
    perms=$(stat -f "%Lp" "$KEYS_DIR/age.key" 2>/dev/null || stat -c "%a" "$KEYS_DIR/age.key" 2>/dev/null)
    if [[ "$perms" == "600" ]]; then
        check "Private key permissions (600)" "pass"
    else
        check "Private key permissions (is $perms, should be 600)" "warn"
    fi
else
    check "Private key exists ($KEYS_DIR/age.key)" "fail"
fi

if [[ -f "$KEYS_DIR/age.pub" ]]; then
    check "Public key exists" "pass"
else
    check "Public key exists ($KEYS_DIR/age.pub)" "fail"
fi

echo ""

# Check .sops.yaml
echo "--- SOPS Configuration ---"

if [[ -f "$SECRETS_DIR/.sops.yaml" ]]; then
    check ".sops.yaml exists" "pass"

    if grep -q "AGE_PUBLIC_KEY_PLACEHOLDER" "$SECRETS_DIR/.sops.yaml"; then
        check ".sops.yaml has public key configured" "fail (still has placeholder)"
    else
        check ".sops.yaml has public key configured" "pass"
    fi
else
    check ".sops.yaml exists" "fail"
fi

echo ""

# Check encrypted files
echo "--- Encrypted Files ---"

enc_count=0
while IFS= read -r -d '' file; do
    ((enc_count++)) || true
done < <(find "$DATA_DIR" -maxdepth 3 -name "*.enc" -type f -print0 2>/dev/null)

if [[ $enc_count -gt 0 ]]; then
    check "Found $enc_count encrypted file(s)" "pass"
else
    check "Found encrypted files" "fail (none found)"
fi

# Check specific files
for file in "openclaw.json" "identity/device-auth.json"; do
    enc_file="$DATA_DIR/${file}.enc"
    plain_file="$DATA_DIR/$file"

    if [[ -f "$enc_file" ]]; then
        check "$file.enc exists" "pass"
    else
        check "$file.enc exists" "warn"
    fi

    if [[ -f "$plain_file" ]]; then
        check "$file plaintext removed" "fail (still exists!)"
    else
        check "$file plaintext removed" "pass"
    fi
done

echo ""

# Check git ignore
echo "--- Git Configuration ---"

if [[ -f "$SECRETS_DIR/.gitignore" ]]; then
    if grep -q "age.key" "$SECRETS_DIR/.gitignore"; then
        check "age.key in .gitignore" "pass"
    else
        check "age.key in .gitignore" "fail"
    fi
else
    check ".gitignore exists" "fail"
fi

# Check if age.key is tracked by git
if git -C "$SECRETS_DIR" ls-files --error-unmatch "keys/age.key" &> /dev/null; then
    check "age.key NOT tracked by git" "fail (SECURITY RISK!)"
else
    check "age.key NOT tracked by git" "pass"
fi

echo ""

# Check Docker files
echo "--- Docker Configuration ---"

if [[ -f "$PROJECT_DIR/Dockerfile.secrets" ]]; then
    check "Dockerfile.secrets exists" "pass"
else
    check "Dockerfile.secrets exists" "fail"
fi

if [[ -f "$PROJECT_DIR/docker-compose.secure-test.yml" ]]; then
    check "docker-compose.secure-test.yml exists" "pass"
else
    check "docker-compose.secure-test.yml exists" "fail"
fi

echo ""

# Check redact-secrets extension
echo "--- Runtime Protection ---"

if [[ -f "$DATA_DIR/extensions/redact-secrets/index.ts" ]]; then
    check "redact-secrets hook installed" "pass"
else
    check "redact-secrets hook installed" "warn (optional but recommended)"
fi

echo ""

# Summary
echo "======================================"
echo "  Summary"
echo "======================================"
echo ""

if [[ $errors -eq 0 ]] && [[ $warnings -eq 0 ]]; then
    echo -e "${GREEN}All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Test with: docker compose -f docker-compose.secure-test.yml up --build"
    echo "  2. Verify logs show: [secrets-manager] Decrypted N configs"
    echo ""
elif [[ $errors -eq 0 ]]; then
    echo -e "${YELLOW}Setup complete with $warnings warning(s)${NC}"
    echo ""
else
    echo -e "${RED}Setup incomplete: $errors error(s), $warnings warning(s)${NC}"
    echo ""
    echo "Fix the errors above before proceeding."
    echo ""
    exit 1
fi
