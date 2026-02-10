import { execFile } from 'node:child_process';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DockerOrchestratorService } from '../../src/container/docker-orchestrator.service';
import { KubernetesOrchestratorService } from '../../src/container/kubernetes-orchestrator.service';
import { ContainerOrchestrator } from '../../src/container/interfaces/container-orchestrator.interface';

jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}));

type ExecFileCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;

const execFileMock = execFile as unknown as jest.Mock;

type RuntimeCase = {
  runtime: 'docker' | 'kubernetes';
  provider: new (...args: never[]) => ContainerOrchestrator;
  containerId: string;
  command: string;
};

const CASES: RuntimeCase[] = [
  {
    runtime: 'docker',
    provider: DockerOrchestratorService,
    containerId: 'container-123',
    command: 'docker',
  },
  {
    runtime: 'kubernetes',
    provider: KubernetesOrchestratorService,
    containerId: 'aegis-tenants/openclaw-1',
    command: 'kubectl',
  },
];

function makeConfigService(runtime: RuntimeCase['runtime']) {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const map: Record<string, unknown> = {
        'container.dockerHost': 'unix:///var/run/docker.sock',
        'container.basePort': 19000,
        'container.openclawImage': 'openclaw/openclaw:latest',
        'container.networkName': 'aegis-tenant-network',
        'container.kubernetes.enabled': runtime === 'kubernetes',
        'container.kubernetes.namespace': 'aegis-tenants',
        'container.kubernetes.context': '',
        'container.kubernetes.serviceDomain': 'svc.cluster.local',
      };
      return map[key] ?? defaultValue;
    }),
  };
}

describe('ContainerOrchestrator contract', () => {
  describe.each(CASES)('$runtime implementation', (runtimeCase) => {
    let service: ContainerOrchestrator;

    beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          runtimeCase.provider,
          {
            provide: ConfigService,
            useValue: makeConfigService(runtimeCase.runtime),
          },
        ],
      }).compile();

      service = module.get<ContainerOrchestrator>(runtimeCase.provider);
    });

    it('restart should resolve', async () => {
      execFileMock.mockImplementation(
        (
          _command: string,
          _args: string[],
          _opts: unknown,
          callback: ExecFileCallback,
        ) => callback(null, '', ''),
      );

      await expect(service.restart(runtimeCase.containerId)).resolves.toBeUndefined();
      expect(execFileMock).toHaveBeenCalledWith(
        runtimeCase.command,
        expect.any(Array),
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('getStatus should map to running/healthy', async () => {
      execFileMock.mockImplementation(
        (
          command: string,
          args: string[],
          _opts: unknown,
          callback: ExecFileCallback,
        ) => {
          if (command === 'docker' && args[0] === 'inspect') {
            callback(
              null,
              JSON.stringify({
                Status: 'running',
                Running: true,
                Health: { Status: 'healthy' },
                StartedAt: '2026-02-10T00:00:00.000Z',
              }),
              '',
            );
            return;
          }

          if (
            command === 'kubectl' &&
            args.includes('get') &&
            args.includes('deployment')
          ) {
            callback(
              null,
              JSON.stringify({
                metadata: { creationTimestamp: '2026-02-10T00:00:00.000Z' },
                spec: { replicas: 1 },
                status: { availableReplicas: 1, readyReplicas: 1 },
              }),
              '',
            );
            return;
          }

          callback(null, '', '');
        },
      );

      const status = await service.getStatus(runtimeCase.containerId);
      expect(status.state).toBe('running');
      expect(status.health).toBe('healthy');
    });

    it('getLogs should support tail and since options', async () => {
      execFileMock.mockImplementation(
        (
          _command: string,
          _args: string[],
          _opts: unknown,
          callback: ExecFileCallback,
        ) => callback(null, 'out', 'err'),
      );

      const logs = await service.getLogs(runtimeCase.containerId, {
        tailLines: 25,
        sinceSeconds: 90,
      });
      expect(logs).toContain('out');
      expect(logs).toContain('err');
      expect(execFileMock).toHaveBeenCalledWith(
        runtimeCase.command,
        expect.arrayContaining(['--tail', '25']),
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('updateConfig should resolve as a no-op', async () => {
      await expect(
        service.updateConfig(runtimeCase.containerId, {
          openclawConfig: { gateway: { port: 18789 } },
        }),
      ).resolves.toBeUndefined();
    });
  });

  it('kubernetes should fail fast when runtime is not enabled', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KubernetesOrchestratorService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'container.kubernetes.enabled') {
                return false;
              }
              if (key === 'container.kubernetes.namespace') {
                return 'aegis-tenants';
              }
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    const service = module.get<KubernetesOrchestratorService>(
      KubernetesOrchestratorService,
    );

    await expect(service.restart('aegis-tenants/openclaw-1')).rejects.toThrow(
      'Kubernetes runtime is not enabled',
    );
  });
});
