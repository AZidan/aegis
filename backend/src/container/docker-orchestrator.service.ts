import { once } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Docker from 'dockerode';
import tar from 'tar-stream';
import { ContainerOrchestrator } from './interfaces/container-orchestrator.interface';
import { ContainerNetworkService } from './container-network.service';
import { SecretsManagerService } from './secrets-manager.service';
import {
  ContainerConfigUpdate,
  ContainerCreateOptions,
  ContainerHandle,
  ContainerLogOptions,
  ContainerStatus,
} from './interfaces/container-config.interface';
import {
  DEFAULT_CONTAINER_BASE_PORT,
  DEFAULT_CONTAINER_NETWORK,
  DEFAULT_CONTAINER_PORT,
} from './container.constants';

@Injectable()
export class DockerOrchestratorService implements ContainerOrchestrator {
  private readonly logger = new Logger(DockerOrchestratorService.name);
  private readonly docker: Docker;

  constructor(
    private readonly configService: ConfigService,
    private readonly containerNetworkService: ContainerNetworkService,
    private readonly secretsManager: SecretsManagerService,
  ) {
    this.docker = this.createDockerClient();
  }

  async create(options: ContainerCreateOptions): Promise<ContainerHandle> {
    const hostPort =
      options.hostPort ??
      this.configService.get<number>(
        'container.basePort',
        DEFAULT_CONTAINER_BASE_PORT,
      );
    const containerPort = options.containerPort ?? DEFAULT_CONTAINER_PORT;
    const image =
      options.image ??
      this.configService.get<string>(
        'container.openclawImage',
        'openclaw/openclaw:latest',
      );
    const name = options.name ?? `aegis-${options.tenantId.slice(0, 8)}`;
    const networkName =
      options.networkName ??
      this.configService.get<string>(
        'container.networkName',
        DEFAULT_CONTAINER_NETWORK,
      );

    await this.ensureNetwork(
      networkName,
      this.containerNetworkService.getDockerNetworkLabels(options.tenantId),
    );

    // Clean up any existing container with the same name (idempotent retries)
    try {
      const existing = this.docker.getContainer(name);
      await existing.remove({ force: true });
      this.logger.warn(`Removed existing container "${name}" before re-creation`);
    } catch {
      // Container doesn't exist - expected on first attempt
    }

    // Write age private key to a host temp file for bind mounting.
    // The secrets-entrypoint.sh validates this file on startup, so it must
    // be available before the container starts.
    const ageKeyContent = this.secretsManager.getAgePrivateKeyForTenant(options.tenantId);
    // Use a shared host-mapped directory so bind mounts resolve correctly
    // when the backend itself runs inside a container (Docker-in-Docker via socket).
    const secretsBase = process.env.AEGIS_SECRETS_DIR || path.join(os.tmpdir(), 'aegis-secrets');
    fs.mkdirSync(secretsBase, { recursive: true });
    const ageKeyDir = fs.mkdtempSync(path.join(secretsBase, 'age-'));
    const ageKeyPath = path.join(ageKeyDir, 'age_key');
    fs.writeFileSync(ageKeyPath, ageKeyContent, { mode: 0o400 });

    // Calculate Node.js heap limit: 75% of container memory, min 256MB
    const containerMemoryMb = options.resourceLimits?.memoryMb ?? 1024;
    const heapSizeMb = Math.max(256, Math.floor(containerMemoryMb * 0.75));

    const secureRuntimeEnv: Record<string, string> = {
      OPENCLAW_AGE_KEY_FILE: '/run/secrets/age_key',
      OPENCLAW_DATA_DIR: '/home/node/.openclaw',
      OPENCLAW_SECRETS_DIR: '/run/secrets/openclaw',
      NODE_OPTIONS: `--max-old-space-size=${heapSizeMb}`,
    };
    const env = Object.entries({ ...secureRuntimeEnv, ...(options.environment ?? {}) }).map(
      ([key, value]) => `${key}=${value}`,
    );
    const memoryBytes = options.resourceLimits?.memoryMb
      ? options.resourceLimits.memoryMb * 1024 * 1024
      : undefined;
    const nanoCpus = options.resourceLimits?.cpu
      ? Math.round(Number(options.resourceLimits.cpu) * 1_000_000_000)
      : undefined;

    // The container starts with a wait-for-config wrapper that polls for
    // openclaw.json before exec'ing the real entrypoint. This avoids the
    // race where OpenClaw exits immediately because the provisioning
    // pipeline hasn't injected the config yet.
    const container = await this.docker.createContainer({
      Image: image,
      name,
      Env: env.length > 0 ? env : undefined,
      Entrypoint: ['sh', '-c'],
      Cmd: [
        'for i in $(seq 1 240); do [ -f /home/node/.openclaw/openclaw.json ] && break; sleep 0.5; done; ' +
        'exec /usr/local/bin/secrets-entrypoint.sh node dist/index.js gateway --bind lan --port 18789',
      ],
      ExposedPorts: {
        [`${containerPort}/tcp`]: {},
      },
      Labels: {
        ...this.containerNetworkService.getContainerLabels(options.tenantId),
      },
      Healthcheck: {
        Test: ['CMD-SHELL', 'curl -s -o /dev/null -w "" http://127.0.0.1:18789/ || exit 1'],
        Interval: 15_000_000_000,
        Timeout: 5_000_000_000,
        Retries: 5,
        StartPeriod: 30_000_000_000,
      },
      HostConfig: {
        NetworkMode: networkName,
        PortBindings: {
          [`${containerPort}/tcp`]: [{ HostPort: String(hostPort) }],
        },
        Binds: [`${ageKeyPath}:/run/secrets/age_key:ro`],
        Memory: memoryBytes,
        NanoCpus:
          nanoCpus && Number.isFinite(nanoCpus) && nanoCpus > 0
            ? nanoCpus
            : undefined,
        CapDrop: ['ALL'],
      },
    });
    await container.start();

    // Connect the tenant container to the shared management network so the
    // backend (which also sits on this network) can reach it by container name.
    const managementNetwork = this.configService.get<string>(
      'container.networkName',
      DEFAULT_CONTAINER_NETWORK,
    );
    if (managementNetwork !== networkName) {
      try {
        const mgmtNet = this.docker.getNetwork(managementNetwork);
        await mgmtNet.connect({ Container: container.id });
      } catch (error) {
        this.logger.warn(
          `Could not attach container to management network "${managementNetwork}": ${(error as Error).message}`,
        );
      }
    }

    return {
      id: container.id,
      url: `http://${name}:${containerPort}`,
      hostPort,
    };
  }

