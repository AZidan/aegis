import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
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
  DEFAULT_CONTAINER_PORT,
  DEFAULT_K8S_NAMESPACE,
  DEFAULT_K8S_SERVICE_DOMAIN,
} from './container.constants';

@Injectable()
export class KubernetesOrchestratorService implements ContainerOrchestrator {
  private readonly logger = new Logger(KubernetesOrchestratorService.name);
  private readonly commandTimeoutMs = 15_000;

  constructor(private readonly configService: ConfigService) {}

  async create(options: ContainerCreateOptions): Promise<ContainerHandle> {
    this.assertEnabled();
    const namespace = this.getNamespace();
    const name = options.name ?? `aegis-${options.tenantId.slice(0, 8)}`;
    const image =
      options.image ??
      this.configService.get<string>(
        'container.openclawImage',
        'openclaw/openclaw:latest',
      );
    const containerPort = options.containerPort ?? DEFAULT_CONTAINER_PORT;

    await this.ensureNamespace(namespace);

    await this.runKubectl([
      '-n',
      namespace,
      'create',
      'deployment',
      name,
      '--image',
      image,
      '--dry-run=client',
      '-o',
      'yaml',
    ]);
    await this.runKubectl(['-n', namespace, 'apply', '-f', '-'], {
      stdin: [
        'apiVersion: apps/v1',
        'kind: Deployment',
        'metadata:',
        `  name: ${name}`,
        'spec:',
        '  replicas: 1',
        '  selector:',
        '    matchLabels:',
        `      app: ${name}`,
        '  template:',
        '    metadata:',
        '      labels:',
        `        app: ${name}`,
        '    spec:',
        '      containers:',
        '      - name: openclaw',
        `        image: ${image}`,
        '        ports:',
        `        - containerPort: ${containerPort}`,
      ].join('\n'),
    });

    if (options.environment && Object.keys(options.environment).length > 0) {
      const envArgs = ['-n', namespace, 'set', 'env', `deployment/${name}`];
      for (const [key, value] of Object.entries(options.environment)) {
        envArgs.push(`${key}=${value}`);
      }
      await this.runKubectl(envArgs);
    }

    if (options.resourceLimits?.cpu || options.resourceLimits?.memoryMb) {
      const limits: string[] = [];
      if (options.resourceLimits.cpu) {
        limits.push(`cpu=${options.resourceLimits.cpu}`);
      }
      if (options.resourceLimits.memoryMb) {
        limits.push(`memory=${options.resourceLimits.memoryMb}Mi`);
      }
      await this.runKubectl([
        '-n',
        namespace,
        'set',
        'resources',
        `deployment/${name}`,
        '--limits',
        limits.join(','),
      ]);
    }

    await this.runKubectl([
      '-n',
      namespace,
      'apply',
      '-f',
      '-',
    ], {
      stdin: [
        'apiVersion: v1',
        'kind: Service',
        'metadata:',
        `  name: ${name}`,
        'spec:',
        '  selector:',
        `    app: ${name}`,
        '  ports:',
        '  - protocol: TCP',
        `    port: ${containerPort}`,
        `    targetPort: ${containerPort}`,
        '  type: ClusterIP',
      ].join('\n'),
    });

    const serviceDomain = this.configService.get<string>(
      'container.kubernetes.serviceDomain',
      DEFAULT_K8S_SERVICE_DOMAIN,
    );

    return {
      id: `${namespace}/${name}`,
      url: `http://${name}.${namespace}.${serviceDomain}:${containerPort}`,
      hostPort: options.hostPort ?? containerPort,
    };
  }

  async delete(containerId: string): Promise<void> {
    this.assertEnabled();
    const { namespace, name } = this.parseContainerId(containerId);
    await this.runKubectl([
      '-n',
      namespace,
      'delete',
      'deployment',
      name,
      '--ignore-not-found=true',
    ]);
    await this.runKubectl([
      '-n',
      namespace,
      'delete',
      'service',
      name,
      '--ignore-not-found=true',
    ]);
  }

  async restart(containerId: string): Promise<void> {
    this.assertEnabled();
    const { namespace, name } = this.parseContainerId(containerId);
    await this.runKubectl([
      '-n',
      namespace,
      'rollout',
      'restart',
      `deployment/${name}`,
    ]);
  }

  async stop(containerId: string): Promise<void> {
    this.assertEnabled();
    const { namespace, name } = this.parseContainerId(containerId);
    await this.runKubectl([
      '-n',
      namespace,
      'scale',
      `deployment/${name}`,
      '--replicas=0',
    ]);
  }

