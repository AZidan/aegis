import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';

/**
 * `aegis-skill publish` — publishes the built skill to the Aegis private skill registry.
 *
 * Options:
 *   --registry-url <url>   Registry URL (or AEGIS_REGISTRY_URL env var)
 *   --token <token>        Auth token (or AEGIS_TOKEN env var)
 */
export function publishCommand(args: string[], dir?: string): void {
  const targetDir = dir ?? process.cwd();

  // Parse arguments
  const registryUrl = getArg(args, '--registry-url') || process.env.AEGIS_REGISTRY_URL;
  const token = getArg(args, '--token') || process.env.AEGIS_TOKEN;

  if (!registryUrl) {
    console.error('Error: --registry-url or AEGIS_REGISTRY_URL env var is required.');
    process.exit(1);
  }

  if (!token) {
    console.error('Error: --token or AEGIS_TOKEN env var is required.');
    process.exit(1);
  }

  // Read manifest
  const manifestPath = path.resolve(targetDir, 'skill.manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`Error: skill.manifest.json not found in ${targetDir}`);
    process.exit(1);
  }

  // Read built source
  const sourcePath = path.resolve(targetDir, 'dist', 'skill.js');
  if (!fs.existsSync(sourcePath)) {
    console.error('Error: dist/skill.js not found. Run `aegis-skill build` first.');
    process.exit(1);
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    console.error('Error: Failed to parse skill.manifest.json');
    process.exit(1);
  }

  const sourceCode = fs.readFileSync(sourcePath, 'utf-8');

  const payload = JSON.stringify({
    ...manifest,
    sourceCode,
  });

  console.log(`Publishing ${manifest.name}@${manifest.version} to ${registryUrl}...`);

  const url = new URL(registryUrl);
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;

  const options: http.RequestOptions = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      Authorization: `Bearer ${token}`,
    },
  };

  const req = transport.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        console.log('Skill published successfully.');
      } else {
        console.error(`Error: Server responded with ${res.statusCode}`);
        if (body) {
          try {
            const parsed = JSON.parse(body);
            console.error(parsed.error?.message || body);
          } catch {
            console.error(body);
          }
        }
        process.exit(1);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });

  req.write(payload);
  req.end();
}

function getArg(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1 || idx >= args.length - 1) return undefined;
  return args[idx + 1];
}
