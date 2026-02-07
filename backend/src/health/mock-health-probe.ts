import { Injectable, Logger } from '@nestjs/common';
import {
  HealthProbeStrategy,
  HealthProbeResult,
} from './health-probe.interface';

/**
 * Mock Health Probe
 *
 * Generates realistic simulated health metrics for MVP.
 * Will be replaced by a real container probe in a future sprint.
 */
@Injectable()
export class MockHealthProbe implements HealthProbeStrategy {
  private readonly logger = new Logger(MockHealthProbe.name);

  async probe(tenant: {
    id: string;
    containerUrl: string | null;
  }): Promise<HealthProbeResult> {
    // Determine status with weighted probabilities
    // ~93% healthy, ~5% degraded, ~2% down
    const roll = Math.random() * 100;
    let status: HealthProbeResult['status'];

    if (roll < 2) {
      status = 'down';
    } else if (roll < 7) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    // Generate realistic resource metrics
    const cpuPercent = this.randomInRange(5, 85);
    const memoryMb = this.randomInRange(30, 80);
    const diskGb = this.randomInRange(15, 60);

    // Uptime: simulate a container that has been running between 1 minute and 30 days
    const minUptime = 60; // 1 minute
    const maxUptime = 30 * 24 * 60 * 60; // 30 days in seconds
    const uptime = Math.floor(
      minUptime + Math.random() * (maxUptime - minUptime),
    );

    // If status is down, metrics should reflect that
    const result: HealthProbeResult = {
      status,
      cpuPercent: status === 'down' ? 0 : cpuPercent,
      memoryMb: status === 'down' ? 0 : memoryMb,
      diskGb: status === 'down' ? diskGb : diskGb, // disk persists even when down
      uptime: status === 'down' ? 0 : uptime,
    };

    this.logger.debug(
      `Probed tenant ${tenant.id}: status=${result.status}, cpu=${result.cpuPercent}%`,
    );

    return result;
  }

  /**
   * Generate a random float in the given range, rounded to 1 decimal place.
   */
  private randomInRange(min: number, max: number): number {
    return Math.round((min + Math.random() * (max - min)) * 10) / 10;
  }
}
