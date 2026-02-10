import {
  ContainerConfigUpdate,
  ContainerCreateOptions,
  ContainerHandle,
  ContainerLogOptions,
  ContainerStatus,
} from './container-config.interface';

export interface ContainerOrchestrator {
  create(options: ContainerCreateOptions): Promise<ContainerHandle>;
  delete(containerId: string): Promise<void>;
  restart(containerId: string): Promise<void>;
  stop(containerId: string): Promise<void>;
  getStatus(containerId: string): Promise<ContainerStatus>;
  getLogs(containerId: string, options?: ContainerLogOptions): Promise<string>;
  updateConfig(
    containerId: string,
    update: ContainerConfigUpdate,
  ): Promise<void>;
}
