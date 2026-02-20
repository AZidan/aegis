import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminSkillsReviewService } from './admin-skills-review.service';

/**
 * Admin Skills Review Controller - Platform Admin: Private Skill Review
 *
 * Provides review queue listing, approval, and rejection endpoints
 * for private skills submitted by tenants.
 *
 * All endpoints require platform_admin role.
 *
 * Endpoints:
 * 1. GET /api/admin/skills/review              - List review queue
 * 2. PUT /api/admin/skills/review/:id/approve  - Approve skill
 * 3. PUT /api/admin/skills/review/:id/reject   - Reject skill
 */
@Controller('admin/skills/review')
@UseGuards(JwtAuthGuard)
export class AdminSkillsReviewController {
  constructor(
    private readonly reviewService: AdminSkillsReviewService,
  ) {}

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
  // GET /api/admin/skills/review - List review queue
  // Requires: platform_admin role
  // ==========================================================================
  @Get()
  @HttpCode(HttpStatus.OK)
  async listReviewQueue(@CurrentUser() user: { role: string }) {
    this.assertPlatformAdmin(user);
    return this.reviewService.listReviewQueue();
  }

  // ==========================================================================
  // GET /api/admin/skills/review/:id - Get skill detail
  // Requires: platform_admin role
  // ==========================================================================
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getSkillDetail(
    @Param('id') id: string,
    @CurrentUser() user: { role: string },
  ) {
    this.assertPlatformAdmin(user);
    return this.reviewService.getSkillDetail(id);
  }

  // ==========================================================================
  // PUT /api/admin/skills/review/:id/approve - Approve skill
  // Requires: platform_admin role
  // ==========================================================================
  @Put(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approveSkill(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    this.assertPlatformAdmin(user);
    return this.reviewService.approveSkill(id, user.id);
  }

  // ==========================================================================
  // PUT /api/admin/skills/review/:id/reject - Reject skill
  // Requires: platform_admin role
  // ==========================================================================
  @Put(':id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectSkill(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    this.assertPlatformAdmin(user);
    return this.reviewService.rejectSkill(id, user.id, reason || 'No reason provided');
  }
}
