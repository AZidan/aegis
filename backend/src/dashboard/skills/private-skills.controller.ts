import {
  Controller,
  Get,
  Post,
  Patch,
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
import { PrivateSkillsService } from './private-skills.service';
import { SkillValidatorService } from './skill-validator.service';
import { GitHubSkillImportService } from '../../shared/github-skill-import';
import {
  submitPrivateSkillSchema,
  SubmitPrivateSkillDto,
} from './dto/submit-private-skill.dto';
import {
  updatePrivateSkillSchema,
  UpdatePrivateSkillDto,
} from './dto/update-private-skill.dto';
import {
  validateSkillSchema,
  ValidateSkillDto,
} from './dto/validate-skill.dto';
import { githubImportSchema, GitHubImportDto } from '../../admin/skills/dto/github-import.dto';

/**
 * Private Skills Controller - Tenant: Private Skill Registry
 *
 * Provides tenant-scoped private skill submission, listing, updating,
 * and version history endpoints.
 *
 * All endpoints require JWT authentication and a valid tenant context.
 * TenantGuard extracts tenantId from JWT and attaches it to the request.
 *
 * Endpoints:
 * 1. POST  /api/dashboard/skills/private              - Submit private skill
 * 2. GET   /api/dashboard/skills/private              - List own private skills
 * 3. POST  /api/dashboard/skills/private/validate     - Dry-run validate skill
 * 4. PATCH /api/dashboard/skills/private/:id          - Update draft skill
 * 5. GET   /api/dashboard/skills/private/:id/versions - List versions
 */
@Controller('dashboard/skills/private')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PrivateSkillsController {
  constructor(
    private readonly privateSkillsService: PrivateSkillsService,
    private readonly skillValidator: SkillValidatorService,
    private readonly gitHubImportService: GitHubSkillImportService,
  ) {}

  private getTenantId(req: Request): string {
    return (req as Request & { tenantId: string }).tenantId;
  }

  private getUserId(req: Request): string {
    return (req as Request & { user: { id: string } }).user.id;
  }

  // ==========================================================================
  // POST /api/dashboard/skills/private - Submit private skill
  // Response: 201 Created
  // ==========================================================================
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submitPrivateSkill(
    @Req() req: Request,
    @Body(new ZodValidationPipe(submitPrivateSkillSchema))
    dto: SubmitPrivateSkillDto,
  ) {
    const tenantId = this.getTenantId(req);
    const userId = this.getUserId(req);
    return this.privateSkillsService.submitPrivateSkill(tenantId, userId, dto);
  }

  // ==========================================================================
  // GET /api/dashboard/skills/private - List own private skills
  // Query: ?status=pending,approved,rejected,changes_requested
  // Response: 200 OK, { data: Skill[] }
  // ==========================================================================
  @Get()
  @HttpCode(HttpStatus.OK)
  async listOwnPrivateSkills(
    @Req() req: Request,
    @Query('status') status: string | undefined,
  ) {
    const tenantId = this.getTenantId(req);
    const statusFilter = status ? status.split(',').map((s) => s.trim()) : undefined;
    return this.privateSkillsService.listOwnPrivateSkills(tenantId, statusFilter);
  }

  // ==========================================================================
  // POST /api/dashboard/skills/private/validate - Dry-run validate
  // Response: 200 OK, ValidationReport
  // ==========================================================================
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validateSkill(
    @Body(new ZodValidationPipe(validateSkillSchema))
    dto: ValidateSkillDto,
  ) {
    return this.skillValidator.validate(dto.sourceCode, dto.dryRun);
  }

  // ==========================================================================
  // POST /api/dashboard/skills/private/import/github - Fetch skills from GitHub
  // Response: 200 OK
  // ==========================================================================
  @Post('import/github')
  @HttpCode(HttpStatus.OK)
  async fetchGitHubSkills(
    @Body(new ZodValidationPipe(githubImportSchema))
    dto: GitHubImportDto,
  ) {
    return this.gitHubImportService.fetchSkillsFromGitHub(dto.url);
  }

  // ==========================================================================
  // GET /api/dashboard/skills/private/:id - Get skill detail
  // Response: 200 OK
  // ==========================================================================
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getSkillDetail(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return this.privateSkillsService.getSkillDetail(tenantId, id);
  }

  // ==========================================================================
  // PATCH /api/dashboard/skills/private/:id - Update draft
  // Response: 200 OK
  // ==========================================================================
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateDraft(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePrivateSkillSchema))
    dto: UpdatePrivateSkillDto,
  ) {
    const tenantId = this.getTenantId(req);
    const userId = this.getUserId(req);
    return this.privateSkillsService.updateDraft(tenantId, id, userId, dto);
  }

  // ==========================================================================
  // GET /api/dashboard/skills/private/:id/versions - List versions
  // Response: 200 OK, { data: Version[] }
  // ==========================================================================
  @Get(':id/versions')
  @HttpCode(HttpStatus.OK)
  async getVersions(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return this.privateSkillsService.getVersions(tenantId, id);
  }
}
