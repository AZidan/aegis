#!/usr/bin/env bash
# Run Maestro acceptance tests that require admin login
# Usage: ./maestro/acceptance/run-admin-tests.sh [flow-file.yaml]
# If no flow file given, runs the admin login test only
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLOW="${1:-$SCRIPT_DIR/helpers/admin-login.yaml}"

exec ~/.maestro/bin/maestro test "$FLOW"
