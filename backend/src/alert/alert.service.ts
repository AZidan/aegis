import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { QueryAlertDto } from './dto/query-alert.dto';
import { ALERT_SUPPRESSION_WINDOW_MS } from './alert.constants';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * Create a new alert, respecting suppression windows.
   * Returns null if the alert was suppressed.
   */
  async createAlert(dto: CreateAlertDto) {
    // Check suppression
    const suppressed = await this.checkSuppression(dto.ruleId, dto.tenantId);
    if (suppressed) {
      this.logger.debug(
        `Alert suppressed for rule ${dto.ruleId} (tenant: ${dto.tenantId ?? 'global'})`,
      );
      return null;
    }

    const alert = await this.prisma.alert.create({
      data: {
        severity: dto.severity as any,
        title: dto.title,
        message: dto.message,
        tenantId: dto.tenantId ?? undefined,
      },
    });

    // Set suppression
    await this.setSuppression(dto.ruleId, dto.tenantId);

    this.logger.log(
      `Alert created: ${alert.id} [${dto.severity}] ${dto.title}`,
    );

    return alert;
  }

  /**
   * Query alerts with optional filters.
   */
  async queryAlerts(dto: QueryAlertDto) {
    const where: Record<string, unknown> = {};

    if (dto.severity !== undefined) {
      where.severity = dto.severity;
    }
    if (dto.resolved !== undefined) {
      where.resolved = dto.resolved;
    }

    const alerts = await this.prisma.alert.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: dto.limit,
    });

    return {
      data: alerts.map((a) => ({
        id: a.id,
        severity: a.severity,
        title: a.title,
        message: a.message,
        tenantId: a.tenantId,
        resolved: a.resolved,
        resolvedAt: a.resolvedAt?.toISOString() ?? null,
        resolvedBy: a.resolvedBy,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Resolve an alert by ID.
   */
  async resolveAlert(alertId: string, resolvedBy: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    const updated = await this.prisma.alert.update({
      where: { id: alertId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
      },
    });

    this.logger.log(`Alert ${alertId} resolved by ${resolvedBy}`);

    return {
      id: updated.id,
      severity: updated.severity,
      title: updated.title,
      message: updated.message,
      tenantId: updated.tenantId,
      resolved: updated.resolved,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      resolvedBy: updated.resolvedBy,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Check if an alert for this rule is currently suppressed.
   */
  async checkSuppression(ruleId: string, tenantId?: string): Promise<boolean> {
    const key = this.suppressionKey(ruleId, tenantId);
    const val = await this.cache.get(key);
    return val !== null && val !== undefined;
  }

  /**
   * Set suppression for a rule (prevents duplicate alerts in the window).
   */
  async setSuppression(ruleId: string, tenantId?: string): Promise<void> {
    const key = this.suppressionKey(ruleId, tenantId);
    await this.cache.set(key, '1', ALERT_SUPPRESSION_WINDOW_MS);
  }

  private suppressionKey(ruleId: string, tenantId?: string): string {
    return `alert-suppress:${ruleId}:${tenantId ?? 'global'}`;
  }
}
