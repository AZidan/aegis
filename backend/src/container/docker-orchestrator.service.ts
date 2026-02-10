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
export class DockerOrchestratorService implements ContainerOrchestrator {
  private readonly logger = new Logger(DockerOrchestratorService.name);

  async create(_options: ContainerCreateOptions): Promise<ContainerHandle> {
    this.logger.debug('Docker orchestrator create called');
    throw new NotImplementedException(
      'Docker orchestrator implementation is pending Story 2 integration.',
    );
  }

  async delete(_containerId: string): Promise<void> {
    throw new NotImplementedException(
      'Docker orchestrator implementation is pending Story 2 integration.',
    );
  }

  async restart(_containerId: string): Promise<void> {
    throw new NotImplementedException(
      'Docker orchestrator implementation is pending Story 2 integration.',
    );
  }

  async stop(_containerId: string): Promise<void> {
    throw new NotImplementedException(
      'Docker orchestrator implementation is pending Story 2 integration.',
    );
  }

  async getStatus(_containerId: string): Promise<ContainerStatus> {
    throw new NotImplementedException(
      'Docker orchestrator implementation is pending Story 2 integration.',
    );
  }

  async getLogs(
    _containerId: string,
    _options?: ContainerLogOptions,
  ): Promise<string> {
    throw new NotImplementedException(
      'Docker orchestrator implementation is pending Story 2 integration.',
    );
  }

  async updateConfig(
    _containerId: string,
    _update: ContainerConfigUpdate,
  ): Promise<void> {
    throw new NotImplementedException(
      'Docker orchestrator implementation is pending Story 2 integration.',
    );
  }
}
