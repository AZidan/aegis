import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { StatsService } from './stats.service';

/**
 * Stats Controller - Tenant: Dashboard Stats
 * Implements dashboard-level endpoints from API Contract.
 *
 * Requires JWT authentication and a valid tenant context.
 * TenantGuard extracts tenantId from JWT and attaches it to the request.
 *
 * Endpoints:
 * 1. GET /api/dashboard/stats          - Get Dashboard Stats
 * 2. GET /api/dashboard/stats/activity  - Get Recent Activity
 */
@Controller('dashboard/stats')
@UseGuards(JwtAuthGuard, TenantGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /**
   * Extract tenantId from request (set by TenantGuard).
   */
  private getTenantId(req: Request): string {
    return (req as Request & { tenantId: string }).tenantId;
  }

  // ==========================================================================
  // GET /api/dashboard/stats - Get Dashboard Stats
  // Contract: 200 OK
  // ==========================================================================
  @Get()
  @HttpCode(HttpStatus.OK)
  async getStats(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return this.statsService.getStats(tenantId);
  }

  // ==========================================================================
  // GET /api/dashboard/stats/activity - Get Recent Activity
  // Returns recent activity across all agents for the tenant
  // ==========================================================================
  @Get('activity')
  @HttpCode(HttpStatus.OK)
  async getRecentActivity(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return this.statsService.getRecentActivity(tenantId);
  }
}
