import { Injectable } from '@nestjs/common';
import { ContainerOrchestrator } from './interfaces/container-orchestrator.interface';
import {
  ContainerConfigUpdate,
  ContainerCreateOptions,
  ContainerHandle,
  ContainerLogOptions,
  ContainerStatus,
} from './interfaces/container-config.interface';

@Injectable()
export class MockOrchestratorService implements ContainerOrchestrator {
  async create(options: ContainerCreateOptions): Promise<ContainerHandle> {
    return {
      id: `mock-${options.tenantId}`,
      url: `http://localhost:${options.hostPort ?? 19000}`,
      hostPort: options.hostPort ?? 19000,
    };
  }

  async delete(_containerId: string): Promise<void> {
    return;
  }

  async restart(_containerId: string): Promise<void> {
    return;
  }

  async stop(_containerId: string): Promise<void> {
    return;
  }

  async getStatus(_containerId: string): Promise<ContainerStatus> {
    return {
      state: 'running',
      health: 'healthy',
      uptimeSeconds: 0,
    };
  }

  async getLogs(
    _containerId: string,
    _options?: ContainerLogOptions,
  ): Promise<string> {
    return 'mock logs';
  }

  async updateConfig(
    _containerId: string,
    _update: ContainerConfigUpdate,
  ): Promise<void> {
    return;
  }
}
