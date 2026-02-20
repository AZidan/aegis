import {
  Controller,
  Get,
  UseGuards,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

/**
 * Dashboard Controller - Platform Admin Dashboard Home
 *
 * Provides aggregate statistics and recent activity for the admin overview page.
 *
 * Endpoints:
 * 1. GET /api/admin/dashboard/stats           - Aggregate platform stats (contract S2)
 * 2. GET /api/admin/dashboard/recent-activity  - Recent audit log entries
 *
 * Note: GET /api/admin/dashboard/alerts is served by AlertController (alert module).
 *
 * All endpoints require platform_admin role.
 */
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  private assertPlatformAdmin(user: { role: string }): void {
    if (user.role !== 'platform_admin') {
      throw new ForbiddenException('Requires platform_admin role');
    }
  }

  // ==========================================================================
  // GET /api/admin/dashboard/stats
  // ==========================================================================
  @Get('stats')
  async getStats(@CurrentUser() user: { role: string }) {
    this.assertPlatformAdmin(user);
    return this.dashboardService.getStats();
  }

  // ==========================================================================
  // GET /api/admin/dashboard/recent-activity
  // ==========================================================================
  @Get('recent-activity')
  async getRecentActivity(
    @CurrentUser() user: { role: string },
    @Query('limit') limit?: string,
  ) {
    this.assertPlatformAdmin(user);
    const parsed = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getRecentActivity(
      Number.isNaN(parsed) ? 10 : parsed,
    );
  }
}
