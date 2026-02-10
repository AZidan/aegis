import { Injectable } from '@nestjs/common';

@Injectable()
export class ContainerNetworkService {
  getContainerName(tenantId: string): string {
    return `aegis-${tenantId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 8)}`;
  }

  getDockerNetworkName(tenantId: string): string {
    return `aegis-net-${tenantId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 12)}`;
  }

  getKubernetesNamespace(tenantId: string): string {
    const normalized = tenantId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const compact = normalized.replace(/-+/g, '-').replace(/^-|-$/g, '');
    return `aegis-${compact.slice(0, 50)}`;
  }
}
