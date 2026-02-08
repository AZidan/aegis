import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { AuditEventPayload } from './interfaces/audit-event.interface';
import {
  AUDIT_QUEUE_NAME,
  SENSITIVE_FIELDS_PATTERN,
  REDACTED_VALUE,
  AUDIT_PAGE_SIZE_DEFAULT,
  AUDIT_PAGE_SIZE_MAX,
} from './audit.constants';

/**
 * AuditService
 *
 * Core service for the audit subsystem. Provides:
 * - logAction(): enqueues an audit event to BullMQ (fire-and-forget, zero latency impact)
 * - queryLogs(): cursor-based paginated queries against the audit_logs table
 *
 * Sensitive fields (passwords, tokens, secrets) are sanitized BEFORE enqueuing,
 * ensuring they never enter the queue or database.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectQueue(AUDIT_QUEUE_NAME) private readonly auditQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enqueue an audit event to BullMQ for async persistence.
   * This method is fire-and-forget — it never awaits the DB write.
   * Errors are caught and logged to avoid impacting the caller.
   */
  async logAction(event: CreateAuditLogDto): Promise<void> {
    try {
      const payload: AuditEventPayload = {
        actorType: event.actorType,
        actorId: event.actorId,
        actorName: event.actorName,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        details: event.details ? this.sanitizeDetails(event.details) : null,
        severity: event.severity || 'info',
        ipAddress: event.ipAddress || null,
        userAgent: event.userAgent || null,
        tenantId: event.tenantId || null,
        userId: event.userId || null,
        agentId: event.agentId || null,
      };

      await this.auditQueue.add('audit-log', payload, {
        removeOnComplete: true,
        removeOnFail: 1000,
      });
    } catch (error) {
      // Audit failures must never crash the app or impact the caller
      this.logger.error(
        `Failed to enqueue audit event: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Query audit logs with filters and cursor-based pagination.
   *
   * Returns paginated results ordered by timestamp DESC.
   * Uses cursor-based pagination with the audit log id for stable cursors.
   */
  async queryLogs(filters: QueryAuditLogDto) {
    const limit = Math.min(
      filters.limit || AUDIT_PAGE_SIZE_DEFAULT,
      AUDIT_PAGE_SIZE_MAX,
    );

    const where: Record<string, unknown> = {};

    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.agentId) where.agentId = filters.agentId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.targetType) where.targetType = filters.targetType;
    if (filters.severity) where.severity = filters.severity;

    if (filters.dateFrom || filters.dateTo) {
      const timestamp: Record<string, Date> = {};
      if (filters.dateFrom) timestamp.gte = filters.dateFrom;
      if (filters.dateTo) timestamp.lte = filters.dateTo;
      where.timestamp = timestamp;
    }

    const queryArgs: Record<string, unknown> = {
      where,
      orderBy: { timestamp: 'desc' as const },
      take: limit + 1, // Fetch one extra to determine if there's a next page
    };

    if (filters.cursor) {
      queryArgs.cursor = { id: filters.cursor };
      queryArgs.skip = 1; // Skip the cursor item itself
    }

    const results = await this.prisma.auditLog.findMany(queryArgs as any);

    const hasNextPage = results.length > limit;
    const data = hasNextPage ? results.slice(0, limit) : results;
    const nextCursor = hasNextPage ? data[data.length - 1]?.id : null;

    return {
      data,
      meta: {
        count: data.length,
        hasNextPage,
        nextCursor,
      },
    };
  }

  /**
   * Recursively sanitize an object, replacing values of sensitive keys with [REDACTED].
   * Deep-clones the input to avoid mutating the original.
   */
  private sanitizeDetails(
    details: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!details || typeof details !== 'object') {
      return details;
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details)) {
      if (SENSITIVE_FIELDS_PATTERN.test(key)) {
        sanitized[key] = REDACTED_VALUE;
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeDetails(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) =>
          item && typeof item === 'object'
            ? this.sanitizeDetails(item as Record<string, unknown>)
            : item,
        );
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
