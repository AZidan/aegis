import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/validation.pipe';
import { SkillsService } from './skills.service';
import {
  browseSkillsQuerySchema,
  BrowseSkillsQueryDto,
} from './dto/browse-skills-query.dto';
import {
  installSkillSchema,
  InstallSkillDto,
} from './dto/install-skill.dto';

/**
 * Skills Controller - Tenant: Skills
 * Implements all 5 endpoints from API Contract v1.3.0 Section 7.
 *
 * All endpoints require JWT authentication and a valid tenant context.
 * TenantGuard extracts tenantId from JWT and attaches it to the request.
 *
 * Endpoints:
 * 1. GET    /api/dashboard/skills              - Browse Skill Marketplace
 * 2. GET    /api/dashboard/skills/installed     - Get Installed Skills
 * 3. GET    /api/dashboard/skills/:id           - Get Skill Detail
 * 4. POST   /api/dashboard/skills/:id/install   - Install Skill
 * 5. DELETE /api/dashboard/skills/:id/uninstall - Uninstall Skill
 *
 * NOTE: /installed must be defined BEFORE /:id to avoid route conflict.
 */
@Controller('dashboard/skills')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  /**
   * Extract tenantId from request (set by TenantGuard).
   */
  private getTenantId(req: Request): string {
    return (req as Request & { tenantId: string }).tenantId;
  }

  // ==========================================================================
  // GET /api/dashboard/skills - Browse Skill Marketplace
  // Contract: 200 OK, { data: Skill[], meta: PaginationMeta }
  // ==========================================================================
  @Get()
  @HttpCode(HttpStatus.OK)
  async browseSkills(
    @Req() req: Request,
    @Query(new ZodValidationPipe(browseSkillsQuerySchema))
    query: BrowseSkillsQueryDto,
  ) {
    const tenantId = this.getTenantId(req);
    return this.skillsService.browseSkills(tenantId, query);
  }

  // ==========================================================================
  // GET /api/dashboard/skills/installed - Get Installed Skills
  // Contract: 200 OK, { data: InstalledSkill[] }
  // NOTE: This route MUST be before /:id to prevent "installed" being treated
  //       as a UUID path parameter.
  // ==========================================================================
  @Get('installed')
  @HttpCode(HttpStatus.OK)
  async getInstalledSkills(
    @Req() req: Request,
    @Query('agentId') agentId?: string,
  ) {
    const tenantId = this.getTenantId(req);
    return this.skillsService.getInstalledSkills(tenantId, agentId);
  }

  // ==========================================================================
  // GET /api/dashboard/skills/:id - Get Skill Detail
  // Contract: 200 OK
  // ==========================================================================
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getSkillDetail(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return this.skillsService.getSkillDetail(tenantId, id);
  }

  // ==========================================================================
  // POST /api/dashboard/skills/:id/install - Install Skill
  // Contract: 201 Created
  // ==========================================================================
  @Post(':id/install')
  @HttpCode(HttpStatus.CREATED)
  async installSkill(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(installSkillSchema)) dto: InstallSkillDto,
  ) {
    const tenantId = this.getTenantId(req);
    return this.skillsService.installSkill(tenantId, id, dto);
  }

  // ==========================================================================
  // DELETE /api/dashboard/skills/:id/uninstall - Uninstall Skill
  // Contract: 204 No Content
  // ==========================================================================
  @Delete(':id/uninstall')
  @HttpCode(HttpStatus.NO_CONTENT)
  async uninstallSkill(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('agentId') agentId: string,
  ) {
    const tenantId = this.getTenantId(req);
    await this.skillsService.uninstallSkill(tenantId, id, agentId);
  }
}
