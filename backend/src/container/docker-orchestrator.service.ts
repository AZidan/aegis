import { once } from 'node:events';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Docker from 'dockerode';
import tar from 'tar-stream';
import { ContainerOrchestrator } from './interfaces/container-orchestrator.interface';
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

  constructor(private readonly configService: ConfigService) {
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

    await this.ensureNetwork(networkName);

    const secureRuntimeEnv: Record<string, string> = {
      OPENCLAW_AGE_KEY_FILE: '/run/secrets/age_key',
      OPENCLAW_DATA_DIR: '/home/node/.openclaw',
      OPENCLAW_SECRETS_DIR: '/run/secrets/openclaw',
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

    const container = await this.docker.createContainer({
      Image: image,
      name,
      Env: env.length > 0 ? env : undefined,
      ExposedPorts: {
        [`${containerPort}/tcp`]: {},
      },
      Labels: {
        'aegis.tenantId': options.tenantId,
      },
      Healthcheck: {
        Test: ['CMD-SHELL', 'wget -q -O - http://127.0.0.1:18789/health || exit 1'],
        Interval: 15_000_000_000,
        Timeout: 5_000_000_000,
        Retries: 5,
      },
      HostConfig: {
        NetworkMode: networkName,
        PortBindings: {
          [`${containerPort}/tcp`]: [{ HostPort: String(hostPort) }],
        },
        Memory: memoryBytes,
        NanoCpus:
          nanoCpus && Number.isFinite(nanoCpus) && nanoCpus > 0
            ? nanoCpus
            : undefined,
        ReadonlyRootfs: true,
        CapDrop: ['ALL'],
        Tmpfs: {
          '/home/node/.openclaw': 'rw,noexec,nosuid,size=5242880',
          '/tmp': 'rw,noexec,nosuid,size=1048576',
          '/run/secrets/openclaw': 'rw,noexec,nosuid,size=65536',
        },
      },
    });
    await container.start();

    return {
      id: container.id,
      url: `http://localhost:${hostPort}`,
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
    const archive = await this.createTarArchive('openclaw.json', payload);

    await this.runContainerCommand(containerId, 'mkdir -p /home/node/.openclaw');
    await container.putArchive(archive, { path: '/home/node/.openclaw' });
    await this.runContainerCommand(
      containerId,
      'chmod 600 /home/node/.openclaw/openclaw.json || true',
    );

    // OpenClaw runtime reload strategy for now is controlled restart.
    await this.restart(containerId);
  }

  private async ensureNetwork(networkName: string): Promise<void> {
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

    await this.docker.createNetwork({ Name: networkName });
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

  private async runContainerCommand(
    containerId: string,
    command: string,
  ): Promise<void> {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: ['sh', '-lc', command],
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({});
    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error('Container exec timed out')),
        10_000,
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
  ): Promise<Buffer> {
    const pack = tar.pack();
    const archivePromise = this.streamToBuffer(pack as unknown as NodeJS.ReadableStream);
    await new Promise<void>((resolve, reject) => {
      pack.entry({ name: fileName, mode: 0o600 }, content, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
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
