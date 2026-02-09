import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
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
 * Audit Controller - Tenant Dashboard Audit Endpoints
 *
 * Provides audit log query and export for tenant users.
 * The tenantId is always forced from the JWT/TenantGuard context,
 * ensuring tenants can only see their own audit logs.
 *
 * Endpoints:
 * 1. GET /api/dashboard/audit         - Query audit logs (cursor-based pagination)
 * 2. GET /api/dashboard/audit/export  - Export audit logs (CSV or JSON, streaming)
 *
 * Contract Reference: Section 9 - Tenant: Audit
 */
@Controller('dashboard/audit')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Extract tenantId from request (set by TenantGuard).
   */
  private getTenantId(req: Request): string {
    return (req as Request & { tenantId: string }).tenantId;
  }

  // ==========================================================================
  // GET /api/dashboard/audit - Query Audit Logs
  // Contract: 200 OK, cursor-based pagination
  // ==========================================================================
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAuditLogs(
    @Query(new ZodValidationPipe(queryAuditLogSchema))
    query: QueryAuditLogDto,
    @Req() req: Request,
  ) {
    const tenantId = this.getTenantId(req);
    // Force tenantId from JWT context — tenant can only see own logs
    return this.auditService.queryLogs({ ...query, tenantId });
  }

  // ==========================================================================
  // GET /api/dashboard/audit/export - Export Audit Logs
  // Contract: 200 OK, streaming CSV or JSON
  // Content-Disposition: attachment; filename="audit-log-YYYY-MM-DD.{format}"
  // Max 10,000 rows
  // ==========================================================================
  @Get('export')
  async exportAuditLogs(
    @Query(new ZodValidationPipe(exportAuditLogSchema))
    query: ExportAuditLogDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenantId = this.getTenantId(req);
    const { format, ...filters } = query;

    // Fetch export data with forced tenantId
    const rows = await this.auditService.exportLogs({
      ...filters,
      tenantId,
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
    // Write CSV header
    res.write(AUDIT_CSV_HEADERS.join(',') + '\n');

    // Write each row
    for (const row of rows) {
      const values = AUDIT_CSV_HEADERS.map((header) => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        if (val instanceof Date) return val.toISOString();
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        const str = String(val);
        // Escape CSV fields that contain commas, quotes, or newlines
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
