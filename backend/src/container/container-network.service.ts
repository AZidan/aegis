import { Injectable } from '@nestjs/common';
import type { V1NetworkPolicy } from '@kubernetes/client-node';

@Injectable()
export class ContainerNetworkService {
  getContainerName(tenantId: string): string {
    return `aegis-${this.sanitizeAlphaNumDash(tenantId, 8)}`;
  }

  getDockerNetworkName(tenantId: string): string {
    return `aegis-net-${this.sanitizeAlphaNumDash(tenantId, 12)}`;
  }

  getKubernetesNamespace(tenantId: string): string {
    const normalized = tenantId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const compact = normalized.replace(/-+/g, '-').replace(/^-|-$/g, '');
    return `aegis-${compact.slice(0, 50)}`;
  }

  getContainerLabels(tenantId: string): Record<string, string> {
    return {
      'aegis.tenantId': tenantId,
      'aegis.managedBy': 'aegis-container-orchestrator',
    };
  }

  getDockerNetworkLabels(tenantId: string): Record<string, string> {
    return {
      ...this.getContainerLabels(tenantId),
      'aegis.networkScope': 'tenant',
    };
  }

  buildKubernetesDenyIngressPolicy(name: string): V1NetworkPolicy {
    return {
      metadata: { name: `${name}-deny-ingress` },
      spec: {
        podSelector: { matchLabels: { app: name } },
        policyTypes: ['Ingress'],
        ingress: [],
      },
    };
  }

  private sanitizeAlphaNumDash(value: string, maxLength: number): string {
    return value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, maxLength);
  }
}
