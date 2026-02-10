import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PassThrough } from 'node:stream';
import { DockerOrchestratorService } from '../../src/container/docker-orchestrator.service';
import { KubernetesOrchestratorService } from '../../src/container/kubernetes-orchestrator.service';
import { ContainerOrchestrator } from '../../src/container/interfaces/container-orchestrator.interface';

const dockerContainerMock = {
  id: 'container-123',
  start: jest.fn().mockResolvedValue(undefined),
  inspect: jest.fn().mockResolvedValue({
    State: {
      Status: 'running',
      Running: true,
      Health: { Status: 'healthy' },
      StartedAt: '2026-02-10T00:00:00.000Z',
    },
  }),
  restart: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  logs: jest.fn().mockResolvedValue(Buffer.from('out')),
  exec: jest.fn().mockResolvedValue({
    start: jest.fn().mockImplementation(async () => {
      const stream = new PassThrough();
      setImmediate(() => stream.end());
      return stream;
    }),
    inspect: jest.fn().mockResolvedValue({ ExitCode: 0 }),
  }),
};
const dockerClientMock = {
  createContainer: jest.fn().mockResolvedValue(dockerContainerMock),
  getContainer: jest.fn().mockReturnValue(dockerContainerMock),
  listNetworks: jest.fn().mockResolvedValue([{ Name: 'aegis-tenant-network' }]),
  createNetwork: jest.fn().mockResolvedValue(undefined),
};

const appsApiMock = {
  createNamespacedDeployment: jest.fn(),
  replaceNamespacedDeployment: jest.fn(),
  readNamespacedDeployment: jest.fn().mockResolvedValue({
    metadata: { creationTimestamp: '2026-02-10T00:00:00.000Z' },
    spec: {
      replicas: 1,
      template: { spec: { containers: [{ name: 'openclaw', env: [] }] } },
    },
    status: { availableReplicas: 1, readyReplicas: 1 },
  }),
  deleteNamespacedDeployment: jest.fn(),
};
const coreApiMock = {
  readNamespace: jest.fn().mockResolvedValue({}),
  createNamespace: jest.fn(),
  createNamespacedService: jest.fn(),
  replaceNamespacedService: jest.fn(),
  deleteNamespacedService: jest.fn(),
  createNamespacedConfigMap: jest.fn(),
  replaceNamespacedConfigMap: jest.fn(),
  listNamespacedPod: jest.fn().mockResolvedValue({
    items: [{ metadata: { name: 'openclaw-1-abc' } }],
  }),
  readNamespacedPodLog: jest.fn().mockResolvedValue('out'),
};
const kubeConfigMock = {
  loadFromDefault: jest.fn(),
  setCurrentContext: jest.fn(),
  makeApiClient: jest.fn((apiType: { name?: string }) =>
    apiType.name === 'MockAppsV1Api' ? appsApiMock : coreApiMock,
  ),
};

jest.mock('dockerode', () =>
  jest.fn().mockImplementation(() => dockerClientMock),
);
jest.mock('@kubernetes/client-node', () => {
  class MockAppsV1Api {}
  class MockCoreV1Api {}
  return {
    KubeConfig: jest.fn().mockImplementation(() => kubeConfigMock),
    AppsV1Api: MockAppsV1Api,
    CoreV1Api: MockCoreV1Api,
  };
});

type RuntimeCase = {
  runtime: 'docker' | 'kubernetes';
  provider: new (...args: never[]) => ContainerOrchestrator;
  containerId: string;
};

const CASES: RuntimeCase[] = [
  {
    runtime: 'docker',
    provider: DockerOrchestratorService,
    containerId: 'container-123',
  },
  {
    runtime: 'kubernetes',
    provider: KubernetesOrchestratorService,
    containerId: 'aegis-tenants/openclaw-1',
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
      await expect(service.restart(runtimeCase.containerId)).resolves.toBeUndefined();
    });

    it('getStatus should map to running/healthy', async () => {
      const status = await service.getStatus(runtimeCase.containerId);
      expect(status.state).toBe('running');
      expect(status.health).toBe('healthy');
    });

    it('getLogs should support tail and since options', async () => {
      const logs = await service.getLogs(runtimeCase.containerId, {
        tailLines: 25,
        sinceSeconds: 90,
      });
      expect(logs).toContain('out');
    });

    it('updateConfig should resolve', async () => {
      await expect(
        service.updateConfig(runtimeCase.containerId, {
          openclawConfig: { gateway: { port: 18789 } },
        }),
      ).resolves.toBeUndefined();
    });
  });
});
