import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KubernetesOrchestratorService } from '../../src/container/kubernetes-orchestrator.service';
import { ContainerNetworkService } from '../../src/container/container-network.service';
import { SecretsManagerService } from '../../src/container/secrets-manager.service';

const appsApiMock = {
  createNamespacedDeployment: jest.fn(),
  replaceNamespacedDeployment: jest.fn(),
  readNamespacedDeployment: jest.fn(),
  deleteNamespacedDeployment: jest.fn(),
};

const coreApiMock = {
  readNamespace: jest.fn(),
  createNamespace: jest.fn(),
  createNamespacedService: jest.fn(),
  replaceNamespacedService: jest.fn(),
  deleteNamespacedService: jest.fn(),
  createNamespacedConfigMap: jest.fn(),
  replaceNamespacedConfigMap: jest.fn(),
  createNamespacedSecret: jest.fn(),
  replaceNamespacedSecret: jest.fn(),
  deleteNamespacedSecret: jest.fn(),
  listNamespacedPod: jest.fn(),
  readNamespacedPodLog: jest.fn(),
};
const networkingApiMock = {
  createNamespacedNetworkPolicy: jest.fn(),
  replaceNamespacedNetworkPolicy: jest.fn(),
};

const kubeConfigMock = {
  loadFromDefault: jest.fn(),
  setCurrentContext: jest.fn(),
  makeApiClient: jest.fn(),
};

jest.mock('@kubernetes/client-node', () => {
  class MockAppsV1Api {}
  class MockCoreV1Api {}
  class MockNetworkingV1Api {}
  return {
    KubeConfig: jest.fn().mockImplementation(() => kubeConfigMock),
    AppsV1Api: MockAppsV1Api,
    CoreV1Api: MockCoreV1Api,
    NetworkingV1Api: MockNetworkingV1Api,
  };
});

describe('KubernetesOrchestratorService', () => {
  let service: KubernetesOrchestratorService;

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
    kubeConfigMock.makeApiClient.mockImplementation((apiType: unknown) => {
      const name = (apiType as { name?: string }).name;
      if (name === 'MockAppsV1Api') {
        return appsApiMock;
      }
      if (name === 'MockNetworkingV1Api') {
        return networkingApiMock;
      }
      return coreApiMock;
    });

    appsApiMock.readNamespacedDeployment.mockResolvedValue({
      metadata: { creationTimestamp: '2026-02-10T00:00:00.000Z' },
      spec: {
        replicas: 1,
        template: { spec: { containers: [{ name: 'openclaw', env: [] }] } },
      },
      status: { availableReplicas: 1, readyReplicas: 1 },
    });
    coreApiMock.listNamespacedPod.mockResolvedValue({
      items: [{ metadata: { name: 'openclaw-abc' } }],
    });
    coreApiMock.readNamespacedPodLog.mockResolvedValue('log-line');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KubernetesOrchestratorService,
        { provide: ConfigService, useValue: configServiceMock },
        ContainerNetworkService,
        SecretsManagerService,
      ],
    }).compile();

    service = module.get<KubernetesOrchestratorService>(
      KubernetesOrchestratorService,
    );
  });

  it('create should create deployment and service', async () => {
    coreApiMock.readNamespace.mockRejectedValue({ response: { statusCode: 404 } });

    const result = await service.create({
      tenantId: 'tenant-uuid-1',
      name: 'openclaw-1',
      environment: { NODE_ENV: 'production' },
      resourceLimits: { cpu: '2', memoryMb: 2048 },
    });

    expect(result.id).toBe('aegis-tenants/openclaw-1');
    expect(coreApiMock.createNamespace).toHaveBeenCalled();
    expect(coreApiMock.createNamespacedSecret).toHaveBeenCalled();
    expect(appsApiMock.createNamespacedDeployment).toHaveBeenCalled();
    expect(coreApiMock.createNamespacedService).toHaveBeenCalled();
    expect(networkingApiMock.createNamespacedNetworkPolicy).toHaveBeenCalled();
    expect(appsApiMock.createNamespacedDeployment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          spec: expect.objectContaining({
            template: expect.objectContaining({
              spec: expect.objectContaining({
                volumes: expect.arrayContaining([
                  expect.objectContaining({
                    name: 'openclaw-config',
                  }),
                ]),
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('create should upsert age-key secret', async () => {
    coreApiMock.readNamespace.mockResolvedValue({});

    await service.create({
      tenantId: 'tenant-uuid-1',
      name: 'openclaw-1',
    });

    // Should be called twice: runtime-secrets + age-key
    expect(coreApiMock.createNamespacedSecret).toHaveBeenCalledTimes(2);
    expect(coreApiMock.createNamespacedSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          metadata: { name: 'openclaw-1-age-key' },
          stringData: expect.objectContaining({
            age_key: expect.stringContaining('AGE-SECRET-KEY-1'),
          }),
        }),
      }),
    );
  });

  it('create should include age-key volume mount in deployment', async () => {
    coreApiMock.readNamespace.mockResolvedValue({});

    await service.create({
      tenantId: 'tenant-uuid-1',
      name: 'openclaw-1',
    });

    expect(appsApiMock.createNamespacedDeployment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          spec: expect.objectContaining({
            template: expect.objectContaining({
              spec: expect.objectContaining({
                volumes: expect.arrayContaining([
                  expect.objectContaining({
                    name: 'age-key',
                    secret: expect.objectContaining({
                      secretName: 'openclaw-1-age-key',
                    }),
                  }),
                ]),
                containers: expect.arrayContaining([
                  expect.objectContaining({
                    volumeMounts: expect.arrayContaining([
                      expect.objectContaining({
                        name: 'age-key',
                        mountPath: '/run/secrets/age_key',
                        subPath: 'age_key',
                        readOnly: true,
                      }),
                    ]),
                  }),
                ]),
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('getStatus should return healthy when replicas are ready', async () => {
    const status = await service.getStatus('aegis-tenants/openclaw-1');
    expect(status.state).toBe('running');
    expect(status.health).toBe('healthy');
  });

  it('getLogs should return pod logs', async () => {
    const logs = await service.getLogs('aegis-tenants/openclaw-1', {
      tailLines: 10,
      sinceSeconds: 30,
    });

    expect(logs).toBe('log-line');
    expect(coreApiMock.listNamespacedPod).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: 'aegis-tenants',
        labelSelector: 'app=openclaw-1',
        limit: 1,
      }),
    );
  });

  it('updateConfig should update config and restart', async () => {
    await service.updateConfig('aegis-tenants/openclaw-1', {
      openclawConfig: { gateway: { port: 18789 } },
      environment: { FEATURE_X: 'enabled' },
    });

    expect(coreApiMock.createNamespacedConfigMap).toHaveBeenCalled();
    expect(appsApiMock.replaceNamespacedDeployment).toHaveBeenCalled();
  });
});