  async delete(containerId: string): Promise<void> {
    await this.docker.getContainer(containerId).remove({ force: true });
  }

  async restart(containerId: string): Promise<void> {
    await this.docker.getContainer(containerId).restart();
  }

  async stop(containerId: string): Promise<void> {
    await this.docker.getContainer(containerId).stop();
  }

  async getStatus(containerId: string): Promise<ContainerStatus> {
    const inspectPayload = await this.docker.getContainer(containerId).inspect();
    const statePayload = inspectPayload.State;

    const mappedState = this.mapState(statePayload.Status, statePayload.Running);
    const mappedHealth = this.mapHealth(
      statePayload.Health?.Status,
      mappedState,
    );

    return {
      state: mappedState,
      health: mappedHealth,
      startedAt: this.parseDate(statePayload.StartedAt),
      uptimeSeconds: this.calculateUptimeSeconds(statePayload.StartedAt),
    };
  }

  async getLogs(
    containerId: string,
    options?: ContainerLogOptions,
  ): Promise<string> {
    const logs = await this.docker.getContainer(containerId).logs({
      stdout: true,
      stderr: true,
      tail: options?.tailLines,
      since: options?.sinceSeconds,
      follow: false,
    });
    return (await this.renderLogOutput(logs as Buffer | NodeJS.ReadableStream)).trim();
  }

  async updateConfig(
    containerId: string,
    update: ContainerConfigUpdate,
  ): Promise<void> {
    if (!update.openclawConfig && !update.environment) {
      return;
    }

    if (update.environment && Object.keys(update.environment).length > 0) {
      this.logger.warn(
        `Docker runtime env mutation is not supported in-place for ${containerId}; ignoring environment update keys.`,
      );
    }

    if (!update.openclawConfig) {
      return;
    }

    const payload = JSON.stringify(update.openclawConfig, null, 2);
    const container = this.docker.getContainer(containerId);
    const archive = await this.createTarArchive('openclaw.json', payload, {
      uid: 1000,
      gid: 1000,
      mode: 0o600,
    });

    await this.runContainerCommand(containerId, 'mkdir -p /home/node/.openclaw');
    await container.putArchive(archive, { path: '/home/node/.openclaw' });
  }

