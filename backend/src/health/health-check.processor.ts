import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  HealthProbeStrategy,
  HEALTH_PROBE_STRATEGY,
} from './health-probe.interface';
import { HealthMonitorService } from './health-monitor.service';

/**
 * Health Check Processor
 *
 * BullMQ worker that periodically probes all active tenant containers
 * and processes the results through the HealthMonitorService.
 */
@Processor('health-check')
export class HealthCheckProcessor extends WorkerHost {
  private readonly logger = new Logger(HealthCheckProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(HEALTH_PROBE_STRATEGY)
    private readonly healthProbe: HealthProbeStrategy,
    private readonly healthMonitor: HealthMonitorService,
  ) {
    super();
  }

  async process(job: Job<unknown, unknown, string>): Promise<void> {
    switch (job.name) {
      case 'check-all-tenants':
        await this.checkAllTenants();
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  /**
   * Query all active tenants and probe their container health.
   */
  private async checkAllTenants(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        containerUrl: true,
      },
    });

    if (tenants.length === 0) {
      this.logger.debug('No active tenants to check');
      return;
    }

    let healthy = 0;
    let degraded = 0;
    let down = 0;

    for (const tenant of tenants) {
      try {
        const result = await this.healthProbe.probe({
          id: tenant.id,
          containerUrl: tenant.containerUrl,
        });

        await this.healthMonitor.processHealthResult(tenant.id, result);

        // Tally results
        switch (result.status) {
          case 'healthy':
            healthy++;
            break;
          case 'degraded':
            degraded++;
            break;
          case 'down':
            down++;
            break;
        }
      } catch (error) {
        this.logger.error(
          `Failed to probe tenant ${tenant.id}`,
          error instanceof Error ? error.stack : String(error),
        );
        down++;
      }
    }

    this.logger.log(
      `Health check complete: ${tenants.length} tenants checked, ${healthy} healthy, ${degraded} degraded, ${down} down`,
    );
  }
}
