import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/validation.pipe';
import { AlertService } from './alert.service';
import { queryAlertSchema, QueryAlertDto } from './dto/query-alert.dto';

/**
 * Alert Controller - Platform Admin Alert Endpoints
 *
 * Provides alert query and resolution for platform administrators.
 *
 * Endpoints:
 * 1. GET  /api/admin/dashboard/alerts     - Query alerts with optional filters
 * 2. PUT  /api/admin/dashboard/alerts/:id - Resolve an alert
 *
 * All endpoints require platform_admin role.
 */
@Controller('admin/dashboard/alerts')
@UseGuards(JwtAuthGuard)
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

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
  // GET /api/admin/dashboard/alerts - Query Alerts
  // Requires: platform_admin role
  // ==========================================================================
  @Get()
  async getAlerts(
    @Query(new ZodValidationPipe(queryAlertSchema)) query: QueryAlertDto,
    @CurrentUser() user: { role: string },
  ) {
    this.assertPlatformAdmin(user);
    return this.alertService.queryAlerts(query);
  }

  // ==========================================================================
  // PUT /api/admin/dashboard/alerts/:id - Resolve Alert
  // Requires: platform_admin role
  // ==========================================================================
  @Put(':id')
  async resolveAlert(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    this.assertPlatformAdmin(user);
    return this.alertService.resolveAlert(id, user.id);
  }
}
