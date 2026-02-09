import {
  Controller,
  Get,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/validation.pipe';
import { AuditService } from './audit.service';
import {
  queryAuditLogSchema,
  QueryAuditLogDto,
} from './dto/query-audit-log.dto';
import {
  exportAuditLogSchema,
  ExportAuditLogDto,
} from './dto/export-audit-log.dto';
import { AUDIT_CSV_HEADERS, AUDIT_EXPORT_MAX_ROWS } from './audit.constants';

/**
 * Audit Admin Controller - Platform Admin Audit Endpoints
 *
 * Provides cross-tenant audit log query and export for platform administrators.
 * Unlike the tenant controller, the tenantId is NOT forced -- admins may
 * optionally filter by tenantId via query param, or see all tenants.
 *
 * Endpoints:
 * 1. GET /api/admin/audit-logs         - Query audit logs (cursor-based, cross-tenant)
 * 2. GET /api/admin/audit-logs/export  - Export audit logs (CSV or JSON, cross-tenant)
 *
 * All endpoints require platform_admin role.
 */
@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditAdminController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Verify the authenticated user has the platform_admin role.
   * Throws ForbiddenException if not.
   */
  private assertPlatformAdmin(user: { role: string }): void {
    if (user.role !== 'platform_admin') {
      throw new ForbiddenException('Requires platform_admin role');
    }
  }

  // ==========================================================================
  // GET /api/admin/audit-logs - Query Audit Logs (Cross-Tenant)
  // Requires: platform_admin role
  // ==========================================================================
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAuditLogs(
    @Query(new ZodValidationPipe(queryAuditLogSchema))
    query: QueryAuditLogDto,
    @CurrentUser() user: { role: string },
  ) {
    this.assertPlatformAdmin(user);
    // No tenantId forced — admin sees all tenants
    // Optional tenantId filter from query params
    return this.auditService.queryLogs(query);
  }

  // ==========================================================================
  // GET /api/admin/audit-logs/export - Export Audit Logs (Cross-Tenant)
  // Requires: platform_admin role
  // Streams CSV or JSON
  // ==========================================================================
  @Get('export')
  async exportAuditLogs(
    @Query(new ZodValidationPipe(exportAuditLogSchema))
    query: ExportAuditLogDto,
    @CurrentUser() user: { role: string },
    @Res() res: Response,
  ) {
    this.assertPlatformAdmin(user);

    const { format, ...filters } = query;

    const rows = await this.auditService.exportLogs({
      ...filters,
      maxRows: AUDIT_EXPORT_MAX_ROWS,
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `audit-log-${dateStr}.${format}`;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      this.streamCsv(res, rows);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      this.streamJson(res, rows);
    }
  }

  /**
   * Stream audit log rows as CSV to the response.
   * Writes header row first, then each data row incrementally.
   */
  private streamCsv(res: Response, rows: any[]): void {
    res.write(AUDIT_CSV_HEADERS.join(',') + '\n');

    for (const row of rows) {
      const values = AUDIT_CSV_HEADERS.map((header) => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        if (val instanceof Date) return val.toISOString();
        if (typeof val === 'object')
          return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      res.write(values.join(',') + '\n');
    }

    res.end();
  }

  /**
   * Stream audit log rows as JSON array to the response.
   * Writes opening bracket, each record, then closing bracket.
   */
  private streamJson(res: Response, rows: any[]): void {
    res.write('[\n');
    for (let i = 0; i < rows.length; i++) {
      const json = JSON.stringify(rows[i]);
      if (i < rows.length - 1) {
        res.write(json + ',\n');
      } else {
        res.write(json + '\n');
      }
    }
    res.write(']\n');
    res.end();
  }
}