  /**
   * Push per-agent workspace files (SOUL.md, AGENTS.md, etc.) into a running container.
   * Creates the agent workspace directory and writes each file via exec.
   */
  async pushAgentWorkspace(
    containerId: string,
    agentId: string,
    files: {
      soulMd: string;
      agentsMd: string;
      heartbeatMd: string;
      userMd: string;
      identityMd: string;
    },
  ): Promise<void> {
    // OpenClaw resolves per-agent workspaces at ~/.openclaw/workspace-{agentId}/
    const workspaceDir = `/home/node/.openclaw/workspace-${agentId}`;

    await this.writeFileViaExec(containerId, `${workspaceDir}/SOUL.md`, files.soulMd);
    await this.writeFileViaExec(containerId, `${workspaceDir}/AGENTS.md`, files.agentsMd);
    await this.writeFileViaExec(containerId, `${workspaceDir}/HEARTBEAT.md`, files.heartbeatMd);
    await this.writeFileViaExec(containerId, `${workspaceDir}/USER.md`, files.userMd);
    await this.writeFileViaExec(containerId, `${workspaceDir}/IDENTITY.md`, files.identityMd);

    this.logger.log(`Pushed workspace files for agent ${agentId} to container ${containerId}`);
  }

  /**
   * Push auth-profiles.json for a specific agent into a running container.
   */
  async pushAuthProfiles(
    containerId: string,
    agentId: string,
    authProfilesJson: string,
  ): Promise<void> {
    const agentDir = `/home/node/.openclaw/agents/${agentId}/agent`;
    await this.writeFileViaExec(containerId, `${agentDir}/auth-profiles.json`, authProfilesJson);
    this.logger.log(`Pushed auth-profiles.json for agent ${agentId} to container ${containerId}`);
  }

  /**
   * Remove per-agent workspace and agent directories from a running container.
   */
  async removeAgentWorkspace(
    containerId: string,
    agentId: string,
  ): Promise<void> {
    const workspaceDir = `/home/node/.openclaw/workspace-${agentId}`;
    const agentDir = `/home/node/.openclaw/agents/${agentId}`;
    await this.runContainerCommand(containerId, `rm -rf ${workspaceDir} ${agentDir}`);
    this.logger.log(`Removed workspace for agent ${agentId} from container ${containerId}`);
  }

  private async ensureNetwork(
    networkName: string,
    labels?: Record<string, string>,
  ): Promise<void> {
    const networks = await this.docker.listNetworks({
      filters: {
        name: [networkName],
      },
    });

    if (
      networks.some((network) =>
        (network.Name ?? '').localeCompare(networkName) === 0,
      )
    ) {
      return;
    }

    await this.docker.createNetwork({ Name: networkName, Labels: labels });
  }

  private createDockerClient(): Docker {
    const dockerHost = this.configService.get<string>('container.dockerHost');
    if (!dockerHost) {
      return new Docker();
    }

    if (dockerHost.startsWith('unix://')) {
      return new Docker({ socketPath: dockerHost.replace('unix://', '') });
    }

    const normalized = dockerHost.startsWith('tcp://')
      ? dockerHost.replace('tcp://', 'http://')
      : dockerHost;
    try {
      const endpoint = new URL(normalized);
      return new Docker({
        protocol: endpoint.protocol.replace(':', '') as 'http' | 'https' | 'ssh',
        host: endpoint.hostname,
        port: endpoint.port ? Number(endpoint.port) : 2375,
      });
    } catch {
      this.logger.warn(
        `Invalid CONTAINER_DOCKER_HOST format "${dockerHost}". Falling back to default docker socket discovery.`,
      );
      return new Docker();
    }
  }

