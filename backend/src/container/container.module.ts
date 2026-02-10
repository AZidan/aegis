import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONTAINER_ORCHESTRATOR } from './container.constants';
import { DockerOrchestratorService } from './docker-orchestrator.service';
import { KubernetesOrchestratorService } from './kubernetes-orchestrator.service';
import { MockOrchestratorService } from './mock-orchestrator.service';

@Module({
  providers: [
    DockerOrchestratorService,
    KubernetesOrchestratorService,
    MockOrchestratorService,
    {
      provide: CONTAINER_ORCHESTRATOR,
      inject: [
        ConfigService,
        DockerOrchestratorService,
        KubernetesOrchestratorService,
        MockOrchestratorService,
      ],
      useFactory: (
        configService: ConfigService,
        dockerOrchestrator: DockerOrchestratorService,
        kubernetesOrchestrator: KubernetesOrchestratorService,
        mockOrchestrator: MockOrchestratorService,
      ) => {
        const runtime = configService.get<string>('container.runtime', 'mock');

        if (runtime === 'docker') {
          return dockerOrchestrator;
        }

        if (runtime === 'kubernetes') {
          return kubernetesOrchestrator;
        }

        return mockOrchestrator;
      },
    },
  ],
  exports: [CONTAINER_ORCHESTRATOR],
})
export class ContainerModule {}
