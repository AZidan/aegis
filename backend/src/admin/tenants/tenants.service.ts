import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ProvisioningService } from '../../provisioning/provisioning.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { Prisma } from '../../../prisma/generated/client';
import { PLAN_MAX_SKILLS } from '../../provisioning/provisioning.constants';

/**
 * Tenants Service - Platform Admin: Tenants
 * Implements all 8 tenant management operations from API Contract v1.2.0 Section 3.
 *
 * NOTE on delete: The contract specifies "pending_deletion" status but the Prisma
 * TenantStatus enum only has: active | suspended | provisioning | failed.
 * For now we use "suspended" status and store deletion metadata in resourceLimits JSON.
 * TODO: Add "pending_deletion" to the TenantStatus enum via a Prisma migration.
 */

/** Default resource limits per plan (including maxSkills) */
const PLAN_DEFAULTS: Record<
  string,
  {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
    maxAgents: number;
    maxSkills: number;
  }
> = {
  starter: {
    cpuCores: 2,
    memoryMb: 2048,
    diskGb: 10,
    maxAgents: 3,
    maxSkills: 5,
  },
  growth: {
    cpuCores: 4,
    memoryMb: 4096,
    diskGb: 25,
    maxAgents: 10,
    maxSkills: 15,
  },
  enterprise: {
    cpuCores: 8,
    memoryMb: 8192,
    diskGb: 50,
    maxAgents: 50,
    maxSkills: 50,
  },
};

/** Default model defaults per plan */
const MODEL_DEFAULTS: Record<
  string,
  { tier: string; thinkingMode: string }
> = {
  starter: { tier: 'haiku', thinkingMode: 'off' },
  growth: { tier: 'sonnet', thinkingMode: 'low' },
  enterprise: { tier: 'opus', thinkingMode: 'high' },
};

/**
 * Accessor for the tenantConfigHistory model on PrismaService.
 * This model was added to schema.prisma but the Prisma client has not been
 * regenerated yet.  We cast through `any` so that the existing (stale)
 * generated types do not block compilation.  After running `prisma generate`
 * this helper can be removed and the service can reference
 * `this.prisma.tenantConfigHistory` directly.
 */
