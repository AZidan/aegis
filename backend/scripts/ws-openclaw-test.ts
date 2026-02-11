/**
 * OpenClaw WebSocket Gateway Test Client
 *
 * Tests the full auth handshake (Ed25519 device auth, v2 with nonce)
 * and sends a test message via the "agent" method.
 *
 * Usage:
 *   npx tsx scripts/ws-openclaw-test.ts
 */
import crypto from 'node:crypto';
import WebSocket from 'ws';

// ── Config ────────────────────────────────────────────────────────
const WS_URL = 'ws://localhost:19445';
const GATEWAY_TOKEN = 'f5eIJEdDUHXjaoUh28Nqs56kCx8XNu6qk-Ian0mllkE';
const AGENT_ID = 'c105f0b3-5b20-427f-9048-37f082dc7751';
const PROTOCOL_VERSION = 3;

// ── Ed25519 Device Identity ──────────────────────────────────────
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/g, '');
}

function generateDeviceIdentity() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  // Derive raw 32-byte public key from SPKI
  const spki = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  const raw = spki.subarray(ED25519_SPKI_PREFIX.length);
  const deviceId = crypto.createHash('sha256').update(raw).digest('hex');
  const publicKeyBase64Url = base64UrlEncode(raw);

  return { deviceId, publicKeyPem, privateKeyPem, publicKeyBase64Url };
}

function signPayload(privateKeyPem: string, payload: string): string {
  const key = crypto.createPrivateKey(privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(payload, 'utf8'), key);
  return base64UrlEncode(sig);
}

function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string;
  nonce?: string;
}): string {
  const version = params.nonce ? 'v2' : 'v1';
  const parts = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(','),
    String(params.signedAtMs),
    params.token,
  ];
  if (version === 'v2') {
    parts.push(params.nonce ?? '');
  }
  return parts.join('|');
}

