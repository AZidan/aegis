import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../../prisma/generated/client';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { UpdateToolPolicyDto } from './dto/update-tool-policy.dto';
import { ListAgentsQueryDto } from './dto/list-agents-query.dto';
import { TOOL_CATEGORIES } from '../tools/tool-categories';
import { ROLE_DEFAULT_POLICIES } from '../tools/role-defaults';

/**
 * Plan-based agent limits.
 * Per API Contract v1.2.0 Section 6 - Create Agent error 400:
 *   starter: max 3 agents
 *   growth: max 10 agents
 *   enterprise: max 50 agents
 */
const PLAN_AGENT_LIMITS: Record<string, number> = {
  starter: 3,
  growth: 10,
  enterprise: 50,
};

/**
 * Agents Service - Tenant: Agents
 * Implements all 8 agent endpoints from API Contract v1.2.0 Section 6.
 *
 * Every method receives the tenantId extracted by TenantGuard.
 */
@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================================================
  // GET /api/dashboard/agents - List Agents
  // Contract: Section 6 - List Agents
  // Response: { data: Agent[] }
  // ==========================================================================
  async listAgents(tenantId: string, query: ListAgentsQueryDto) {
    const { status, role, sort } = query;

    // Build where clause - always scoped to tenant
    const where: Prisma.AgentWhereInput = { tenantId };

    if (status) {
      where.status = status;
    }

    if (role) {
      where.role = role;
    }

    // Build orderBy clause
    let orderBy: Prisma.AgentOrderByWithRelationInput | undefined;
    if (sort) {
      const [field, direction] = sort.split(':') as [string, 'asc' | 'desc'];
      switch (field) {
        case 'name':
          orderBy = { name: direction };
          break;
        case 'last_active':
          orderBy = { lastActive: direction };
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

    const agents = await this.prisma.agent.findMany({
      where,
      orderBy,
      include: {
        channels: {
          take: 1,
          select: {
            type: true,
            connected: true,
          },
        },
      },
    });

    // Map to contract response format
    return {
      data: agents.map((agent) => {
        const item: Record<string, unknown> = {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          status: agent.status,
          modelTier: agent.modelTier,
          thinkingMode: agent.thinkingMode,
          lastActive: agent.lastActive
            ? agent.lastActive.toISOString()
            : agent.createdAt.toISOString(),
          createdAt: agent.createdAt.toISOString(),
        };

        if (agent.description) {
          item.description = agent.description;
        }

        // Include channel info if present
        if (agent.channels.length > 0) {
          const ch = agent.channels[0];
          item.channel = {
            type: ch.type,
            connected: ch.connected,
          };
        }

        return item;
      }),
    };
  }

  // ==========================================================================
  // POST /api/dashboard/agents - Create Agent
  // Contract: Section 6 - Create Agent
  // Response (201): { id, name, role, status: "provisioning", modelTier, thinkingMode, createdAt }
  // Error (400): plan limit reached
  // ==========================================================================
  async createAgent(tenantId: string, dto: CreateAgentDto) {
    // Get tenant to check plan limits
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: { select: { agents: true } },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Check plan limits
    const planLimit = PLAN_AGENT_LIMITS[tenant.plan] ?? 3;
    const currentCount = tenant._count.agents;

    if (currentCount >= planLimit) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Agent limit reached for current plan',
        details: {
          currentCount,
          planLimit,
          planName: tenant.plan,
        },
      });
    }

    // Build tool policy JSON - auto-populate from role defaults if empty
    let toolPolicy: { allow: string[]; deny: string[] };
    if (dto.toolPolicy && dto.toolPolicy.allow.length > 0) {
      toolPolicy = {
        allow: dto.toolPolicy.allow,
        deny: dto.toolPolicy.deny ?? [],
      };
    } else {
      const roleDefaults = ROLE_DEFAULT_POLICIES[dto.role];
      toolPolicy = roleDefaults
        ? { allow: [...roleDefaults.allow], deny: [...roleDefaults.deny] }
        : { allow: [], deny: [] };
    }

    // Build assistedUser JSON if provided
    const assistedUser =
      dto.assistedUserId || dto.assistedUserRole
        ? {
            userId: dto.assistedUserId ?? null,
            userRole: dto.assistedUserRole ?? null,
          }
        : null;

    // Create agent
    const agent = await this.prisma.agent.create({
      data: {
        name: dto.name,
        role: dto.role,
        description: dto.description,
        status: 'provisioning',
        modelTier: dto.modelTier,
        thinkingMode: dto.thinkingMode,
        toolPolicy: toolPolicy as Prisma.InputJsonValue,
        assistedUser: assistedUser as Prisma.InputJsonValue,
        tenantId,
      },
    });

    // Create channel if provided
    if (dto.channel) {
      const channelConfig: Record<string, string | undefined> = {};
      if (dto.channel.type === 'telegram') {
        channelConfig.token = dto.channel.token;
        channelConfig.chatId = dto.channel.chatId;
      } else if (dto.channel.type === 'slack') {
        channelConfig.workspaceId = dto.channel.workspaceId;
        channelConfig.channelId = dto.channel.channelId;
      }

      await this.prisma.agentChannel.create({
        data: {
          type: dto.channel.type,
          connected: false,
          config: channelConfig as Prisma.InputJsonValue,
          agentId: agent.id,
        },
      });
    }

    this.logger.log(
      `Agent created: ${agent.id} (${agent.name}) for tenant ${tenantId} - status: provisioning`,
    );

    // Contract response (201)
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      modelTier: agent.modelTier,
      thinkingMode: agent.thinkingMode,
      createdAt: agent.createdAt.toISOString(),
    };
  }

  // ==========================================================================
  // GET /api/dashboard/agents/:id - Get Agent Detail
  // Contract: Section 6 - Get Agent Detail
  // Response: full agent with metrics, skills, toolPolicy, channel
  // ==========================================================================
  async getAgentDetail(tenantId: string, agentId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
      include: {
        channels: {
          take: 1,
          select: {
            type: true,
            connected: true,
            lastMessageAt: true,
          },
        },
        installedSkills: {
          include: {
            skill: {
              select: {
                id: true,
                name: true,
                version: true,
              },
            },
          },
        },
      },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Get metrics for last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const metricsRecords = await this.prisma.agentMetrics.findMany({
      where: {
        agentId,
        periodStart: { gte: twentyFourHoursAgo },
      },
    });

    // Aggregate metrics
    const metrics = {
      messagesLast24h: metricsRecords.reduce(
        (sum, m) => sum + m.messageCount,
        0,
      ),
      toolInvocationsLast24h: metricsRecords.reduce(
        (sum, m) => sum + m.toolInvocations,
        0,
      ),
      avgResponseTime:
        metricsRecords.length > 0
          ? Math.round(
              metricsRecords.reduce(
                (sum, m) => sum + (m.avgResponseTime ?? 0),
                0,
              ) / metricsRecords.length,
            )
          : 0,
    };

    // Parse tool policy from JSONB
    const toolPolicy = (agent.toolPolicy as { allow: string[]; deny: string[] }) ?? {
      allow: [],
      deny: [],
    };

    // Build response per contract
    const response: Record<string, unknown> = {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      modelTier: agent.modelTier,
      thinkingMode: agent.thinkingMode,
      toolPolicy: {
        allow: toolPolicy.allow ?? [],
        deny: toolPolicy.deny ?? [],
      },
      metrics,
      skills: agent.installedSkills.map((si) => ({
        id: si.skill.id,
        name: si.skill.name,
        version: si.skill.version,
      })),
      lastActive: agent.lastActive
        ? agent.lastActive.toISOString()
        : agent.createdAt.toISOString(),
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
    };

    if (agent.description) {
      response.description = agent.description;
    }

    // Include channel info if present
    if (agent.channels.length > 0) {
      const ch = agent.channels[0];
      const channelData: Record<string, unknown> = {
        type: ch.type,
        connected: ch.connected,
      };
      if (ch.lastMessageAt) {
        channelData.lastMessageAt = ch.lastMessageAt.toISOString();
      }
      response.channel = channelData;
    }

    return response;
  }

  // ==========================================================================
  // PATCH /api/dashboard/agents/:id - Update Agent
  // Contract: Section 6 - Update Agent
  // Response: { id, name, modelTier, thinkingMode, updatedAt }
  // ==========================================================================
  async updateAgent(tenantId: string, agentId: string, dto: UpdateAgentDto) {
    // Verify agent belongs to tenant
    const existing = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Agent not found');
    }

    // Build update data
    const updateData: Prisma.AgentUpdateInput = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }

    if (dto.modelTier !== undefined) {
      updateData.modelTier = dto.modelTier;
    }

    if (dto.thinkingMode !== undefined) {
      updateData.thinkingMode = dto.thinkingMode;
    }

    if (dto.toolPolicy !== undefined) {
      // Merge with existing tool policy
      const existingPolicy =
        (existing.toolPolicy as { allow?: string[]; deny?: string[] }) ?? {};
      updateData.toolPolicy = {
        allow: dto.toolPolicy.allow ?? existingPolicy.allow ?? [],
        deny: dto.toolPolicy.deny ?? existingPolicy.deny ?? [],
      } as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.agent.update({
      where: { id: agentId },
      data: updateData,
    });

    this.logger.log(`Agent updated: ${agentId} for tenant ${tenantId}`);

    // Contract response
    return {
      id: updated.id,
      name: updated.name,
      modelTier: updated.modelTier,
      thinkingMode: updated.thinkingMode,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ==========================================================================
  // DELETE /api/dashboard/agents/:id - Delete Agent
  // Contract: Section 6 - Delete Agent
  // Response: 204 No Content
  // ==========================================================================
  async deleteAgent(tenantId: string, agentId: string): Promise<void> {
    // Verify agent belongs to tenant
    const existing = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Agent not found');
    }

    // Cascading deletes handle channels, activities, metrics, skill installations
    await this.prisma.agent.delete({
      where: { id: agentId },
    });

    this.logger.log(`Agent deleted: ${agentId} for tenant ${tenantId}`);
  }

  // ==========================================================================
  // POST /api/dashboard/agents/:id/actions/restart - Restart Agent
  // Contract: Section 6 - Restart Agent
  // Response (202): { message, agentId }
  // ==========================================================================
  async restartAgent(tenantId: string, agentId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Update status to provisioning during restart
    await this.prisma.agent.update({
      where: { id: agentId },
      data: { status: 'provisioning' },
    });

    this.logger.log(`Agent restart initiated: ${agentId} for tenant ${tenantId}`);

    // Contract response (202 Accepted)
    return {
      message: 'Agent restart initiated',
      agentId,
    };
  }

  // ==========================================================================
  // POST /api/dashboard/agents/:id/actions/pause - Pause Agent
  // Contract: Section 6 - Pause Agent
  // Response (200): { id, status: "paused", pausedAt }
  // ==========================================================================
  async pauseAgent(tenantId: string, agentId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    if (agent.status === 'paused') {
      throw new BadRequestException('Agent is already paused');
    }

    const now = new Date();

    await this.prisma.agent.update({
      where: { id: agentId },
      data: { status: 'paused' },
    });

    this.logger.log(`Agent paused: ${agentId} for tenant ${tenantId}`);

    // Contract response
    return {
      id: agentId,
      status: 'paused',
      pausedAt: now.toISOString(),
    };
  }

  // ==========================================================================
  // POST /api/dashboard/agents/:id/actions/resume - Resume Agent
  // Contract: Section 6 - Resume Agent
  // Response (200): { id, status: "active", resumedAt }
  // ==========================================================================
  async resumeAgent(tenantId: string, agentId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    if (agent.status !== 'paused') {
      throw new BadRequestException('Agent is not paused');
    }

    const now = new Date();

    await this.prisma.agent.update({
      where: { id: agentId },
      data: { status: 'active' },
    });

    this.logger.log(`Agent resumed: ${agentId} for tenant ${tenantId}`);

    // Contract response
    return {
      id: agentId,
      status: 'active',
      resumedAt: now.toISOString(),
    };
  }

  // ==========================================================================
  // GET /api/dashboard/agents/:id/tool-policy - Get Agent Tool Policy
  // Response: { agentId, agentName, role, policy: { allow, deny }, availableCategories }
  // ==========================================================================
  async getToolPolicy(tenantId: string, agentId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const toolPolicy = (agent.toolPolicy as {
      allow: string[];
      deny: string[];
    }) ?? { allow: [], deny: [] };

    return {
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      policy: {
        allow: toolPolicy.allow ?? [],
        deny: toolPolicy.deny ?? [],
      },
      availableCategories: TOOL_CATEGORIES,
    };
  }

  // ==========================================================================
  // PUT /api/dashboard/agents/:id/tool-policy - Update Agent Tool Policy
  // Request: { allow: string[], deny?: string[] }
  // Response: { agentId, policy: { allow, deny }, updatedAt }
  // ==========================================================================
  async updateToolPolicy(
    tenantId: string,
    agentId: string,
    dto: UpdateToolPolicyDto,
  ) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const newPolicy = {
      allow: dto.allow,
      deny: dto.deny ?? [],
    };

    const updated = await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        toolPolicy: newPolicy as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `Agent tool policy updated: ${agentId} for tenant ${tenantId}`,
    );

    return {
      agentId: updated.id,
      policy: newPolicy,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