function configHistoryModel(prisma: PrismaService): any {
  return (prisma as any).tenantConfigHistory;
}

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioningService: ProvisioningService,
    private readonly auditService: AuditService,
  ) {}

  // ==========================================================================
  // GET /api/admin/tenants - List Tenants (Paginated)
  // Contract: Section 3 - List Tenants
  // ==========================================================================
  async listTenants(query: ListTenantsQueryDto) {
    const { page, limit, status, plan, health, search, include, sort } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.TenantWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (plan) {
      where.plan = plan;
    }

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { adminEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy clause
    let orderBy: Prisma.TenantOrderByWithRelationInput | undefined;
    if (sort) {
      const [field, direction] = sort.split(':') as [string, 'asc' | 'desc'];
      switch (field) {
        case 'company_name':
          orderBy = { companyName: direction };
          break;
        case 'created_at':
          orderBy = { createdAt: direction };
          break;
        // agent_count sorting handled after query (computed field)
        default:
          orderBy = { createdAt: 'desc' };
      }
    } else {
      orderBy = { createdAt: 'desc' };
    }

    // Determine if we need agent_count sorting (special case: cannot be done in DB)
    const isAgentCountSort = sort?.startsWith('agent_count');

    // Query tenants with agent count
    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: isAgentCountSort ? undefined : skip,
        take: isAgentCountSort ? undefined : limit,
        orderBy: isAgentCountSort ? undefined : orderBy,
        include: {
          _count: {
            select: { agents: true },
          },
          containerHealth:
            include === 'health' || include === 'all'
              ? {
                  orderBy: { timestamp: 'desc' },
                  take: 1,
                }
              : false,
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    // Health filtering (post-query since health is from a related table)
    let filteredTenants = tenants;
    if (health) {
      filteredTenants = tenants.filter((t) => {
        const latestHealth = t.containerHealth?.[0];
        return latestHealth?.status === health;
      });
    }

    // Agent count sorting (post-query)
    if (isAgentCountSort) {
      const direction = sort?.endsWith(':desc') ? -1 : 1;
      filteredTenants.sort(
        (a, b) => direction * (a._count.agents - b._count.agents),
      );
      filteredTenants = filteredTenants.slice(skip, skip + limit);
    }

    // Map to response format per contract
    const data = filteredTenants.map((tenant) => {
      const item: Record<string, unknown> = {
        id: tenant.id,
        companyName: tenant.companyName,
        adminEmail: tenant.adminEmail,
        status: tenant.status,
        plan: tenant.plan,
        agentCount: tenant._count.agents,
        createdAt: tenant.createdAt.toISOString(),
      };

      // Include health data if requested
      if (
        (include === 'health' || include === 'all') &&
        tenant.containerHealth?.length
      ) {
        const h = tenant.containerHealth[0];
        item.health = {
          status: h.status,
          cpu: h.cpuPercent,
          memory: h.memoryMb,
          disk: h.diskGb,
        };
      }

      return item;
    });

    const effectiveTotal = health ? filteredTenants.length : total;

    return {
      data,
      meta: {
        page,
        limit,
        total: effectiveTotal,
        totalPages: Math.ceil(effectiveTotal / limit),
      },
    };
  }

  // ==========================================================================
  // POST /api/admin/tenants - Create Tenant
  // Contract: Section 3 - Create Tenant
  // ==========================================================================
  async createTenant(dto: CreateTenantDto, userId?: string) {
    // Check for duplicate company name
    const existing = await this.prisma.tenant.findUnique({
      where: { companyName: dto.companyName },
    });

    if (existing) {
      throw new ConflictException('Company name already exists');
    }

    // Resolve defaults based on plan
    const planDefaults = PLAN_DEFAULTS[dto.plan];
    const modelDefaults = dto.modelDefaults || MODEL_DEFAULTS[dto.plan];

    // Build resource limits, merging any provided maxSkills
    const baseResourceLimits = dto.resourceLimits || planDefaults;
    const resourceLimits = {
      ...baseResourceLimits,
      maxSkills:
        dto.resourceLimits?.maxSkills ??
        PLAN_MAX_SKILLS[dto.plan] ??
        planDefaults.maxSkills,
    };

    const tenant = await this.prisma.tenant.create({
      data: {
        companyName: dto.companyName,
        adminEmail: dto.adminEmail,
        status: 'provisioning',
        plan: dto.plan,
        industry: dto.industry,
        expectedAgentCount: dto.expectedAgentCount,
        companySize: dto.companySize,
        deploymentRegion: dto.deploymentRegion,
        notes: dto.notes,
        billingCycle: dto.billingCycle || 'monthly',
        modelDefaults: modelDefaults as Prisma.InputJsonValue,
        resourceLimits: resourceLimits as Prisma.InputJsonValue,
      },
    });

    // Generate a placeholder invite link (actual email sending is Sprint 2)
    const inviteLink = `https://app.aegis.ai/invite/${tenant.id}`;

    this.logger.log(
      `Tenant created: ${tenant.id} (${tenant.companyName}) - status: provisioning`,
    );

    // Start async provisioning via BullMQ
    await this.provisioningService.startProvisioning(tenant.id);

    this.auditService.logAction({
      actorType: 'user',
      actorId: userId || 'system',
      actorName: userId || 'system',
      action: 'tenant_created',
      targetType: 'tenant',
      targetId: tenant.id,
      details: {
        companyName: tenant.companyName,
        adminEmail: tenant.adminEmail,
        plan: tenant.plan,
      },
      severity: 'info',
      tenantId: tenant.id,
    });

    // Contract response: { id, companyName, adminEmail, status, plan, inviteLink, createdAt }
    return {
      id: tenant.id,
      companyName: tenant.companyName,
      adminEmail: tenant.adminEmail,
      status: tenant.status,
      plan: tenant.plan,
      inviteLink,
      createdAt: tenant.createdAt.toISOString(),
    };
  }

  // ==========================================================================
  // GET /api/admin/tenants/:id - Get Tenant Detail
  // Contract: Section 3 - Get Tenant Detail
  // ==========================================================================
  async getTenantDetail(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: { agents: true },
        },
        containerHealth: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Build container health (stub with mock data if no real data exists)
    const latestHealth = tenant.containerHealth[0];
    const containerHealth = latestHealth
      ? {
          status: latestHealth.status,
          cpu: latestHealth.cpuPercent,
          memory: latestHealth.memoryMb,
          disk: latestHealth.diskGb,
          uptime: latestHealth.uptime,
          lastHealthCheck: latestHealth.timestamp.toISOString(),
        }
      : {
          status: 'healthy' as const,
          cpu: 0,
          memory: 0,
          disk: 0,
          uptime: 0,
          lastHealthCheck: new Date().toISOString(),
        };

    // Parse JSON fields with safe defaults (now includes maxSkills)
    const resourceLimits = (tenant.resourceLimits as Record<string, number>) ||
      PLAN_DEFAULTS[tenant.plan] || {
        cpuCores: 2,
        memoryMb: 2048,
        diskGb: 10,
        maxAgents: 3,
        maxSkills: 5,
      };

    const modelDefaults = (tenant.modelDefaults as Record<string, string>) ||
      MODEL_DEFAULTS[tenant.plan] || {
        tier: 'haiku',
        thinkingMode: 'off',
      };

    // Build response per contract
    const response: Record<string, unknown> = {
      id: tenant.id,
      companyName: tenant.companyName,
      adminEmail: tenant.adminEmail,
      status: tenant.status,
      plan: tenant.plan,
      billingCycle: tenant.billingCycle,
      agentCount: tenant._count.agents,
      containerHealth,
      resourceLimits: {
        cpuCores: resourceLimits.cpuCores,
        memoryMb: resourceLimits.memoryMb,
        diskGb: resourceLimits.diskGb,
        maxAgents: resourceLimits.maxAgents,
        maxSkills: resourceLimits.maxSkills ?? PLAN_MAX_SKILLS[tenant.plan] ?? 5,
      },
      config: {
        modelDefaults: {
          tier: modelDefaults.tier,
          thinkingMode: modelDefaults.thinkingMode,
        },
        containerEndpoint: tenant.containerUrl || '',
      },
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
    };

    // Include optional fields per contract
    if (tenant.companySize) {
      response.companySize = tenant.companySize;
    }
    if (tenant.deploymentRegion) {
      response.deploymentRegion = tenant.deploymentRegion;
    }

    // Include provisioning object when status is "provisioning" or "failed"
    // Per contract: provisioning?: { step, progress, message, attemptNumber, startedAt, failedReason? }
    if (tenant.status === 'provisioning' || tenant.status === 'failed') {
      const provisioningData: Record<string, unknown> = {
        step: tenant.provisioningStep || 'creating_namespace',
        progress: tenant.provisioningProgress,
        message: tenant.provisioningMessage || 'Provisioning in progress...',
        attemptNumber: tenant.provisioningAttempt,
        startedAt: tenant.provisioningStartedAt
          ? tenant.provisioningStartedAt.toISOString()
          : new Date().toISOString(),
      };

      if (tenant.provisioningFailedReason) {
        provisioningData.failedReason = tenant.provisioningFailedReason;
      }

      response.provisioning = provisioningData;
    }

    return response;
  }

  // ==========================================================================
  // PATCH /api/admin/tenants/:id - Update Tenant Config
  // Contract: Section 3 - Update Tenant Config
  // ==========================================================================
  async updateTenantConfig(id: string, dto: UpdateTenantDto, userId?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Save current config to history before updating
    await configHistoryModel(this.prisma).create({
      data: {
        tenantId: id,
        config: {
          plan: tenant.plan,
          resourceLimits: tenant.resourceLimits,
          modelDefaults: tenant.modelDefaults,
        } as Prisma.InputJsonValue,
        changedBy: userId || 'system',
        changeDescription: this.buildChangeDescription(tenant, dto),
      },
    });

    // Build update data
    const updateData: Prisma.TenantUpdateInput = {};

    if (dto.plan) {
      updateData.plan = dto.plan;
    }

    if (dto.resourceLimits) {
      // Merge with existing resource limits
      const existing =
        (tenant.resourceLimits as Record<string, number>) || {};
      updateData.resourceLimits = {
        ...existing,
        ...dto.resourceLimits,
      } as Prisma.InputJsonValue;
    }

    if (dto.modelDefaults) {
      // Merge with existing model defaults
      const existing =
        (tenant.modelDefaults as Record<string, string>) || {};
      updateData.modelDefaults = {
        ...existing,
        ...dto.modelDefaults,
      } as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: updateData,
    });

    this.auditService.logAction({
      actorType: 'user',
      actorId: userId || 'system',
      actorName: userId || 'system',
      action: 'tenant_config_updated',
      targetType: 'tenant',
      targetId: id,
      details: {
        changedFields: Object.keys(dto).filter(
          (k) => (dto as Record<string, unknown>)[k] !== undefined,
        ),
        before: {
          plan: tenant.plan,
          resourceLimits: tenant.resourceLimits,
          modelDefaults: tenant.modelDefaults,
        },
        after: {
          plan: updated.plan,
          resourceLimits: updated.resourceLimits,
          modelDefaults: updated.modelDefaults,
        },
      },
      severity: 'info',
      tenantId: id,
    });

    this.logger.log(`Tenant config updated: ${id}`);

    // Contract response
    return {
      id: updated.id,
      companyName: updated.companyName,
      plan: updated.plan,
      resourceLimits: updated.resourceLimits,
      modelDefaults: updated.modelDefaults,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ==========================================================================
  // DELETE /api/admin/tenants/:id - Delete Tenant (Soft Delete)
  // Contract: Section 3 - Delete Tenant
  // NOTE: Contract specifies "pending_deletion" status but enum lacks it.
  //       Using "suspended" with metadata until enum is updated via migration.
  // ==========================================================================
  async deleteTenant(id: string, userId?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    this.auditService.logAction({
      actorType: 'user',
      actorId: userId || 'system',
      actorName: userId || 'system',
      action: 'tenant_deleted',
      targetType: 'tenant',
      targetId: id,
      details: {
        companyName: tenant.companyName,
        adminEmail: tenant.adminEmail,
        plan: tenant.plan,
        status: tenant.status,
      },
      severity: 'warning',
      tenantId: id,
    });

    // Calculate grace period end date (7 days from now)
    const gracePeriodEnds = new Date();
    gracePeriodEnds.setDate(gracePeriodEnds.getDate() + 7);

    // Soft delete: change status to "suspended" and store deletion metadata
    // TODO: When "pending_deletion" is added to TenantStatus enum, use that instead
    const existingLimits =
      (tenant.resourceLimits as Record<string, unknown>) || {};

    await this.prisma.tenant.update({
      where: { id },
      data: {
        status: 'suspended',
        resourceLimits: {
          ...existingLimits,
          _deletionScheduled: true,
          _gracePeriodEnds: gracePeriodEnds.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `Tenant scheduled for deletion: ${id}, grace period ends: ${gracePeriodEnds.toISOString()}`,
    );

    const formattedDate = gracePeriodEnds.toISOString().split('T')[0];

    // Contract response
    return {
      id,
      status: 'pending_deletion',
      gracePeriodEnds: gracePeriodEnds.toISOString(),
      message: `Tenant scheduled for deletion. Permanent deletion on ${formattedDate}`,
    };
  }

  // ==========================================================================
  // POST /api/admin/tenants/:id/actions/restart - Restart Container
  // Contract: Section 3 - Restart Tenant Container
  // NOTE: Stub for MVP - actual container restart is Sprint 2
  // ==========================================================================
  async restartContainer(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    this.logger.log(`Container restart initiated for tenant: ${id}`);

    // Contract response (202 Accepted - async operation)
    return {
      message: 'Container restart initiated',
      tenantId: id,
      estimatedDowntime: 45, // Seconds, typically 30-60s
    };
  }

  // ==========================================================================
  // GET /api/admin/tenants/:id/health - Get Tenant Container Health
  // Contract: Section 3 - Get Tenant Container Health
  // NOTE: Stub with mock data for MVP - actual metrics collection is Sprint 2
  // ==========================================================================
  async getTenantHealth(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Try to get latest health record from DB
    const latestHealth = await this.prisma.containerHealth.findFirst({
      where: { tenantId: id },
      orderBy: { timestamp: 'desc' },
    });

    // Get 24h history (data points every ~5 minutes = 288 points max)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const historyRecords = await this.prisma.containerHealth.findMany({
      where: {
        tenantId: id,
        timestamp: { gte: twentyFourHoursAgo },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Build current health (use real data if available, otherwise stub)
    const current = latestHealth
      ? {
          status: latestHealth.status,
          cpu: latestHealth.cpuPercent,
          memory: latestHealth.memoryMb,
          disk: latestHealth.diskGb,
          uptime: latestHealth.uptime,
          timestamp: latestHealth.timestamp.toISOString(),
        }
      : {
          status: 'healthy' as const,
          cpu: 12.5,
          memory: 45.2,
          disk: 23.1,
          uptime: 86400,
          timestamp: new Date().toISOString(),
        };

    // Build 24h history (use real data if available, otherwise stub with sample points)
    const history24h =
      historyRecords.length > 0
        ? historyRecords.map((record) => ({
            timestamp: record.timestamp.toISOString(),
            cpu: record.cpuPercent,
            memory: record.memoryMb,
            disk: record.diskGb,
            status: record.status,
          }))
        : this.generateMockHealthHistory();

    // Contract response
    return {
      current,
      history24h,
    };
  }

  // ==========================================================================
  // GET /api/admin/tenants/:id/agents - Get Tenant Agents
  // Contract: Section 3 - Get Tenant Agents
  // ==========================================================================
  async getTenantAgents(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const agents = await this.prisma.agent.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
    });

    // Contract response
    return {
      data: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        status: agent.status,
        modelTier: agent.modelTier,
        lastActive: agent.lastActive
          ? agent.lastActive.toISOString()
          : agent.createdAt.toISOString(),
        createdAt: agent.createdAt.toISOString(),
      })),
    };
  }

  // ==========================================================================
  // GET /api/admin/tenants/:id/config/history - Get Config History
  // ==========================================================================
  async getConfigHistory(tenantId: string, page = 1, limit = 20) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const configHistory = configHistoryModel(this.prisma);

    const [history, total] = await Promise.all([
      configHistory.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      configHistory.count({ where: { tenantId } }),
    ]);

    return {
      data: (history as any[]).map((h: any) => ({
        id: h.id,
        config: h.config,
        changedBy: h.changedBy,
        changeDescription: h.changeDescription,
        createdAt: h.createdAt.toISOString(),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ==========================================================================
  // POST /api/admin/tenants/:id/config/rollback - Rollback Config
  // ==========================================================================
  async rollbackConfig(tenantId: string, historyId: string, userId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const configHistory = configHistoryModel(this.prisma);

    const historyEntry = await configHistory.findFirst({
      where: { id: historyId, tenantId },
    });
    if (!historyEntry) throw new NotFoundException('Config history entry not found');

    const config = historyEntry.config as { plan?: string; resourceLimits?: any; modelDefaults?: any };

    // Save current config to history before rolling back (audit trail)
    await configHistory.create({
      data: {
        tenantId,
        config: {
          plan: tenant.plan,
          resourceLimits: tenant.resourceLimits,
          modelDefaults: tenant.modelDefaults,
        } as Prisma.InputJsonValue,
        changedBy: userId || 'system',
        changeDescription: `Rollback to version from ${historyEntry.createdAt.toISOString()}`,
      },
    });

    // Apply the historical config
    const updateData: Prisma.TenantUpdateInput = {};
    if (config.plan) updateData.plan = config.plan as any;
    if (config.resourceLimits) updateData.resourceLimits = config.resourceLimits as Prisma.InputJsonValue;
    if (config.modelDefaults) updateData.modelDefaults = config.modelDefaults as Prisma.InputJsonValue;

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    this.logger.log(`Config rolled back for tenant ${tenantId} to history entry ${historyId}`);

    return {
      id: updated.id,
      companyName: updated.companyName,
      plan: updated.plan,
      resourceLimits: updated.resourceLimits,
      modelDefaults: updated.modelDefaults,
      updatedAt: updated.updatedAt.toISOString(),
      message: 'Configuration rolled back successfully. Changes will propagate within 60 seconds.',
    };
  }

  // ==========================================================================
  // Helper: Build human-readable change description for config history
  // ==========================================================================
  buildChangeDescription(tenant: any, dto: UpdateTenantDto): string {
    const changes: string[] = [];
    if (dto.plan && dto.plan !== tenant.plan) changes.push(`Plan: ${tenant.plan} -> ${dto.plan}`);
    if (dto.resourceLimits) changes.push('Resource limits updated');
    if (dto.modelDefaults) changes.push('Model defaults updated');
    return changes.join(', ') || 'Configuration updated';
  }

  // ==========================================================================
  // Helper: Generate mock health history for MVP
  // ==========================================================================
  private generateMockHealthHistory(): Array<{
    timestamp: string;
    cpu: number;
    memory: number;
    disk: number;
    status: string;
  }> {
    const points: Array<{
      timestamp: string;
      cpu: number;
      memory: number;
      disk: number;
      status: string;
    }> = [];
    const now = Date.now();

    // Generate 24 data points (every hour for 24 hours)
    for (let i = 24; i >= 0; i--) {
      const timestamp = new Date(now - i * 60 * 60 * 1000);
      points.push({
        timestamp: timestamp.toISOString(),
        cpu: Math.round((10 + Math.random() * 30) * 10) / 10,
        memory: Math.round((40 + Math.random() * 20) * 10) / 10,
        disk: Math.round((20 + Math.random() * 10) * 10) / 10,
        status: 'healthy',
      });
    }

    return points;
  }
}
