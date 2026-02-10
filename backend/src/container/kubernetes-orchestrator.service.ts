import { createHash } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as k8s from '@kubernetes/client-node';
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
  private kubeConfig?: k8s.KubeConfig;
  private appsApi?: k8s.AppsV1Api;
  private coreApi?: k8s.CoreV1Api;
  private networkingApi?: k8s.NetworkingV1Api;

  constructor(private readonly configService: ConfigService) {
    this.initializeClient();
  }

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
    await this.upsertSecret(namespace, `${name}-runtime-secrets`, {
      OPENCLAW_AGE_KEY_FILE: '/run/secrets/age_key',
      OPENCLAW_DATA_DIR: '/home/node/.openclaw',
      OPENCLAW_SECRETS_DIR: '/run/secrets/openclaw',
      ...(options.environment ?? {}),
    });
    await this.upsertDeployment(namespace, name, image, containerPort, options);
    await this.upsertService(namespace, name, containerPort);
    await this.upsertNetworkPolicy(namespace, name);

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
    await this.tryDeleteDeployment(namespace, name);
    await this.tryDeleteService(namespace, name);
    await this.tryDeleteConfigMap(namespace, `${name}-openclaw-config`);
    await this.tryDeleteSecret(namespace, `${name}-runtime-secrets`);
    await this.tryDeleteNetworkPolicy(namespace, `${name}-deny-ingress`);
  }

  async restart(containerId: string): Promise<void> {
    this.assertEnabled();
    const { namespace, name } = this.parseContainerId(containerId);
    const deployment = await this.appsApi!.readNamespacedDeployment({
      name,
      namespace,
    });
    if (!deployment.spec?.template) {
      throw new Error(`Deployment ${namespace}/${name} has no pod template`);
    }
    deployment.spec.template.metadata = deployment.spec.template.metadata ?? {};
    deployment.spec.template.metadata.annotations =
      deployment.spec.template.metadata.annotations ?? {};
    deployment.spec.template.metadata.annotations[
      'kubectl.kubernetes.io/restartedAt'
    ] = new Date().toISOString();
    await this.appsApi!.replaceNamespacedDeployment({
      name,
      namespace,
      body: deployment,
    });
  }

  async stop(containerId: string): Promise<void> {
    this.assertEnabled();
    const { namespace, name } = this.parseContainerId(containerId);
    const deployment = await this.appsApi!.readNamespacedDeployment({
      name,
      namespace,
    });
    if (!deployment.spec) {
      throw new Error(`Deployment ${namespace}/${name} has no spec`);
    }
    deployment.spec.replicas = 0;
    await this.appsApi!.replaceNamespacedDeployment({
      name,
      namespace,
      body: deployment,
    });
  }

  async getStatus(containerId: string): Promise<ContainerStatus> {
    this.assertEnabled();
    const { namespace, name } = this.parseContainerId(containerId);
    const deployment = await this.appsApi!.readNamespacedDeployment({
      name,
      namespace,
    });

    const desiredReplicas = deployment.spec?.replicas ?? 0;
    const availableReplicas = deployment.status?.availableReplicas ?? 0;
    const readyReplicas = deployment.status?.readyReplicas ?? 0;

    if (desiredReplicas === 0) {
      return { state: 'stopped', health: 'down', uptimeSeconds: 0 };
    }
    if (availableReplicas > 0 && readyReplicas >= desiredReplicas) {
      return {
        state: 'running',
        health: 'healthy',
        startedAt: this.parseDate(deployment.metadata?.creationTimestamp),
        uptimeSeconds: this.calculateUptimeSeconds(
          deployment.metadata?.creationTimestamp,
        ),
      };
    }
    if (availableReplicas > 0 || readyReplicas > 0) {
      return {
        state: 'running',
        health: 'degraded',
        startedAt: this.parseDate(deployment.metadata?.creationTimestamp),
        uptimeSeconds: this.calculateUptimeSeconds(
          deployment.metadata?.creationTimestamp,
        ),
      };
    }

    return {
      state: 'creating',
      health: 'unknown',
      startedAt: this.parseDate(deployment.metadata?.creationTimestamp),
      uptimeSeconds: this.calculateUptimeSeconds(
        deployment.metadata?.creationTimestamp,
      ),
    };
  }

  async getLogs(
    containerId: string,
    options?: ContainerLogOptions,
  ): Promise<string> {
    this.assertEnabled();
    const { namespace, name } = this.parseContainerId(containerId);
    const pods = await this.coreApi!.listNamespacedPod({
      namespace,
      labelSelector: `app=${name}`,
      limit: 1,
    });
    const podName = pods.items[0]?.metadata?.name;
    if (!podName) {
      return '';
    }

    return this.coreApi!.readNamespacedPodLog({
      name: podName,
      namespace,
      follow: false,
      previous: false,
      sinceSeconds: options?.sinceSeconds,
      tailLines: options?.tailLines,
      timestamps: false,
    });
  }

  async updateConfig(
    containerId: string,
    update: ContainerConfigUpdate,
  ): Promise<void> {
    this.assertEnabled();
    const { namespace, name } = this.parseContainerId(containerId);

    let hash: string | undefined;
    if (update.openclawConfig) {
      const configPayload = JSON.stringify(update.openclawConfig, null, 2);
      hash = this.hashConfig(configPayload);
      await this.upsertConfigMap(namespace, `${name}-openclaw-config`, {
        'openclaw.json': configPayload,
      });
    }

    if (update.environment || hash) {
      await this.patchDeploymentEnvironment(namespace, name, update, hash);
    }

    await this.restart(containerId);
  }

  private initializeClient(): void {
    const enabledFromConfig = this.configService.get<boolean>(
      'container.kubernetes.enabled',
      false,
    );
    const hasKubeEnvironment = Boolean(
      process.env.KUBECONFIG || process.env.KUBERNETES_SERVICE_HOST,
    );
    if (!enabledFromConfig && !hasKubeEnvironment) {
      return;
    }

    this.kubeConfig = new k8s.KubeConfig();
    try {
      this.kubeConfig.loadFromDefault();
    } catch (error) {
      this.logger.error(
        `Failed to load Kubernetes configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'Kubernetes runtime enabled but kubeconfig is unavailable.',
      );
    }

    const context = this.configService.get<string>(
      'container.kubernetes.context',
      '',
    );
    if (context) {
      this.kubeConfig.setCurrentContext(context);
    }

    this.appsApi = this.kubeConfig.makeApiClient(k8s.AppsV1Api);
    this.coreApi = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
    this.networkingApi = this.kubeConfig.makeApiClient(k8s.NetworkingV1Api);
  }

  private assertEnabled(): void {
    if (this.appsApi && this.coreApi && this.networkingApi) {
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
      await this.coreApi!.readNamespace({ name: namespace });
    } catch (error) {
      if (!this.isNotFound(error)) {
        throw error;
      }
      await this.coreApi!.createNamespace({
        body: {
          metadata: {
            name: namespace,
          },
        },
      });
    }
  }

  private async upsertDeployment(
    namespace: string,
    name: string,
    image: string,
    containerPort: number,
    options: ContainerCreateOptions,
  ): Promise<void> {
    const deployment = this.buildDeployment(
      name,
      image,
      containerPort,
      options.environment,
      options.resourceLimits?.cpu,
      options.resourceLimits?.memoryMb,
    );

    try {
      await this.appsApi!.createNamespacedDeployment({
        namespace,
        body: deployment,
      });
    } catch (error) {
      if (!this.isAlreadyExists(error)) {
        throw error;
      }
      await this.appsApi!.replaceNamespacedDeployment({
        name,
        namespace,
        body: deployment,
      });
    }
  }

  private async upsertService(
    namespace: string,
    name: string,
    containerPort: number,
  ): Promise<void> {
    const service: k8s.V1Service = {
      metadata: { name },
      spec: {
        selector: { app: name },
        ports: [{ protocol: 'TCP', port: containerPort, targetPort: containerPort }],
        type: 'ClusterIP',
      },
    };

    try {
      await this.coreApi!.createNamespacedService({
        namespace,
        body: service,
      });
    } catch (error) {
      if (!this.isAlreadyExists(error)) {
        throw error;
      }
      await this.coreApi!.replaceNamespacedService({
        name,
        namespace,
        body: service,
      });
    }
  }

  private async upsertConfigMap(
    namespace: string,
    name: string,
    data: Record<string, string>,
  ): Promise<void> {
    const configMap: k8s.V1ConfigMap = {
      metadata: { name },
      data,
    };
    try {
      await this.coreApi!.createNamespacedConfigMap({
        namespace,
        body: configMap,
      });
    } catch (error) {
      if (!this.isAlreadyExists(error)) {
        throw error;
      }
      await this.coreApi!.replaceNamespacedConfigMap({
        name,
        namespace,
        body: configMap,
      });
    }
  }

  private async upsertSecret(
    namespace: string,
    name: string,
    data: Record<string, string>,
  ): Promise<void> {
    const secret: k8s.V1Secret = {
      metadata: { name },
      type: 'Opaque',
      stringData: data,
    };
    try {
      await this.coreApi!.createNamespacedSecret({
        namespace,
        body: secret,
      });
    } catch (error) {
      if (!this.isAlreadyExists(error)) {
        throw error;
      }
      await this.coreApi!.replaceNamespacedSecret({
        name,
        namespace,
        body: secret,
      });
    }
  }

  private async upsertNetworkPolicy(
    namespace: string,
    name: string,
  ): Promise<void> {
    const policyName = `${name}-deny-ingress`;
    const policy: k8s.V1NetworkPolicy = {
      metadata: { name: policyName },
      spec: {
        podSelector: { matchLabels: { app: name } },
        policyTypes: ['Ingress'],
        ingress: [],
      },
    };

    try {
      await this.networkingApi!.createNamespacedNetworkPolicy({
        namespace,
        body: policy,
      });
    } catch (error) {
      if (!this.isAlreadyExists(error)) {
        throw error;
      }
      await this.networkingApi!.replaceNamespacedNetworkPolicy({
        name: policyName,
        namespace,
        body: policy,
      });
    }
  }

  private async patchDeploymentEnvironment(
    namespace: string,
    name: string,
    update: ContainerConfigUpdate,
    hash?: string,
  ): Promise<void> {
    const deployment = await this.appsApi!.readNamespacedDeployment({
      name,
      namespace,
    });
    const container = deployment.spec?.template?.spec?.containers?.[0];
    if (!container) {
      throw new Error(`Deployment ${namespace}/${name} has no containers`);
    }

    const envMap = new Map<string, string>();
    for (const entry of container.env ?? []) {
      if (entry.name && entry.value !== undefined) {
        envMap.set(entry.name, entry.value);
      }
    }

    for (const [key, value] of Object.entries(update.environment ?? {})) {
      envMap.set(key, value);
    }

    if (hash) {
      envMap.set('AEGIS_OPENCLAW_CONFIG_HASH', hash);
      envMap.set('AEGIS_OPENCLAW_CONFIGMAP', `${name}-openclaw-config`);
    }

    container.env = Array.from(envMap.entries()).map(([key, value]) => ({
      name: key,
      value,
    }));

    await this.appsApi!.replaceNamespacedDeployment({
      name,
      namespace,
      body: deployment,
    });
  }

  private async tryDeleteDeployment(
    namespace: string,
    name: string,
  ): Promise<void> {
    try {
      await this.appsApi!.deleteNamespacedDeployment({
        name,
        namespace,
      });
    } catch (error) {
      if (!this.isNotFound(error)) {
        throw error;
      }
    }
  }

  private async tryDeleteService(namespace: string, name: string): Promise<void> {
    try {
      await this.coreApi!.deleteNamespacedService({
        name,
        namespace,
      });
    } catch (error) {
      if (!this.isNotFound(error)) {
        throw error;
      }
    }
  }

  private async tryDeleteConfigMap(
    namespace: string,
    name: string,
  ): Promise<void> {
    try {
      await this.coreApi!.deleteNamespacedConfigMap({
        name,
        namespace,
      });
    } catch (error) {
      if (!this.isNotFound(error)) {
        throw error;
      }
    }
  }

  private async tryDeleteSecret(namespace: string, name: string): Promise<void> {
    try {
      await this.coreApi!.deleteNamespacedSecret({
        name,
        namespace,
      });
    } catch (error) {
      if (!this.isNotFound(error)) {
        throw error;
      }
    }
  }

  private async tryDeleteNetworkPolicy(
    namespace: string,
    name: string,
  ): Promise<void> {
    try {
      await this.networkingApi!.deleteNamespacedNetworkPolicy({
        name,
        namespace,
      });
    } catch (error) {
      if (!this.isNotFound(error)) {
        throw error;
      }
    }
  }

  private buildDeployment(
    name: string,
    image: string,
    containerPort: number,
    environment?: Record<string, string>,
    cpu?: string,
    memoryMb?: number,
  ): k8s.V1Deployment {
    const env = Object.entries(environment ?? {}).map(([key, value]) => ({
      name: key,
      value,
    }));

    return {
      metadata: { name },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: { app: name },
        },
        template: {
          metadata: {
            labels: { app: name },
          },
          spec: {
            containers: [
              {
                name: 'openclaw',
                image,
                ports: [{ containerPort }],
                env: env.length > 0 ? env : undefined,
                volumeMounts: [
                  {
                    name: 'openclaw-config',
                    mountPath: '/home/node/.openclaw/openclaw.json',
                    subPath: 'openclaw.json',
                    readOnly: true,
                  },
                ],
                resources:
                  cpu || memoryMb
                    ? {
                        limits: {
                          ...(cpu ? { cpu } : {}),
                          ...(memoryMb ? { memory: `${memoryMb}Mi` } : {}),
                        },
                      }
                    : undefined,
              },
            ],
            volumes: [
              {
                name: 'openclaw-config',
                configMap: {
                  name: `${name}-openclaw-config`,
                  optional: true,
                },
              },
            ],
          },
        },
      },
    };
  }

  private parseDate(value?: string | Date): Date | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private calculateUptimeSeconds(startedAt?: string | Date): number | undefined {
    const started = this.parseDate(startedAt);
    if (!started) {
      return undefined;
    }
    return Math.max(0, Math.floor((Date.now() - started.getTime()) / 1000));
  }

  private hashConfig(payload: string): string {
    return createHash('sha256').update(payload).digest('hex').slice(0, 12);
  }

  private isAlreadyExists(error: unknown): boolean {
    return this.extractStatusCode(error) === 409;
  }

  private isNotFound(error: unknown): boolean {
    return this.extractStatusCode(error) === 404;
  }

  private extractStatusCode(error: unknown): number | undefined {
    const maybe = error as {
      code?: number;
      response?: { statusCode?: number; status?: number };
      body?: { code?: number };
    };
    return maybe.code ?? maybe.response?.statusCode ?? maybe.response?.status ?? maybe.body?.code;
  }
}
