import { ContainerNetworkService } from '../../src/container/container-network.service';

describe('ContainerNetworkService', () => {
  let service: ContainerNetworkService;

  beforeEach(() => {
    service = new ContainerNetworkService();
  });

  it('should build deterministic container names', () => {
    expect(service.getContainerName('tenant-uuid-1')).toBe('aegis-tenant-u');
  });

  it('should build deterministic docker network names', () => {
    expect(service.getDockerNetworkName('tenant-uuid-1234')).toBe(
      'aegis-net-tenant-uuid-',
    );
  });

  it('should build kubernetes namespace-safe value', () => {
    expect(service.getKubernetesNamespace('TENANT_UUID_1')).toBe(
      'aegis-tenant-uuid-1',
    );
  });

  it('should build managed container labels', () => {
    expect(service.getContainerLabels('tenant-uuid-1')).toEqual({
      'aegis.tenantId': 'tenant-uuid-1',
      'aegis.managedBy': 'aegis-container-orchestrator',
    });
  });

  it('should build docker network labels', () => {
    expect(service.getDockerNetworkLabels('tenant-uuid-1')).toEqual({
      'aegis.tenantId': 'tenant-uuid-1',
      'aegis.managedBy': 'aegis-container-orchestrator',
      'aegis.networkScope': 'tenant',
    });
  });

  it('should build deny-ingress policy for a workload', () => {
    expect(service.buildKubernetesDenyIngressPolicy('openclaw-1')).toEqual({
      metadata: { name: 'openclaw-1-deny-ingress' },
      spec: {
        podSelector: { matchLabels: { app: 'openclaw-1' } },
        policyTypes: ['Ingress'],
        ingress: [],
      },
    });
  });
});
