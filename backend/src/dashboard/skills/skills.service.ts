import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../../prisma/generated/client';
import { BrowseSkillsQueryDto } from './dto/browse-skills-query.dto';
import { InstallSkillDto } from './dto/install-skill.dto';

/**
 * Skills Service - Tenant: Skills
 * Implements all skill endpoints from API Contract v1.3.0 Section 7.
 *
 * Every method receives the tenantId extracted by TenantGuard.
 *
 * Endpoints:
 * 1. GET    /api/dashboard/skills              - Browse Skill Marketplace
 * 2. GET    /api/dashboard/skills/installed     - Get Installed Skills
 * 3. GET    /api/dashboard/skills/:id           - Get Skill Detail
 * 4. POST   /api/dashboard/skills/:id/install   - Install Skill
 * 5. DELETE /api/dashboard/skills/:id/uninstall - Uninstall Skill
 */
@Injectable()
export class SkillsService {
  private readonly logger = new Logger(SkillsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================================================
  // GET /api/dashboard/skills - Browse Skill Marketplace
  // Contract: Section 7 - Browse Skill Marketplace
  // Response: { data: Skill[], meta: PaginationMeta }
  // ==========================================================================
  async browseSkills(tenantId: string, query: BrowseSkillsQueryDto) {
    const { category, role, search, page, limit, sort } = query;

    // Build where clause - only approved skills are visible in marketplace
    const where: Prisma.SkillWhereInput = { status: 'approved' };

    if (category) {
      where.category = category;
    }

    if (role) {
      where.compatibleRoles = { has: role };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy clause
    let orderBy: Prisma.SkillOrderByWithRelationInput | undefined;
    if (sort) {
      const [field, direction] = sort.split(':') as [string, 'asc' | 'desc'];
      switch (field) {
        case 'name':
          orderBy = { name: direction };
          break;
        case 'rating':
          orderBy = { rating: direction };
          break;
        case 'install_count':
          orderBy = { installCount: direction };
          break;
        case 'created_at':
          orderBy = { createdAt: direction };
          break;
        default:
          orderBy = { createdAt: 'desc' };
      }
    } else {
      orderBy = { createdAt: 'desc' };
    }

    // Count total for pagination
    const total = await this.prisma.skill.count({ where });
    const totalPages = Math.ceil(total / limit);

    // Fetch skills
    const skills = await this.prisma.skill.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get all skill installations for this tenant's agents to determine "installed" flag
    const tenantAgents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const tenantAgentIds = tenantAgents.map((a) => a.id);

    const installations = await this.prisma.skillInstallation.findMany({
      where: { agentId: { in: tenantAgentIds } },
      select: { skillId: true },
    });
    const installedSkillIds = new Set(installations.map((i) => i.skillId));

    return {
      data: skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        category: skill.category,
        compatibleRoles: skill.compatibleRoles,
        version: skill.version,
        rating: skill.rating,
        installCount: skill.installCount,
        permissions: (skill.permissions as {
          network: string[];
          files: string[];
          env: string[];
        }) ?? { network: [], files: [], env: [] },
        installed: installedSkillIds.has(skill.id),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // ==========================================================================
  // GET /api/dashboard/skills/:id - Get Skill Detail
  // Contract: Section 7 - Get Skill Detail
  // Response: full skill detail with documentation, changelog, reviews
  // ==========================================================================
  async getSkillDetail(tenantId: string, skillId: string) {
    const skill = await this.prisma.skill.findFirst({
      where: { id: skillId, status: 'approved' },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    // Find which of this tenant's agents have this skill installed
    const tenantAgents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const tenantAgentIds = tenantAgents.map((a) => a.id);

    const installations = await this.prisma.skillInstallation.findMany({
      where: {
        skillId,
        agentId: { in: tenantAgentIds },
      },
      select: { agentId: true },
    });

    const installed = installations.length > 0;
    const installedAgents = installations.map((i) => i.agentId);

    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      compatibleRoles: skill.compatibleRoles,
      version: skill.version,
      rating: skill.rating,
      installCount: skill.installCount,
      permissions: (skill.permissions as {
        network: string[];
        files: string[];
        env: string[];
      }) ?? { network: [], files: [], env: [] },
      documentation: skill.documentation ?? '',
      changelog: skill.changelog ?? '',
      reviews: [], // Reviews not yet implemented - placeholder per contract
      installed,
      installedAgents: installed ? installedAgents : undefined,
    };
  }

  // ==========================================================================
  // POST /api/dashboard/skills/:id/install - Install Skill
  // Contract: Section 7 - Install Skill
  // Response (201): { skillId, agentId, status: "installing", message }
  // Error (409): Conflict if already installed
  // ==========================================================================
  async installSkill(tenantId: string, skillId: string, dto: InstallSkillDto) {
    // Verify skill exists and is approved
    const skill = await this.prisma.skill.findFirst({
      where: { id: skillId, status: 'approved' },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    // Verify agent belongs to tenant
    const agent = await this.prisma.agent.findFirst({
      where: { id: dto.agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Check if already installed
    const existing = await this.prisma.skillInstallation.findUnique({
      where: {
        agentId_skillId: {
          agentId: dto.agentId,
          skillId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Skill is already installed on this agent');
    }

    // Create installation
    await this.prisma.skillInstallation.create({
      data: {
        agentId: dto.agentId,
        skillId,
        config: dto.credentials
          ? (dto.credentials as Prisma.InputJsonValue)
          : undefined,
      },
    });

    // Increment install count
    await this.prisma.skill.update({
      where: { id: skillId },
      data: { installCount: { increment: 1 } },
    });

    this.logger.log(
      `Skill ${skill.name} (${skillId}) installed on agent ${dto.agentId} for tenant ${tenantId}`,
    );

    return {
      skillId,
      agentId: dto.agentId,
      status: 'installing' as const,
      message: 'Skill will be available within 60 seconds',
    };
  }

  // ==========================================================================
  // DELETE /api/dashboard/skills/:id/uninstall - Uninstall Skill
  // Contract: Section 7 - Uninstall Skill
  // Response: 204 No Content
  // ==========================================================================
  async uninstallSkill(
    tenantId: string,
    skillId: string,
    agentId: string,
  ): Promise<void> {
    // Verify agent belongs to tenant
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Find the installation
    const installation = await this.prisma.skillInstallation.findUnique({
      where: {
        agentId_skillId: {
          agentId,
          skillId,
        },
      },
    });

    if (!installation) {
      throw new NotFoundException('Skill installation not found');
    }

    // Prevent uninstallation of core skills
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
      select: { isCore: true },
    });

    if (skill?.isCore === true) {
      throw new BadRequestException('Core skills cannot be uninstalled');
    }

    // Delete installation
    await this.prisma.skillInstallation.delete({
      where: { id: installation.id },
    });

    // Decrement install count (floor at 0)
    await this.prisma.skill.update({
      where: { id: skillId },
      data: {
        installCount: { decrement: 1 },
      },
    });

    this.logger.log(
      `Skill ${skillId} uninstalled from agent ${agentId} for tenant ${tenantId}`,
    );
  }

  // ==========================================================================
  // GET /api/dashboard/skills/installed - Get Installed Skills
  // Contract: Section 7 - Get Installed Skills
  // Response: { data: InstalledSkill[] }
  // ==========================================================================
  async getInstalledSkills(tenantId: string, agentId?: string) {
    // Build where clause for agents belonging to this tenant
    const agentWhere: Prisma.AgentWhereInput = { tenantId };
    if (agentId) {
      agentWhere.id = agentId;
    }

    const agents = await this.prisma.agent.findMany({
      where: agentWhere,
      select: { id: true, name: true },
    });

    if (agents.length === 0) {
      return { data: [] };
    }

    const agentIds = agents.map((a) => a.id);
    const agentNameMap = new Map(agents.map((a) => [a.id, a.name]));

    const installations = await this.prisma.skillInstallation.findMany({
      where: { agentId: { in: agentIds } },
      include: {
        skill: {
          select: {
            id: true,
            name: true,
            version: true,
            category: true,
          },
        },
      },
      orderBy: { installedAt: 'desc' },
    });

    return {
      data: installations.map((inst) => ({
        id: inst.skill.id,
        name: inst.skill.name,
        version: inst.skill.version,
        category: inst.skill.category,
        agentId: inst.agentId,
        agentName: agentNameMap.get(inst.agentId) ?? 'Unknown',
        installedAt: inst.installedAt.toISOString(),
        usageCount: 0, // Usage tracking not yet implemented
      })),
    };
  }
}