  /**
   * Write file content into a running container via exec + stdin.
   * This bypasses Docker's ReadonlyRootfs API check since the process
   * runs inside the container where tmpfs mounts are writable.
   */
  private async writeFileViaExec(
    containerId: string,
    filePath: string,
    content: string,
  ): Promise<void> {
    const container = this.docker.getContainer(containerId);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    // base64 encode to safely handle special chars in JSON
    const b64 = Buffer.from(content).toString('base64');
    const cmd = `mkdir -p ${dir} && echo '${b64}' | base64 -d > ${filePath} && chmod 600 ${filePath}`;

    const exec = await container.exec({
      Cmd: ['sh', '-c', cmd],
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({ Tty: false });
    stream.on('data', () => {});

    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error('writeFileViaExec timed out')),
        15_000,
      );
      timeoutHandle.unref();
    });
    try {
      await Promise.race([
        once(stream, 'end'),
        once(stream, 'close'),
        once(stream, 'finish'),
        once(stream, 'error').then(([error]) => {
          throw error;
        }),
        timeoutPromise,
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }

    const result = await exec.inspect();
    if ((result.ExitCode ?? 1) !== 0) {
      throw new Error(
        `writeFileViaExec failed for ${containerId}:${filePath} with exit code ${result.ExitCode ?? -1}`,
      );
    }
  }

  private async runContainerCommand(
    containerId: string,
    command: string,
  ): Promise<void> {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: ['sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({ Tty: false });

    // Consume stream data to prevent backpressure stalls
    stream.on('data', () => {});

    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error('Container exec timed out')),
        15_000,
      );
      timeoutHandle.unref();
    });
    try {
      await Promise.race([
        once(stream, 'end'),
        once(stream, 'close'),
        once(stream, 'finish'),
        once(stream, 'error').then(([error]) => {
          throw error;
        }),
        timeoutPromise,
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
    const result = await exec.inspect();
    if ((result.ExitCode ?? 1) !== 0) {
      throw new Error(
        `Container exec failed for ${containerId} with exit code ${result.ExitCode ?? -1}`,
      );
    }
  }

  private async renderLogOutput(
    logs: Buffer | NodeJS.ReadableStream | string,
  ): Promise<string> {
    if (Buffer.isBuffer(logs) || typeof logs === 'string') {
      return logs.toString();
    }

    const chunks: Buffer[] = [];
    logs.on('data', (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    const completion = Promise.race([
      once(logs, 'end'),
      once(logs, 'finish'),
      once(logs, 'close'),
      once(logs, 'error').then(([error]) => {
        throw error;
      }),
    ]);
    await completion;
    return Buffer.concat(chunks).toString('utf8');
  }

  private async createTarArchive(
    fileName: string,
    content: string,
    options?: { uid?: number; gid?: number; mode?: number },
  ): Promise<Buffer> {
    const pack = tar.pack();
    const archivePromise = this.streamToBuffer(pack as unknown as NodeJS.ReadableStream);
    await new Promise<void>((resolve, reject) => {
      pack.entry(
        {
          name: fileName,
          mode: options?.mode ?? 0o600,
          uid: options?.uid ?? 0,
          gid: options?.gid ?? 0,
        },
        content,
        (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        },
      );
    });
    pack.finalize();
    return archivePromise;
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    await Promise.race([
      once(stream, 'end'),
      once(stream, 'error').then(([error]) => {
        throw error;
      }),
    ]);
    return Buffer.concat(chunks);
  }

  private mapState(
    status?: string,
    running?: boolean,
  ): ContainerStatus['state'] {
    if (status === 'running' || running) {
      return 'running';
    }
    if (status === 'created' || status === 'restarting') {
      return 'creating';
    }
    if (
      status === 'exited' ||
      status === 'paused' ||
      status === 'removing'
    ) {
      return 'stopped';
    }
    if (status === 'dead') {
      return 'failed';
    }
    return 'unknown';
  }

  private mapHealth(
    health?: string,
    state?: ContainerStatus['state'],
  ): ContainerStatus['health'] {
    if (health === 'healthy') {
      return 'healthy';
    }
    if (health === 'unhealthy') {
      return 'down';
    }
    if (health === 'starting') {
      return 'degraded';
    }
    if (state === 'running') {
      return 'healthy';
    }
    if (state === 'failed' || state === 'stopped') {
      return 'down';
    }
    return 'unknown';
  }

  private parseDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private calculateUptimeSeconds(startedAt?: string): number | undefined {
    const started = this.parseDate(startedAt);
    if (!started) {
      return undefined;
    }
    return Math.max(0, Math.floor((Date.now() - started.getTime()) / 1000));
  }
}