  async getStatus(containerId: string): Promise<ContainerStatus> {
    this.assertEnabled();
    const { namespace, name } = this.parseContainerId(containerId);
    const { stdout } = await this.runKubectl([
      '-n',
      namespace,
      'get',
      'deployment',
      name,
      '-o',
      'json',
    ]);

    let payload: {
      metadata?: { creationTimestamp?: string };
      spec?: { replicas?: number };
      status?: { availableReplicas?: number; readyReplicas?: number };
    };

    try {
      payload = JSON.parse(stdout);
    } catch {
      return { state: 'unknown', health: 'unknown' };
    }

    const desiredReplicas = payload.spec?.replicas ?? 0;
    const availableReplicas = payload.status?.availableReplicas ?? 0;
    const readyReplicas = payload.status?.readyReplicas ?? 0;

    if (desiredReplicas === 0) {
      return { state: 'stopped', health: 'down', uptimeSeconds: 0 };
    }
    if (availableReplicas > 0 && readyReplicas >= desiredReplicas) {
      return {
        state: 'running',
        health: 'healthy',
        startedAt: this.parseDate(payload.metadata?.creationTimestamp),
        uptimeSeconds: this.calculateUptimeSeconds(
          payload.metadata?.creationTimestamp,
        ),
      };
    }
    if (availableReplicas > 0 || readyReplicas > 0) {
      return {
        state: 'running',
        health: 'degraded',
        startedAt: this.parseDate(payload.metadata?.creationTimestamp),
        uptimeSeconds: this.calculateUptimeSeconds(
          payload.metadata?.creationTimestamp,
        ),
      };
    }

    return {
      state: 'creating',
      health: 'unknown',
      startedAt: this.parseDate(payload.metadata?.creationTimestamp),
      uptimeSeconds: this.calculateUptimeSeconds(
        payload.metadata?.creationTimestamp,
      ),
    };
  }

  async getLogs(
    containerId: string,
    options?: ContainerLogOptions,
  ): Promise<string> {
    this.assertEnabled();
    const { namespace, name } = this.parseContainerId(containerId);

    const args = ['-n', namespace, 'logs', `deployment/${name}`];
    if (options?.tailLines) {
      args.push('--tail', String(options.tailLines));
    }
    if (options?.sinceSeconds) {
      args.push('--since', `${options.sinceSeconds}s`);
    }

    const { stdout, stderr } = await this.runKubectl(args);
    return [stdout, stderr].filter(Boolean).join('\n').trim();
  }

  async updateConfig(
    containerId: string,
    update: ContainerConfigUpdate,
  ): Promise<void> {
    this.assertEnabled();
    const { namespace, name } = this.parseContainerId(containerId);

    if (update.environment && Object.keys(update.environment).length > 0) {
      const envArgs = ['-n', namespace, 'set', 'env', `deployment/${name}`];
      for (const [key, value] of Object.entries(update.environment)) {
        envArgs.push(`${key}=${value}`);
      }
      await this.runKubectl(envArgs);
    }

    if (update.openclawConfig) {
      const configPayload = JSON.stringify(update.openclawConfig, null, 2);
      const hash = this.hashConfig(configPayload);
      const configMapName = `${name}-openclaw-config`;
      const indentedConfig = configPayload
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n');

      await this.runKubectl(['-n', namespace, 'apply', '-f', '-'], {
        stdin: [
          'apiVersion: v1',
          'kind: ConfigMap',
          'metadata:',
          `  name: ${configMapName}`,
          'data:',
          '  openclaw.json: |',
          indentedConfig,
        ].join('\n'),
      });

      await this.runKubectl([
        '-n',
        namespace,
        'set',
        'env',
        `deployment/${name}`,
        `AEGIS_OPENCLAW_CONFIG_HASH=${hash}`,
        `AEGIS_OPENCLAW_CONFIGMAP=${configMapName}`,
      ]);
    }

    await this.restart(containerId);
  }

  private assertEnabled(): void {
    const enabledFromConfig = this.configService.get<boolean>(
      'container.kubernetes.enabled',
      false,
    );
    const hasKubeEnvironment = Boolean(
      process.env.KUBECONFIG || process.env.KUBERNETES_SERVICE_HOST,
    );

    if (enabledFromConfig || hasKubeEnvironment) {
      return;
    }

    throw new ServiceUnavailableException(
      'Kubernetes runtime is not enabled. Set CONTAINER_K8S_ENABLED=true or provide KUBECONFIG/KUBERNETES_SERVICE_HOST.',
    );
  }

  private getNamespace(): string {
    return this.configService.get<string>(
      'container.kubernetes.namespace',
      DEFAULT_K8S_NAMESPACE,
    );
  }

  private parseContainerId(containerId: string): {
    namespace: string;
    name: string;
  } {
    if (containerId.includes('/')) {
      const [namespace, name] = containerId.split('/');
      return { namespace, name };
    }
    return { namespace: this.getNamespace(), name: containerId };
  }

  private async ensureNamespace(namespace: string): Promise<void> {
    try {
      await this.runKubectl(['get', 'namespace', namespace]);
    } catch {
      await this.runKubectl(['create', 'namespace', namespace]);
    }
  }

  private runKubectl(
    args: string[],
    options?: { stdin?: string },
  ): Promise<{ stdout: string; stderr: string }> {
    const context = this.configService.get<string>(
      'container.kubernetes.context',
      '',
    );
    const finalArgs = [...(context ? ['--context', context] : []), ...args];

    return new Promise((resolve, reject) => {
      const child = execFile(
        'kubectl',
        finalArgs,
        {
          env: process.env,
          timeout: this.commandTimeoutMs,
          maxBuffer: 1024 * 1024 * 10,
        },
        (error, stdout, stderr) => {
          if (error) {
            const message = stderr?.trim() || error.message;
            reject(new Error(`kubectl ${finalArgs.join(' ')} failed: ${message}`));
            return;
          }
          resolve({ stdout, stderr });
        },
      );

      if (options?.stdin && child?.stdin) {
        child.stdin.write(options.stdin);
        child.stdin.end();
      }
    });
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

  private hashConfig(payload: string): string {
    return createHash('sha256').update(payload).digest('hex').slice(0, 12);
  }
}
