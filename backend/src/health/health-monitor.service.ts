import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from '../admin/tenants/tenants.service';
import { HealthProbeResult } from './health-probe.interface';
import { HealthStatus, AlertSeverity } from '../../prisma/generated/client';

export const HEALTH_REDIS_CLIENT = 'HEALTH_REDIS_CLIENT';

/** Maximum consecutive failures before creating an alert */
const MAX_CONSECUTIVE_FAILURES = 3;

/** Maximum auto-restarts per hour before circuit breaker trips */
const MAX_RESTARTS_PER_HOUR = 3;

/** TTL for restart counter key in seconds (1 hour) */
const RESTART_COUNTER_TTL = 3600;

@Injectable()
export class HealthMonitorService {
  private readonly logger = new Logger(HealthMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: TenantsService,
    @Inject(HEALTH_REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Process a health probe result for a tenant.
   * Stores the metric in the database, then evaluates health and triggers actions.
   */
  async processHealthResult(
    tenantId: string,
    result: HealthProbeResult,
  ): Promise<void> {
    // Store metric in ContainerHealth table
    await this.prisma.containerHealth.create({
      data: {
        tenantId,
        status: result.status as HealthStatus,
        cpuPercent: result.cpuPercent,
        memoryMb: result.memoryMb,
        diskGb: result.diskGb,
        uptime: result.uptime,
      },
    });

    // Evaluate health status and take action
    await this.evaluateHealth(tenantId, result.status);

    // If container is down, attempt auto-restart
    if (result.status === 'down') {
      await this.handleAutoRestart(tenantId);
    }
  }

  /**
   * Evaluate tenant health status.
   * Tracks consecutive failures in Redis and creates alerts when threshold is exceeded.
   */
  async evaluateHealth(tenantId: string, status: string): Promise<void> {
    const failureKey = `health:failures:${tenantId}`;

    if (status === 'healthy') {
      // Reset failure counter on healthy status
      await this.redis.del(failureKey);

      // Recover tenant status if it was marked failed by the circuit breaker
      try {
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { status: true },
        });
        if (tenant?.status === 'failed') {
          await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { status: 'active' },
          });
          this.logger.log(
            `Tenant ${tenantId} recovered: status changed from failed to active`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to recover tenant ${tenantId} status`,
          error instanceof Error ? error.stack : String(error),
        );
      }

      return;
    }

    // Increment consecutive failure counter
    const failures = await this.redis.incr(failureKey);

    this.logger.warn(
      `Tenant ${tenantId} health check: status=${status}, consecutive failures=${failures}`,
    );

    // Create alert if we hit the threshold
    if (failures === MAX_CONSECUTIVE_FAILURES) {
      const severity: 'warning' | 'critical' =
        status === 'down' ? 'critical' : 'warning';

      await this.createAlert(
        tenantId,
        severity,
        `Container ${status}: ${tenantId}`,
        `Tenant ${tenantId} container has been ${status} for ${failures} consecutive health checks. Immediate attention may be required.`,
      );
    }
  }

  /**
   * Handle auto-restart logic with circuit breaker.
   * Uses Redis INCR with 1-hour TTL to track restart count.
   * Circuit breaker trips at MAX_RESTARTS_PER_HOUR, marking tenant as failed.
   */
  async handleAutoRestart(tenantId: string): Promise<void> {
    const restartKey = `health:restarts:${tenantId}`;

    // Increment restart counter
    const restartCount = await this.redis.incr(restartKey);

    // Set TTL only on first increment (when key is newly created)
    if (restartCount === 1) {
      await this.redis.expire(restartKey, RESTART_COUNTER_TTL);
    }

    if (restartCount <= MAX_RESTARTS_PER_HOUR) {
      // Attempt restart
      this.logger.log(
        `Auto-restarting container for tenant ${tenantId} (restart ${restartCount}/${MAX_RESTARTS_PER_HOUR} this hour)`,
      );

      try {
        await this.tenantsService.restartContainer(tenantId);

        await this.createAlert(
          tenantId,
          'warning',
          `Auto-restart initiated: ${tenantId}`,
          `Container for tenant ${tenantId} was automatically restarted (attempt ${restartCount}/${MAX_RESTARTS_PER_HOUR} this hour).`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to auto-restart container for tenant ${tenantId}`,
          error instanceof Error ? error.stack : String(error),
        );

        await this.createAlert(
          tenantId,
          'critical',
          `Auto-restart failed: ${tenantId}`,
          `Failed to restart container for tenant ${tenantId}. Error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      // Circuit breaker tripped: too many restarts in 1 hour
      this.logger.error(
        `Circuit breaker tripped for tenant ${tenantId}: ${restartCount} restarts in the last hour (max ${MAX_RESTARTS_PER_HOUR})`,
      );

      // Update tenant status to failed
      try {
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: { status: 'failed' },
        });
      } catch (error) {
        this.logger.error(
          `Failed to update tenant ${tenantId} status to failed`,
          error instanceof Error ? error.stack : String(error),
        );
      }

      await this.createAlert(
        tenantId,
        'critical',
        `Circuit breaker tripped: ${tenantId}`,
        `Tenant ${tenantId} has exceeded the maximum of ${MAX_RESTARTS_PER_HOUR} auto-restarts per hour. Container marked as failed. Manual intervention required.`,
      );
    }
  }

  /**
   * Create an alert record in the database.
   */
  async createAlert(
    tenantId: string,
    severity: 'info' | 'warning' | 'critical',
    title: string,
    message: string,
  ): Promise<void> {
    try {
      await this.prisma.alert.create({
        data: {
          tenantId,
          severity: severity as AlertSeverity,
          title,
          message,
        },
      });

      this.logger.log(
        `Alert created: [${severity.toUpperCase()}] ${title}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create alert for tenant ${tenantId}: ${title}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
