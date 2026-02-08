import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { Prisma } from '../../../prisma/generated/client';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { UpdateToolPolicyDto } from './dto/update-tool-policy.dto';
import { ListAgentsQueryDto } from './dto/list-agents-query.dto';
import { TOOL_CATEGORIES } from '../tools/tool-categories';
import { ROLE_DEFAULT_POLICIES } from '../tools/role-defaults';

/**
 * Plan-based agent limits.
 * Per API Contract v1.3.0 Section 6 - Create Agent error 400:
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
 * Human-readable model display names derived from modelTier enum.
 */
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  haiku: 'Claude Haiku',
  sonnet: 'Claude Sonnet',
  opus: 'Claude Opus',
};

/**
 * Agents Service - Tenant: Agents
 * Implements all agent endpoints from API Contract v1.3.0 Section 6.
 *
 * Every method receives the tenantId extracted by TenantGuard.
 */
@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

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
          select: {
            type: true,
            connected: true,
          },
        },
        installedSkills: {
          include: {
            skill: {
              select: { id: true, name: true, version: true },
            },
          },
        },
      },
    });

    // Batch-query message counts from AgentMetrics for all agents
    const agentIds = agents.map((a) => a.id);
    const messageCounts = new Map<string, number>();

    if (agentIds.length > 0) {
      const metricsSums = await this.prisma.agentMetrics.groupBy({
        by: ['agentId'],
        where: { agentId: { in: agentIds } },
        _sum: { messageCount: true },
      });
      for (const row of metricsSums) {
        messageCounts.set(row.agentId, row._sum.messageCount ?? 0);
      }
    }

    // Map to contract response format
    return {
      data: await Promise.all(
        agents.map(async (agent) => {
          const item: Record<string, unknown> = {
            id: agent.id,
            name: agent.name,
            role: agent.role,
            status: agent.status,
            model: MODEL_DISPLAY_NAMES[agent.modelTier] ?? agent.modelTier,
            modelTier: agent.modelTier,
            thinkingMode: agent.thinkingMode,
            temperature: agent.temperature,
            avatarColor: agent.avatarColor,
            lastActive: agent.lastActive
              ? agent.lastActive.toISOString()
              : agent.createdAt.toISOString(),
            createdAt: agent.createdAt.toISOString(),
          };

          if (agent.description) {
            item.description = agent.description;
          }

          // Include errorMessage for agents in error status
          if (agent.status === 'error') {
            const latestError = await this.prisma.agentActivity.findFirst({
              where: { agentId: agent.id, type: 'error' },
              orderBy: { timestamp: 'desc' },
            });
            if (latestError) {
              const details = latestError.details as Record<string, unknown> | null;
              item.errorMessage =
                (details?.errorMessage as string) ?? latestError.summary;
            }
          }

          // Agent stats (messages, skills count, uptime)
          const uptimeByStatus: Record<string, number> = {
            active: 99.9,
            idle: 95.0,
            error: 0,
            paused: 0,
            provisioning: 0,
          };
          item.stats = {
            messages: messageCounts.get(agent.id) ?? 0,
            skills: agent.installedSkills.length,
            uptime: uptimeByStatus[agent.status] ?? 0,
          };

          // Installed skills
          item.skills = agent.installedSkills.map((si) => ({
            id: si.skill.id,
            name: si.skill.name,
            version: si.skill.version,
            enabled: true,
          }));

          // Channels array
          item.channels = agent.channels.map((ch) => ({
            type: ch.type,
            handle: '',
            connected: ch.connected,
          }));

          return item;
        }),
      ),
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

    // Validate role against AgentRoleConfig table
    const roleConfig = await this.prisma.agentRoleConfig.findUnique({
      where: { name: dto.role },
    });

    if (!roleConfig) {
      throw new BadRequestException(
        `Invalid role "${dto.role}". Role must be a valid agent role configuration.`,
      );
    }

    // Build tool policy JSON - auto-populate from role defaults if empty
    let toolPolicy: { allow: string[] };
    if (dto.toolPolicy && dto.toolPolicy.allow.length > 0) {
      toolPolicy = {
        allow: dto.toolPolicy.allow,
      };
    } else {
      // Use roleConfig.defaultToolCategories as fallback
      const roleDefaults = ROLE_DEFAULT_POLICIES[dto.role];
      toolPolicy = roleDefaults
        ? { allow: [...roleDefaults.allow] }
        : { allow: [...roleConfig.defaultToolCategories] };
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
        temperature: dto.temperature ?? 0.3,
        avatarColor: dto.avatarColor ?? '#6366f1',
        personality: dto.personality,
        toolPolicy: toolPolicy as Prisma.InputJsonValue,
        assistedUser: assistedUser as Prisma.InputJsonValue,
        tenantId,
      },
    });

    this.logger.log(
      `Agent created: ${agent.id} (${agent.name}) for tenant ${tenantId} - status: provisioning`,
    );

    this.auditService.logAction({
      actorType: 'system',
      actorId: 'system',
      actorName: 'system',
      action: 'agent_created',
      targetType: 'agent',
      targetId: agent.id,
      details: { name: agent.name, role: agent.role, modelTier: agent.modelTier },
      severity: 'info',
      tenantId,
      agentId: agent.id,
    });

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
    const messagesLast24h = metricsRecords.reduce(
      (sum, m) => sum + m.messageCount,
      0,
    );
    const toolInvocationsLast24h = metricsRecords.reduce(
      (sum, m) => sum + m.toolInvocations,
      0,
    );
    const avgResponseTime =
      metricsRecords.length > 0
        ? Math.round(
            metricsRecords.reduce(
              (sum, m) => sum + (m.avgResponseTime ?? 0),
              0,
            ) / metricsRecords.length,
          ) / 1000 // Convert ms to seconds for display
        : 0;
    const errorCount = metricsRecords.reduce(
      (sum, m) => sum + m.errorCount,
      0,
    );
    const totalTasks = messagesLast24h + toolInvocationsLast24h;
    const successRate =
      totalTasks > 0
        ? Math.round(((totalTasks - errorCount) / totalTasks) * 1000) / 10
        : 100;

    const uptimeByStatus: Record<string, number> = {
      active: 99.9,
      idle: 95.0,
      error: 0,
      paused: 0,
      provisioning: 0,
    };

    const metrics = {
      tasksCompletedToday: messagesLast24h + toolInvocationsLast24h,
      tasksCompletedTrend: 0,
      avgResponseTime,
      avgResponseTimeTrend: 0,
      successRate,
      uptime: uptimeByStatus[agent.status] ?? 0,
    };

    // Parse tool policy from JSONB (allow-only)
    const toolPolicy = (agent.toolPolicy as { allow: string[] }) ?? {
      allow: [],
    };

    // Total message count for stats
    const totalMessageCount = await this.prisma.agentMetrics.aggregate({
      where: { agentId },
      _sum: { messageCount: true },
    });

    // Build response per contract
    const response: Record<string, unknown> = {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      model: MODEL_DISPLAY_NAMES[agent.modelTier] ?? agent.modelTier,
      modelTier: agent.modelTier,
      thinkingMode: agent.thinkingMode,
      temperature: agent.temperature,
      avatarColor: agent.avatarColor,
      toolPolicy: {
        allow: toolPolicy.allow ?? [],
      },
      metrics,
      stats: {
        messages: totalMessageCount._sum.messageCount ?? 0,
        skills: agent.installedSkills.length,
        uptime: uptimeByStatus[agent.status] ?? 0,
      },
      skills: agent.installedSkills.map((si) => ({
        id: si.skill.id,
        name: si.skill.name,
        version: si.skill.version,
        enabled: true,
      })),
      channels: agent.channels.map((ch) => ({
        type: ch.type,
        handle: '',
        connected: ch.connected,
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

    if (agent.personality) {
      response.personality = agent.personality;
    }

    // Include errorMessage for agents in error status
    if (agent.status === 'error') {
      const latestError = await this.prisma.agentActivity.findFirst({
        where: { agentId: agent.id, type: 'error' },
        orderBy: { timestamp: 'desc' },
      });
      if (latestError) {
        const details = latestError.details as Record<string, unknown> | null;
        response.errorMessage =
          (details?.errorMessage as string) ?? latestError.summary;
      }
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

    if (dto.temperature !== undefined) {
      updateData.temperature = dto.temperature;
    }

    if (dto.avatarColor !== undefined) {
      updateData.avatarColor = dto.avatarColor;
    }

    if (dto.personality !== undefined) {
      updateData.personality = dto.personality;
    }

    if (dto.toolPolicy !== undefined) {
      // Merge with existing tool policy (allow-only)
      const existingPolicy =
        (existing.toolPolicy as { allow?: string[] }) ?? {};
      updateData.toolPolicy = {
        allow: dto.toolPolicy.allow ?? existingPolicy.allow ?? [],
      } as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.agent.update({
      where: { id: agentId },
      data: updateData,
    });

    this.logger.log(`Agent updated: ${agentId} for tenant ${tenantId}`);

    this.auditService.logAction({
      actorType: 'system',
      actorId: 'system',
      actorName: 'system',
      action: 'agent_updated',
      targetType: 'agent',
      targetId: agentId,
      details: { changedFields: Object.keys(dto).filter((k) => (dto as any)[k] !== undefined) },
      severity: 'info',
      tenantId,
      agentId,
    });

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

    this.auditService.logAction({
      actorType: 'system',
      actorId: 'system',
      actorName: 'system',
      action: 'agent_deleted',
      targetType: 'agent',
      targetId: agentId,
      details: { name: existing.name, role: existing.role },
      severity: 'warning',
      tenantId,
      agentId,
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

    this.auditService.logAction({
      actorType: 'system',
      actorId: 'system',
      actorName: 'system',
      action: 'agent_status_changed',
      targetType: 'agent',
      targetId: agentId,
      details: { oldStatus: agent.status, newStatus: 'provisioning', trigger: 'restart' },
      severity: 'info',
      tenantId,
      agentId,
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

    this.auditService.logAction({
      actorType: 'system',
      actorId: 'system',
      actorName: 'system',
      action: 'agent_status_changed',
      targetType: 'agent',
      targetId: agentId,
      details: { oldStatus: agent.status, newStatus: 'paused', trigger: 'pause' },
      severity: 'info',
      tenantId,
      agentId,
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

    this.auditService.logAction({
      actorType: 'system',
      actorId: 'system',
      actorName: 'system',
      action: 'agent_status_changed',
      targetType: 'agent',
      targetId: agentId,
      details: { oldStatus: 'paused', newStatus: 'active', trigger: 'resume' },
      severity: 'info',
      tenantId,
      agentId,
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
  // GET /api/dashboard/agents/:id/activity - Agent Activity Log
  // Returns activity entries mapped to the frontend AgentActionLog shape.
  // ==========================================================================
  async getAgentActivity(
    tenantId: string,
    agentId: string,
    period?: 'today' | 'week' | 'month',
  ) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Determine time range from period
    const now = new Date();
    const since = new Date();
    switch (period) {
      case 'week':
        since.setDate(now.getDate() - 7);
        break;
      case 'month':
        since.setDate(now.getDate() - 30);
        break;
      case 'today':
      default:
        since.setHours(0, 0, 0, 0);
        break;
    }

    const activities = await this.prisma.agentActivity.findMany({
      where: {
        agentId,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    // Map DB ActivityType → frontend ActionType
    const typeMap: Record<string, string> = {
      message: 'skill_invocation',
      tool_invocation: 'tool_execution',
      error: 'error',
    };

    return activities.map((a) => {
      const details = (a.details as Record<string, unknown>) ?? {};
      return {
        id: a.id,
        time: a.timestamp.toISOString(),
        actionType: typeMap[a.type] ?? a.type,
        target: (details.toolName as string) ?? a.summary,
        detail: (details.errorMessage as string) ?? (details.messagePreview as string) ?? undefined,
        duration: details.durationMs
          ? `${Math.round(details.durationMs as number)}ms`
          : '--',
        status:
          a.type === 'error'
            ? 'error'
            : details.warning
              ? 'warning'
              : 'success',
      };
    });
  }

  // ==========================================================================
  // GET /api/dashboard/agents/:id/logs - Agent Logs
  // Returns activity entries mapped to the frontend AgentLogEntry shape.
  // ==========================================================================
  async getAgentLogs(
    tenantId: string,
    agentId: string,
    level?: 'info' | 'warn' | 'error',
  ) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Map log level filter to DB ActivityType
    const levelToType: Record<string, string> = {
      info: 'message',
      warn: 'tool_invocation',
      error: 'error',
    };

    const where: Record<string, unknown> = { agentId };
    if (level && levelToType[level]) {
      where.type = levelToType[level];
    }

    const activities = await this.prisma.agentActivity.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: 200,
    });

    // Map DB type → log level
    const typeToLevel: Record<string, string> = {
      message: 'info',
      tool_invocation: 'info',
      error: 'error',
    };

    return activities.map((a) => ({
      id: a.id,
      timestamp: a.timestamp.toISOString(),
      level: typeToLevel[a.type] ?? 'info',
      message: a.summary,
    }));
  }

  // ==========================================================================
  // GET /api/dashboard/agents/:id/tool-policy - Get Agent Tool Policy
  // Response: { agentId, agentName, role, policy: { allow }, availableCategories }
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
    }) ?? { allow: [] };

    return {
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      policy: {
        allow: toolPolicy.allow ?? [],
      },
      availableCategories: TOOL_CATEGORIES,
    };
  }

  // ==========================================================================
  // PUT /api/dashboard/agents/:id/tool-policy - Update Agent Tool Policy
  // Request: { allow: string[] }
  // Response: { agentId, policy: { allow }, updatedAt }
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
