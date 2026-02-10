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
import { MessagingService } from './messaging.service';
import {
  exportMessagesSchema,
  ExportMessagesDto,
} from './dto/export-messages.dto';
import { MESSAGE_CSV_HEADERS } from './messaging.constants';

/**
 * Message Dashboard Controller
 *
 * Provides tenant-level message dashboard endpoints for export and statistics.
 * All endpoints require JWT authentication and a valid tenant context.
 *
 * IMPORTANT: This controller is registered BEFORE MessagingController in the
 * module to ensure specific paths (/messages/export, /messages/stats) are matched
 * before any wildcard routes.
 *
 * Endpoints:
 * 1. GET /api/dashboard/messages/export  - Export messages as CSV or JSON
 * 2. GET /api/dashboard/messages/stats   - Get message statistics
 */
@Controller('dashboard/messages')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MessageDashboardController {
  constructor(private readonly messagingService: MessagingService) {}

  /**
   * Extract tenantId from request (set by TenantGuard).
   */
  private getTenantId(req: Request): string {
    return (req as Request & { tenantId: string }).tenantId;
  }

  // ==========================================================================
  // GET /api/dashboard/messages/export - Export Messages
  // Returns CSV or JSON file as a download attachment.
  // Content-Disposition: attachment; filename="messages-YYYY-MM-DD.{format}"
  // Max 10,000 rows.
  // ==========================================================================
  @Get('export')
  async exportMessages(
    @Query(new ZodValidationPipe(exportMessagesSchema))
    query: ExportMessagesDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenantId = this.getTenantId(req);
    const { format, ...filters } = query;

    const rows = await this.messagingService.exportTenantMessages(
      tenantId,
      filters,
    );

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `messages-${dateStr}.${format}`;

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

  // ==========================================================================
  // GET /api/dashboard/messages/stats - Message Statistics
  // Returns aggregate stats for the tenant dashboard.
  // ==========================================================================
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getMessageStats(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return this.messagingService.getMessageStats(tenantId);
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Stream message rows as CSV to the response.
   * Writes header row first, then each data row incrementally.
   */
  private streamCsv(res: Response, rows: any[]): void {
    // Write CSV header
    res.write(MESSAGE_CSV_HEADERS.join(',') + '\n');

    // Write each row
    for (const row of rows) {
      const values = MESSAGE_CSV_HEADERS.map((header) => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        if (val instanceof Date) return val.toISOString();
        if (typeof val === 'object')
          return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
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
   * Stream message rows as JSON array to the response.
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
