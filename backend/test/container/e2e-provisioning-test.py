#!/usr/bin/env python3
"""
E2E Provisioning Test Script

Tests the full tenant provisioning pipeline:
  1. Login as platform admin (with TOTP MFA)
  2. Create a new tenant
  3. Poll provisioning status until active/failed
  4. Verify Docker container is running and healthy
  5. Verify container responds to HTTP requests

Usage:
  python3 test/container/e2e-provisioning-test.py [--base-url http://localhost:3000]

Requires: Python 3.8+, no external dependencies
"""

import argparse
import hashlib
import hmac
import json
import struct
import sys
import time
import base64
import urllib.request
import urllib.error
import subprocess


# ── Config ──────────────────────────────────────────────────────────────
ADMIN_EMAIL = "admin@aegis.ai"
ADMIN_PASSWORD = "Admin12345!@"
MFA_SECRET_B32 = "JBSWY3DPEHPK3PXP"
DEFAULT_BASE_URL = "http://localhost:3000"


def generate_totp(secret_b32: str, period: int = 30) -> str:
    """Generate a TOTP code from a base32-encoded secret."""
    key = base64.b32decode(secret_b32, casefold=True)
    counter = int(time.time()) // period
    msg = struct.pack(">Q", counter)
    h = hmac.new(key, msg, hashlib.sha1).digest()
    offset = h[-1] & 0x0F
    code = (struct.unpack(">I", h[offset : offset + 4])[0] & 0x7FFFFFFF) % 1000000
    return str(code).zfill(6)


def api_call(url: str, method: str = "GET", data=None, token=None):
    """Make an HTTP API call and return parsed JSON."""
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        resp = urllib.request.urlopen(req, timeout=30)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"  HTTP {e.code}: {error_body[:300]}")
        raise


def authenticate(base_url: str) -> str:
    """Login with email/password + TOTP MFA, return access token."""
    print("1. Authenticating as platform admin...")
    api_call(
        f"{base_url}/api/auth/login",
        method="POST",
        data={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )

    totp = generate_totp(MFA_SECRET_B32)
    result = api_call(
        f"{base_url}/api/auth/mfa/verify",
        method="POST",
        data={"email": ADMIN_EMAIL, "totpCode": totp},
    )
    token = result["accessToken"]
    print(f"   Authenticated (token: {token[:20]}...)")
    return token


def create_tenant(base_url: str, token: str, name: str) -> str:
    """Create a new tenant and return its ID."""
    print(f"2. Creating tenant '{name}'...")
    result = api_call(
        f"{base_url}/api/admin/tenants",
        method="POST",
        data={
            "companyName": name,
            "adminEmail": f"admin@{name.lower().replace(' ', '')}.test",
            "plan": "enterprise",
            "resourceLimits": {"cpuCores": 2, "memoryMb": 1024, "diskGb": 10},
        },
        token=token,
    )
    tid = result["id"]
    print(f"   Created tenant: {tid}")
    print(f"   Status: {result.get('status', '?')}")
    return tid


def poll_provisioning(
    base_url: str, token: str, tenant_id: str, timeout_secs: int = 240
) -> dict:
    """Poll tenant status until active/failed or timeout."""
    print("3. Polling provisioning status...")
    interval = 10
    iterations = timeout_secs // interval

    for i in range(iterations):
        time.sleep(interval)
        t = api_call(f"{base_url}/api/admin/tenants/{tenant_id}", token=token)
        status = t.get("status", "?")

        if status == "provisioning":
            step = t.get("provisioningStep", "?")
            progress = t.get("provisioningProgress", 0)
            msg = t.get("provisioningMessage", "")
            print(f"   [{(i+1)*interval:3d}s] step={step} progress={progress}% | {msg}")
        else:
            print(f"   [{(i+1)*interval:3d}s] status={status}")

        if status == "active":
            print("   *** PROVISIONING SUCCEEDED ***")
            return t
        elif status == "failed":
            reason = t.get("provisioningFailedReason", "unknown")
            print(f"   *** PROVISIONING FAILED: {reason} ***")
            return t

    print(f"   *** TIMEOUT after {timeout_secs}s ***")
    return t


def verify_container(tenant: dict) -> bool:
    """Verify the Docker container is running and responds."""
    print("4. Verifying container...")

    container_url = tenant.get("config", {}).get("containerEndpoint", "")
    if not container_url:
        print("   ERROR: No container endpoint in tenant config")
        return False

    print(f"   Container URL: {container_url}")

    # Check Docker container status
    try:
        output = subprocess.check_output(
            ["docker", "ps", "--format", "{{.Names}}\t{{.Status}}"],
            text=True,
            timeout=5,
        )
        tenant_id_prefix = tenant["id"][:8]
        for line in output.strip().split("\n"):
            if tenant_id_prefix in line:
                print(f"   Docker: {line}")
                break
        else:
            print("   WARNING: Container not found in docker ps")
    except Exception as e:
        print(f"   WARNING: Could not check docker: {e}")

    # Check HTTP response
    try:
        req = urllib.request.Request(container_url + "/", method="GET")
        try:
            resp = urllib.request.urlopen(req, timeout=5)
            print(f"   HTTP: {resp.status} (OK)")
        except urllib.error.HTTPError as e:
            # 404/426 is expected for OpenClaw WebSocket gateway
            if e.code in (404, 426):
                print(f"   HTTP: {e.code} (expected for WebSocket gateway)")
                return True
            print(f"   HTTP: {e.code} (unexpected)")
            return False
    except Exception as e:
        print(f"   ERROR: Container not responding: {e}")
        return False

    return True


def verify_health_monitor(base_url: str, token: str, tenant_id: str) -> bool:
    """Verify the health monitor sees the tenant as healthy."""
    print("5. Verifying health monitor status...")
    time.sleep(35)  # Wait for at least one health check cycle (30s)

    t = api_call(f"{base_url}/api/admin/tenants/{tenant_id}", token=token)
    health = t.get("containerHealth", {})
    h_status = health.get("status", "?") if isinstance(health, dict) else "?"
    print(f"   Health status: {h_status}")

    if h_status == "healthy":
        print("   *** HEALTH MONITOR OK ***")
        return True
    else:
        print(f"   WARNING: Health status is {h_status}")
        return False


def main():
    parser = argparse.ArgumentParser(description="E2E Provisioning Test")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--tenant-name", default=f"E2E Test {int(time.time()) % 10000}")
    parser.add_argument("--skip-health-wait", action="store_true")
    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"E2E Provisioning Test")
    print(f"Base URL: {args.base_url}")
    print(f"Tenant:   {args.tenant_name}")
    print(f"{'='*60}\n")

    try:
        token = authenticate(args.base_url)
        tenant_id = create_tenant(args.base_url, token, args.tenant_name)
        tenant = poll_provisioning(args.base_url, token, tenant_id)

        if tenant.get("status") != "active":
            print("\nFAILED: Provisioning did not complete successfully")
            sys.exit(1)

        container_ok = verify_container(tenant)
        if not container_ok:
            print("\nFAILED: Container verification failed")
            sys.exit(1)

        if not args.skip_health_wait:
            health_ok = verify_health_monitor(args.base_url, token, tenant_id)
            if not health_ok:
                print("\nWARNING: Health monitor verification failed (non-fatal)")

        print(f"\n{'='*60}")
        print(f"ALL CHECKS PASSED")
        print(f"Tenant ID:     {tenant_id}")
        print(f"Container URL: {tenant.get('config', {}).get('containerEndpoint', '?')}")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\nFATAL ERROR: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
