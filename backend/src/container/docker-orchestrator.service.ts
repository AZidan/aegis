import { execFile } from 'node:child_process';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly commandTimeoutMs = 15_000;

  constructor(private readonly configService: ConfigService) {}

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

    const args: string[] = [
      'run',
      '-d',
      '--name',
      name,
      '--network',
      networkName,
      '--label',
      `aegis.tenantId=${options.tenantId}`,
      '-p',
      `${hostPort}:${containerPort}`,
    ];

    if (options.resourceLimits?.cpu) {
      args.push('--cpus', options.resourceLimits.cpu);
    }
    if (options.resourceLimits?.memoryMb) {
      args.push('--memory', `${options.resourceLimits.memoryMb}m`);
    }

    if (options.environment) {
      for (const [key, value] of Object.entries(options.environment)) {
        args.push('-e', `${key}=${value}`);
      }
    }

    args.push(image);

    const { stdout } = await this.runDocker(args);
    const containerId = stdout.trim();
    if (!containerId) {
      throw new Error('Docker did not return a container id');
    }

    return {
      id: containerId,
      url: `http://localhost:${hostPort}`,
      hostPort,
    };
  }

  async delete(containerId: string): Promise<void> {
    await this.runDocker(['rm', '-f', containerId]);
  }

  async restart(containerId: string): Promise<void> {
    await this.runDocker(['restart', containerId]);
  }

  async stop(containerId: string): Promise<void> {
    await this.runDocker(['stop', containerId]);
  }

  async getStatus(containerId: string): Promise<ContainerStatus> {
    const { stdout } = await this.runDocker([
      'inspect',
      '--format',
      '{{json .State}}',
      containerId,
    ]);

    let statePayload: {
      Status?: string;
      Running?: boolean;
      StartedAt?: string;
      Health?: { Status?: string };
    };

    try {
      statePayload = JSON.parse(stdout);
    } catch {
      return { state: 'unknown', health: 'unknown' };
    }

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
    const args = ['logs'];
    if (options?.tailLines) {
      args.push('--tail', String(options.tailLines));
    }
    if (options?.sinceSeconds) {
      args.push('--since', `${options.sinceSeconds}s`);
    }
    args.push(containerId);

    const { stdout, stderr } = await this.runDocker(args);
    return [stdout, stderr].filter(Boolean).join('\n').trim();
  }

  async updateConfig(
    containerId: string,
    update: ContainerConfigUpdate,
  ): Promise<void> {
    const updateKeys = Object.keys(update).join(', ') || 'none';
    this.logger.debug(
      `Docker updateConfig accepted for ${containerId}; keys=${updateKeys}. Runtime mutation is currently a no-op.`,
    );
  }

  private async ensureNetwork(networkName: string): Promise<void> {
    const { stdout } = await this.runDocker([
      'network',
      'ls',
      '--filter',
      `name=^${networkName}$`,
      '--format',
      '{{.Name}}',
    ]);

    if (stdout.trim() === networkName) {
      return;
    }

    await this.runDocker(['network', 'create', networkName]);
  }

  private runDocker(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const dockerHost = this.configService.get<string>('container.dockerHost');
    const env = dockerHost
      ? { ...process.env, DOCKER_HOST: dockerHost }
      : process.env;

    return new Promise((resolve, reject) => {
      execFile(
        'docker',
        args,
        { env, timeout: this.commandTimeoutMs, maxBuffer: 1024 * 1024 * 10 },
        (error, stdout, stderr) => {
          if (error) {
            const message = stderr?.trim() || error.message;
            reject(new Error(`docker ${args.join(' ')} failed: ${message}`));
            return;
          }

          resolve({ stdout, stderr });
        },
      );
    });
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
