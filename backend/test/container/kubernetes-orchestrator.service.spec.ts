import { execFile } from 'node:child_process';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KubernetesOrchestratorService } from '../../src/container/kubernetes-orchestrator.service';

jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}));

type ExecFileCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;

describe('KubernetesOrchestratorService', () => {
  let service: KubernetesOrchestratorService;
  const execFileMock = execFile as unknown as jest.Mock;

  const configServiceMock = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const map: Record<string, unknown> = {
        'container.kubernetes.enabled': true,
        'container.kubernetes.namespace': 'aegis-tenants',
        'container.kubernetes.context': '',
        'container.kubernetes.serviceDomain': 'svc.cluster.local',
        'container.openclawImage': 'openclaw/openclaw:latest',
      };
      return map[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KubernetesOrchestratorService,
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<KubernetesOrchestratorService>(
      KubernetesOrchestratorService,
    );
  });

  it('updateConfig should apply config artifact and restart', async () => {
    execFileMock.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: ExecFileCallback,
      ) => callback(null, '', ''),
    );

    await expect(
      service.updateConfig('aegis-tenants/openclaw-1', {
        openclawConfig: { gateway: { port: 18789 } },
        environment: { FEATURE_X: 'enabled' },
      }),
    ).resolves.toBeUndefined();

    expect(execFileMock).toHaveBeenCalledWith(
      'kubectl',
      expect.arrayContaining(['set', 'env', 'deployment/openclaw-1']),
      expect.any(Object),
      expect.any(Function),
    );
    expect(execFileMock).toHaveBeenCalledWith(
      'kubectl',
      expect.arrayContaining(['apply', '-f', '-']),
      expect.any(Object),
      expect.any(Function),
    );
    expect(execFileMock).toHaveBeenCalledWith(
      'kubectl',
      expect.arrayContaining(['rollout', 'restart', 'deployment/openclaw-1']),
      expect.any(Object),
      expect.any(Function),
    );
  });
});
