import { Injectable, Logger } from '@nestjs/common';
import {
  HealthProbeResult,
  HealthProbeStrategy,
} from './health-probe.interface';

interface RawHealthResponse {
  status?: string;
  cpuPercent?: number;
  memoryMb?: number;
  diskGb?: number;
  uptime?: number;
  cpu?: number;
  memory?: number;
  disk?: number;
}

@Injectable()
export class DockerHealthProbe implements HealthProbeStrategy {
  private readonly logger = new Logger(DockerHealthProbe.name);
  private readonly timeoutMs = 5_000;

  async probe(tenant: {
    id: string;
    containerUrl: string | null;
  }): Promise<HealthProbeResult> {
    if (!tenant.containerUrl) {
      return {
        status: 'down',
        cpuPercent: 0,
        memoryMb: 0,
        diskGb: 0,
        uptime: 0,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${tenant.containerUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        // A non-2xx response still means the process is listening.
        // OpenClaw returns 404 for HTTP requests (it's a WebSocket gateway).
        // Treat any HTTP response as "healthy" — connection refused = down.
        if (response.status === 404 || response.status === 426) {
          return {
            status: 'healthy',
            cpuPercent: 0,
            memoryMb: 0,
            diskGb: 0,
            uptime: 0,
          };
        }
        this.logger.warn(
          `Health endpoint returned ${response.status} for tenant ${tenant.id}`,
        );
        return this.down();
      }

      const payload = (await response.json()) as RawHealthResponse;
      return this.mapPayload(payload);
    } catch (error) {
      this.logger.warn(
        `Health probe failed for tenant ${tenant.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.down();
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapPayload(payload: RawHealthResponse): HealthProbeResult {
    const rawStatus = payload.status?.toLowerCase();
    const status: HealthProbeResult['status'] =
      rawStatus === 'healthy' || rawStatus === 'degraded' || rawStatus === 'down'
        ? rawStatus
        : 'healthy';

    const cpuPercent = this.asNumber(payload.cpuPercent ?? payload.cpu);
    const memoryMb = this.asNumber(payload.memoryMb ?? payload.memory);
    const diskGb = this.asNumber(payload.diskGb ?? payload.disk);
    const uptime = this.asNumber(payload.uptime);

    return {
      status,
      cpuPercent,
      memoryMb,
      diskGb,
      uptime,
    };
  }

  private asNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private down(): HealthProbeResult {
    return {
      status: 'down',
      cpuPercent: 0,
      memoryMb: 0,
      diskGb: 0,
      uptime: 0,
    };
  }
}
