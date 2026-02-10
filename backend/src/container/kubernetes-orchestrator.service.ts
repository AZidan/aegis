import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ContainerOrchestrator } from './interfaces/container-orchestrator.interface';
import {
  ContainerConfigUpdate,
  ContainerCreateOptions,
  ContainerHandle,
  ContainerLogOptions,
  ContainerStatus,
} from './interfaces/container-config.interface';

@Injectable()
export class KubernetesOrchestratorService implements ContainerOrchestrator {
  private readonly logger = new Logger(KubernetesOrchestratorService.name);

  async create(_options: ContainerCreateOptions): Promise<ContainerHandle> {
    this.logger.debug('Kubernetes orchestrator create called');
    throw new NotImplementedException(
      'Kubernetes orchestrator implementation is pending Story 2 integration.',
    );
  }

  async delete(_containerId: string): Promise<void> {
    throw new NotImplementedException(
      'Kubernetes orchestrator implementation is pending Story 2 integration.',
    );
  }

  async restart(_containerId: string): Promise<void> {
    throw new NotImplementedException(
      'Kubernetes orchestrator implementation is pending Story 2 integration.',
    );
  }

  async stop(_containerId: string): Promise<void> {
    throw new NotImplementedException(
      'Kubernetes orchestrator implementation is pending Story 2 integration.',
    );
  }

  async getStatus(_containerId: string): Promise<ContainerStatus> {
    throw new NotImplementedException(
      'Kubernetes orchestrator implementation is pending Story 2 integration.',
    );
  }

  async getLogs(
    _containerId: string,
    _options?: ContainerLogOptions,
  ): Promise<string> {
    throw new NotImplementedException(
      'Kubernetes orchestrator implementation is pending Story 2 integration.',
    );
  }

  async updateConfig(
    _containerId: string,
    _update: ContainerConfigUpdate,
  ): Promise<void> {
    throw new NotImplementedException(
      'Kubernetes orchestrator implementation is pending Story 2 integration.',
    );
  }
}
