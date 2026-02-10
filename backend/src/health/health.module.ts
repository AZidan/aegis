import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { TenantsModule } from '../admin/tenants/tenants.module';
import { HealthMonitorService, HEALTH_REDIS_CLIENT } from './health-monitor.service';
import { HealthCheckProcessor } from './health-check.processor';
import { HealthCleanupProcessor } from './health-cleanup.processor';
import { MockHealthProbe } from './mock-health-probe';
import { HEALTH_PROBE_STRATEGY } from './health-probe.interface';
import { DockerHealthProbe } from './docker-health-probe';

/**
 * Health Module
 *
 * Provides container health monitoring for all active tenants.
 *
 * Features:
 * - Periodic health probing via BullMQ repeatable jobs (every 30s)
 * - Auto-restart with circuit breaker (max 3 restarts/hour)
 * - Alert creation on consecutive failures
 * - Daily cleanup of old health records (3 AM)
 *
 * Dependencies:
 * - PrismaModule (global, auto-imported)
 * - TenantsModule (for TenantsService.restartContainer)
 * - Redis (for failure/restart tracking via ioredis)
 * - BullMQ (for job scheduling)
 */
@Module({
  imports: [
    TenantsModule,
    BullModule.registerQueue(
      { name: 'health-check' },
      { name: 'health-cleanup' },
    ),
  ],
  providers: [
    HealthMonitorService,
    HealthCheckProcessor,
    HealthCleanupProcessor,
    MockHealthProbe,
    DockerHealthProbe,
    {
      provide: HEALTH_PROBE_STRATEGY,
      inject: [ConfigService, MockHealthProbe, DockerHealthProbe],
      useFactory: (
        configService: ConfigService,
        mockProbe: MockHealthProbe,
        dockerProbe: DockerHealthProbe,
      ) => {
        const runtime = configService.get<string>('container.runtime', 'mock');
        return runtime === 'mock' ? mockProbe : dockerProbe;
      },
    },
    {
      provide: HEALTH_REDIS_CLIENT,
      useFactory: () => {
        const host = process.env.REDIS_HOST || 'localhost';
        const port = parseInt(process.env.REDIS_PORT || '6379', 10);
        const password = process.env.REDIS_PASSWORD || undefined;

        return new Redis({
          host,
          port,
          password,
          maxRetriesPerRequest: null, // Required by BullMQ compatibility
          lazyConnect: true,
        });
      },
    },
  ],
  exports: [HealthMonitorService],
})
export class HealthModule implements OnModuleInit {
  private readonly logger = new Logger(HealthModule.name);

  constructor(
    @InjectQueue('health-check') private readonly healthCheckQueue: Queue,
    @InjectQueue('health-cleanup') private readonly healthCleanupQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Remove any existing repeatable jobs to avoid duplicates on restart
    const existingCheckJobs =
      await this.healthCheckQueue.getRepeatableJobs();
    for (const job of existingCheckJobs) {
      await this.healthCheckQueue.removeRepeatableByKey(job.key);
    }

    const existingCleanupJobs =
      await this.healthCleanupQueue.getRepeatableJobs();
    for (const job of existingCleanupJobs) {
      await this.healthCleanupQueue.removeRepeatableByKey(job.key);
    }

    // Register repeatable health check job: every 30 seconds
    await this.healthCheckQueue.add(
      'check-all-tenants',
      {},
      {
        repeat: {
          every: 30_000, // 30 seconds in milliseconds
        },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 50 },
      },
    );

    this.logger.log('Registered repeatable job: check-all-tenants (every 30s)');

    // Register repeatable cleanup job: daily at 3 AM
    await this.healthCleanupQueue.add(
      'cleanup-old-records',
      {},
      {
        repeat: {
          pattern: '0 3 * * *', // Daily at 3:00 AM
        },
        removeOnComplete: { count: 5 },
        removeOnFail: { count: 10 },
      },
    );

    this.logger.log(
      'Registered repeatable job: cleanup-old-records (daily at 3:00 AM)',
    );
  }
}
