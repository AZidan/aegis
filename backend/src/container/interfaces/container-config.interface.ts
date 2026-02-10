export interface ContainerResourceLimits {
  cpu: string;
  memoryMb: number;
  diskGb?: number;
}

export interface ContainerCreateOptions {
  tenantId: string;
  image?: string;
  name?: string;
  environment?: Record<string, string>;
  resourceLimits?: ContainerResourceLimits;
  networkName?: string;
  hostPort?: number;
  containerPort?: number;
}

export interface ContainerHandle {
  id: string;
  url: string;
  hostPort: number;
}

export interface ContainerStatus {
  state: 'creating' | 'running' | 'stopped' | 'failed' | 'unknown';
  health: 'healthy' | 'degraded' | 'down' | 'unknown';
  startedAt?: Date;
  uptimeSeconds?: number;
}

export interface ContainerLogOptions {
  tailLines?: number;
  sinceSeconds?: number;
}

export interface ContainerConfigUpdate {
  openclawConfig?: Record<string, unknown>;
  environment?: Record<string, string>;
}
