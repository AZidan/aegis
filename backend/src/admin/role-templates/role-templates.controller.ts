import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UsePipes,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import {
  updateRoleConfigSchema,
  UpdateRoleConfigDto,
  previewTemplateSchema,
  PreviewTemplateDto,
} from './dto/update-role-config.dto';

/**
 * Role Templates Controller - Platform Admin: Role Config CRUD
 *
 * Provides listing, detail, update, and template-preview endpoints
 * for agent role configurations (AgentRoleConfig).
 *
 * All endpoints require platform_admin role.
 *
 * Endpoints:
 * 1. GET    /api/admin/role-configs            - List all role configs
 * 2. GET    /api/admin/role-configs/:id         - Get single role config
 * 3. PUT    /api/admin/role-configs/:id         - Update role config
 * 4. POST   /api/admin/role-configs/:id/preview - Preview rendered template
 */
@Controller('admin/role-configs')
@UseGuards(JwtAuthGuard)
export class RoleTemplatesController {
  private readonly logger = new Logger(RoleTemplatesController.name);

  constructor(private readonly prisma: PrismaService) {}

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
  // GET /api/admin/role-configs - List all role configs with templates
  // Requires: platform_admin role
  // ==========================================================================
  @Get()
  @HttpCode(HttpStatus.OK)
  async listRoleConfigs(@CurrentUser() user: { role: string }) {
    this.assertPlatformAdmin(user);

    const roles = await this.prisma.agentRoleConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return {
      data: roles.map((role) => ({
        id: role.id,
        name: role.name,
        label: role.label,
        description: role.description,
        color: role.color,
        defaultToolCategories: role.defaultToolCategories,
        sortOrder: role.sortOrder,
        isSystem: role.isSystem,
        soulTemplate: role.soulTemplate,
        agentsTemplate: role.agentsTemplate,
        heartbeatTemplate: role.heartbeatTemplate,
        userTemplate: role.userTemplate,
        identityEmoji: role.identityEmoji,
        openclawConfigTemplate: role.openclawConfigTemplate,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      })),
    };
  }

  // ==========================================================================
  // GET /api/admin/role-configs/:id - Get single role config with all fields
  // Requires: platform_admin role
  // ==========================================================================
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getRoleConfig(
    @Param('id') id: string,
    @CurrentUser() user: { role: string },
  ) {
    this.assertPlatformAdmin(user);

    const role = await this.prisma.agentRoleConfig.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException(`Role config not found: ${id}`);
    }

    return {
      data: {
        id: role.id,
        name: role.name,
        label: role.label,
        description: role.description,
        color: role.color,
        defaultToolCategories: role.defaultToolCategories,
        sortOrder: role.sortOrder,
        isSystem: role.isSystem,
        soulTemplate: role.soulTemplate,
        agentsTemplate: role.agentsTemplate,
        heartbeatTemplate: role.heartbeatTemplate,
        userTemplate: role.userTemplate,
        identityEmoji: role.identityEmoji,
        openclawConfigTemplate: role.openclawConfigTemplate,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      },
    };
  }

  // ==========================================================================
  // PUT /api/admin/role-configs/:id - Update role config templates & metadata
  // Requires: platform_admin role
  // Body validated with updateRoleConfigSchema (Zod)
  // ==========================================================================
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(updateRoleConfigSchema))
  async updateRoleConfig(
    @Param('id') id: string,
    @Body() dto: UpdateRoleConfigDto,
    @CurrentUser() user: { role: string },
  ) {
    this.assertPlatformAdmin(user);

    // Verify the role config exists
    const existing = await this.prisma.agentRoleConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Role config not found: ${id}`);
    }

    // Build update payload; cast openclawConfigTemplate for Prisma's InputJsonValue
    const { openclawConfigTemplate, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (openclawConfigTemplate !== undefined) {
      data.openclawConfigTemplate =
        openclawConfigTemplate as unknown as Record<string, unknown>;
    }

    const updated = await this.prisma.agentRoleConfig.update({
      where: { id },
      data,
    });

    this.logger.log(`Role config updated: ${updated.name} (${id})`);

    return {
      data: {
        id: updated.id,
        name: updated.name,
        label: updated.label,
        description: updated.description,
        color: updated.color,
        defaultToolCategories: updated.defaultToolCategories,
        sortOrder: updated.sortOrder,
        isSystem: updated.isSystem,
        soulTemplate: updated.soulTemplate,
        agentsTemplate: updated.agentsTemplate,
        heartbeatTemplate: updated.heartbeatTemplate,
        userTemplate: updated.userTemplate,
        identityEmoji: updated.identityEmoji,
        openclawConfigTemplate: updated.openclawConfigTemplate,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    };
  }

  // ==========================================================================
  // POST /api/admin/role-configs/:id/preview - Render template with sample data
  // Requires: platform_admin role
  // Body validated with previewTemplateSchema (Zod)
  //
  // Hydrates the specified template field by replacing {{key}} placeholders
  // with values from sampleData. Returns the rendered string.
  // ==========================================================================
  @Post(':id/preview')
  @HttpCode(HttpStatus.OK)
  async previewTemplate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(previewTemplateSchema)) dto: PreviewTemplateDto,
    @CurrentUser() user: { role: string },
  ) {
    this.assertPlatformAdmin(user);

    const role = await this.prisma.agentRoleConfig.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException(`Role config not found: ${id}`);
    }

    const templateContent = role[dto.templateField] as string | null;

    if (!templateContent) {
      return { rendered: '' };
    }

    // Hydrate {{key}} placeholders with sample data values
    let rendered: string = templateContent;
    if (dto.sampleData) {
      for (const [key, value] of Object.entries(dto.sampleData)) {
        const pattern = new RegExp(
          `\\{\\{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}\\}`,
          'g',
        );
        rendered = rendered.replace(pattern, value);
      }
    }

    return { rendered };
  }
}