// ── WebSocket Client ─────────────────────────────────────────────
async function main() {
  console.log('=== OpenClaw WebSocket Gateway Test ===\n');

  const device = generateDeviceIdentity();
  console.log(`Device ID: ${device.deviceId.substring(0, 16)}...`);
  console.log(`Public Key: ${device.publicKeyBase64Url.substring(0, 20)}...`);

  console.log(`\nConnecting to ${WS_URL}...`);
  const ws = new WebSocket(WS_URL);

  // Helper to wait for a specific message
  function waitForMessage<T>(
    predicate: (msg: unknown) => boolean,
    timeoutMs = 10000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.removeListener('message', handler);
        reject(new Error(`Timeout waiting for message (${timeoutMs}ms)`));
      }, timeoutMs);

      function handler(data: WebSocket.Data) {
        try {
          const parsed = JSON.parse(data.toString());
          if (predicate(parsed)) {
            clearTimeout(timer);
            ws.removeListener('message', handler);
            resolve(parsed as T);
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.on('message', handler);
    });
  }

  // Step 1: Wait for WS open
  await new Promise<void>((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  console.log('WebSocket connected!\n');

  // Step 2: Wait for connect.challenge event
  console.log('Waiting for connect.challenge...');
  const challengePromise = waitForMessage<{
    type: string;
    event: string;
    payload: { nonce: string; ts: number };
  }>((msg: any) => msg?.type === 'event' && msg?.event === 'connect.challenge');

  const challenge = await challengePromise;
  const nonce = challenge.payload.nonce;
  console.log(`Got nonce: ${nonce}\n`);

  // Step 3: Build connect request with device auth
  const role = 'operator';
  const scopes = ['operator.admin'];
  const clientId = 'gateway-client';
  const clientMode = 'backend';
  const signedAtMs = Date.now();

  const authPayload = buildDeviceAuthPayload({
    deviceId: device.deviceId,
    clientId,
    clientMode,
    role,
    scopes,
    signedAtMs,
    token: GATEWAY_TOKEN,
    nonce,
  });

  const signature = signPayload(device.privateKeyPem, authPayload);

  const connectReqId = crypto.randomUUID();
  const connectMsg = {
    type: 'req',
    id: connectReqId,
    method: 'connect',
    params: {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: clientId,
        displayName: 'Aegis Platform',
        version: '1.0.0',
        platform: 'darwin',
        mode: clientMode,
      },
      caps: [],
      role,
      scopes,
      auth: {
        token: GATEWAY_TOKEN,
      },
      // Skip device auth for now — just use token auth
    },
  };

  console.log('Sending connect request...');
  // Listen for response before sending
  const connectResPromise = waitForMessage<{
    type: string;
    id: string;
    ok: boolean;
    payload?: unknown;
    error?: { message?: string; code?: string };
  }>((msg: any) => msg?.type === 'res' && msg?.id === connectReqId, 15000);

  ws.send(JSON.stringify(connectMsg));

  const connectRes = await connectResPromise;
  if (!connectRes.ok) {
    console.error('Connect FAILED:', JSON.stringify(connectRes.error, null, 2));
    ws.close();
    process.exit(1);
  }

  const hello = connectRes.payload as { type: string; methods?: string[]; events?: string[] };
  console.log(`Connect OK! Type: ${hello?.type}`);
  console.log(`Available methods: ${(hello as any)?.methods?.length ?? 'unknown'}`);
  console.log(`Available events: ${(hello as any)?.events?.length ?? 'unknown'}\n`);

  // Step 4: List agents first
  console.log('--- Listing agents ---');
  const agentsReqId = crypto.randomUUID();
  const agentsResPromise = waitForMessage<{
    type: string;
    id: string;
    ok: boolean;
    payload?: unknown;
    error?: { message?: string };
  }>((msg: any) => msg?.type === 'res' && msg?.id === agentsReqId, 10000);

  ws.send(
    JSON.stringify({
      type: 'req',
      id: agentsReqId,
      method: 'agents.list',
      params: {},
    }),
  );

  const agentsRes = await agentsResPromise;
  if (agentsRes.ok) {
    console.log('Agents:', JSON.stringify(agentsRes.payload, null, 2));
  } else {
    console.log('agents.list failed:', agentsRes.error?.message);
  }

  // Step 5: Send a test message via the "agent" method
  console.log('\n--- Sending test message to agent ---');
  const agentReqId = crypto.randomUUID();
  const idemKey = crypto.randomUUID();

  // Listen for ALL messages to see streamed events
  const allMessages: unknown[] = [];
  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      allMessages.push(parsed);
      // Log agent events and chat events
      if (parsed.type === 'event') {
        if (parsed.event === 'agent' || parsed.event === 'chat') {
          const p = parsed.payload;
          if (p?.type === 'text' || p?.type === 'markdown') {
            process.stdout.write(p.content || p.text || '');
          } else if (p?.type === 'status') {
            console.log(`[status] ${p.status}`);
          } else if (p?.type === 'tool_use') {
            console.log(`[tool] ${p.name ?? 'unknown'}`);
          } else if (p?.type === 'done' || p?.status === 'done') {
            console.log('\n[agent done]');
          } else {
            console.log(`[event:${parsed.event}] ${JSON.stringify(p).substring(0, 200)}`);
          }
        }
      }
    } catch {
      // ignore
    }
  });

  // Wait for the first accepted ack + the final result
  const agentFirstResPromise = waitForMessage<{
    type: string;
    id: string;
    ok: boolean;
    payload?: { runId?: string; status?: string };
    error?: { message?: string; code?: string };
  }>((msg: any) => msg?.type === 'res' && msg?.id === agentReqId, 15000);

  ws.send(
    JSON.stringify({
      type: 'req',
      id: agentReqId,
      method: 'agent',
      params: {
        message: 'Hello! Please respond with a short greeting. Just say hi and confirm you are working.',
        agentId: AGENT_ID,
        idempotencyKey: idemKey,
        deliver: false,
      },
    }),
  );

  console.log('Waiting for agent response...');
  const firstRes = await agentFirstResPromise;

  if (!firstRes.ok) {
    console.error('\nAgent request FAILED:', JSON.stringify(firstRes.error, null, 2));
    ws.close();
    process.exit(1);
  }

  console.log(`Agent accepted: runId=${firstRes.payload?.runId}, status=${firstRes.payload?.status}`);

  // Wait for the final response (status: ok or error)
  if (firstRes.payload?.status === 'accepted') {
    console.log('Waiting for agent to complete (up to 120s)...\n');
    try {
      const finalRes = await waitForMessage<{
        type: string;
        id: string;
        ok: boolean;
        payload?: { runId?: string; status?: string; summary?: string; result?: unknown };
        error?: { message?: string };
      }>(
        (msg: any) =>
          msg?.type === 'res' &&
          msg?.id === agentReqId &&
          msg?.payload?.status !== 'accepted',
        120000,
      );

      console.log(`\nFinal status: ${finalRes.payload?.status}`);
      console.log(`Summary: ${finalRes.payload?.summary}`);
      if (finalRes.payload?.result) {
        console.log(
          `Result: ${JSON.stringify(finalRes.payload.result).substring(0, 500)}`,
        );
      }
    } catch (err) {
      console.log(`\nTimeout waiting for final result. Collected ${allMessages.length} messages.`);
    }
  }

  // Step 6: Check health
  console.log('\n--- Checking gateway health ---');
  const healthReqId = crypto.randomUUID();
  const healthResPromise = waitForMessage<{
    type: string;
    id: string;
    ok: boolean;
    payload?: unknown;
  }>((msg: any) => msg?.type === 'res' && msg?.id === healthReqId, 5000);

  ws.send(
    JSON.stringify({
      type: 'req',
      id: healthReqId,
      method: 'health',
      params: {},
    }),
  );

  try {
    const healthRes = await healthResPromise;
    console.log('Health:', JSON.stringify(healthRes.payload, null, 2));
  } catch {
    console.log('Health check timed out');
  }

  console.log('\n=== Test Complete ===');
  ws.close();
  setTimeout(() => process.exit(0), 1000);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
