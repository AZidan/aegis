import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/validation.pipe';
import { AdminSkillsReviewService } from './admin-skills-review.service';
import { SkillPackageService } from '../../dashboard/skills/skill-package.service';
import { GitHubSkillImportService } from '../../shared/github-skill-import';
import {
  importMarketplaceSkillSchema,
  ImportMarketplaceSkillDto,
} from './dto/import-marketplace-skill.dto';
import { githubImportSchema, GitHubImportDto } from './dto/github-import.dto';

/** Minimal multer file type to avoid @types/multer dependency */
interface MulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
  fieldname: string;
}

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
    private readonly skillPackageService: SkillPackageService,
    private readonly gitHubImportService: GitHubSkillImportService,
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
  // POST /api/admin/skills/review/import/upload - Upload marketplace skill ZIP
  // Requires: platform_admin role
  // ==========================================================================
  @Post('import/upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMarketplacePackage(
    @UploadedFile() file: MulterFile,
    @CurrentUser() user: { id: string; role: string },
  ) {
    this.assertPlatformAdmin(user);
    if (!file) {
      throw new BadRequestException('No file uploaded. Use field name "file".');
    }
    return this.skillPackageService.parseAndValidate(file.buffer, {
      store: true,
      tenantId: '_marketplace',
      userId: user.id,
    });
  }

  // ==========================================================================
  // POST /api/admin/skills/review/import/github - Fetch skills from GitHub URL
  // Requires: platform_admin role
  // ==========================================================================
  @Post('import/github')
  @HttpCode(HttpStatus.OK)
  async fetchGitHubSkills(
    @Body(new ZodValidationPipe(githubImportSchema))
    dto: GitHubImportDto,
    @CurrentUser() user: { role: string },
  ) {
    this.assertPlatformAdmin(user);
    return this.gitHubImportService.fetchSkillsFromGitHub(dto.url);
  }

  // ==========================================================================
  // POST /api/admin/skills/review/import - Import skill to marketplace
  // Requires: platform_admin role
  // ==========================================================================
  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  async importMarketplaceSkill(
    @Body(new ZodValidationPipe(importMarketplaceSkillSchema))
    dto: ImportMarketplaceSkillDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    this.assertPlatformAdmin(user);
    return this.reviewService.importMarketplaceSkill(user.id, dto);
  }

  // ==========================================================================
  // GET /api/admin/skills/review - List skills with optional status filter
  // Requires: platform_admin role
  // Query: ?status=pending,approved,rejected,changes_requested
  // ==========================================================================
  @Get()
  @HttpCode(HttpStatus.OK)
  async listSkills(
    @Query('status') status: string | undefined,
    @CurrentUser() user: { role: string },
  ) {
    this.assertPlatformAdmin(user);
    const statusFilter = status ? status.split(',').map((s) => s.trim()) : undefined;
    return this.reviewService.listSkills(statusFilter);
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

  // ==========================================================================
  // PUT /api/admin/skills/review/:id/request-changes - Request changes
  // Requires: platform_admin role
  // ==========================================================================
  @Put(':id/request-changes')
  @HttpCode(HttpStatus.OK)
  async requestChanges(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    this.assertPlatformAdmin(user);
    return this.reviewService.requestChanges(id, user.id, reason || 'No reason provided');
  }
}
