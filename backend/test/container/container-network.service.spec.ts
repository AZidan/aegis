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
});
