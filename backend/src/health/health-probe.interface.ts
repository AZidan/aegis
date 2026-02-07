/**
 * Health Probe Interface
 *
 * Defines the contract for health probe strategies.
 * Implementations can provide mock data (MVP) or real container metrics.
 */

export interface HealthProbeResult {
  status: 'healthy' | 'degraded' | 'down';
  cpuPercent: number;
  memoryMb: number;
  diskGb: number;
  uptime: number; // seconds
}

export interface HealthProbeStrategy {
  probe(tenant: {
    id: string;
    containerUrl: string | null;
  }): Promise<HealthProbeResult>;
}

export const HEALTH_PROBE_STRATEGY = 'HEALTH_PROBE_STRATEGY';
