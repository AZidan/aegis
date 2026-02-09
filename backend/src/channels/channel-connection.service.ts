import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { ChannelConnectionResponse } from './interfaces/channel.interface';

/**
 * ChannelConnectionService
 *
 * Manages CRUD operations for channel platform connections (Slack, Teams,
 * Discord, Google Chat). Each connection binds a tenant to a specific
 * workspace on a platform and stores encrypted OAuth/bot credentials.
 *
 * All mutations emit fire-and-forget audit log events.
 */
@Injectable()
export class ChannelConnectionService {
  private readonly logger = new Logger(ChannelConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * List all channel connections for a tenant.
   */
  async listConnections(tenantId: string): Promise<ChannelConnectionResponse[]> {
    const connections = await this.prisma.channelConnection.findMany({
      where: { tenantId },
      include: {
        _count: { select: { routingRules: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return connections.map((c) => this.serialize(c));
  }

  /**
   * Get a single connection by ID with tenant ownership check.
   */
  async getConnection(id: string, tenantId: string): Promise<ChannelConnectionResponse> {
    const connection = await this.prisma.channelConnection.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { routingRules: true } },
      },
    });

    if (!connection) {
      throw new NotFoundException('Channel connection not found');
    }

    return this.serialize(connection);
  }

  /**
   * Create a new channel connection.
   * Enforces unique constraint: (tenantId, platform, workspaceId).
   */
  async createConnection(
    dto: CreateConnectionDto,
    tenantId: string,
    userId: string,
  ): Promise<ChannelConnectionResponse> {
    // Check for existing connection with same platform + workspace
    const existing = await this.prisma.channelConnection.findUnique({
      where: {
        tenantId_platform_workspaceId: {
          tenantId,
          platform: dto.platform as any,
          workspaceId: dto.workspaceId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A connection for ${dto.platform} workspace "${dto.workspaceId}" already exists`,
      );
    }

    const connection = await this.prisma.channelConnection.create({
      data: {
        tenantId,
        platform: dto.platform as any,
        workspaceId: dto.workspaceId,
        workspaceName: dto.workspaceName,
        credentials: dto.credentials as any,
        status: 'pending',
      },
      include: {
        _count: { select: { routingRules: true } },
      },
    });

    // Audit log (fire-and-forget)
    this.auditService.logAction({
      actorType: 'user',
      actorId: userId,
      actorName: userId,
      action: 'channel_connection_created',
      targetType: 'channel',
      targetId: connection.id,
      details: {
        platform: dto.platform,
        workspaceId: dto.workspaceId,
        workspaceName: dto.workspaceName,
      },
      severity: 'info',
      tenantId,
      userId,
    });

    this.logger.log(
      `Created channel connection ${connection.id} (${dto.platform}) for tenant ${tenantId}`,
    );

    return this.serialize(connection);
  }

  /**
   * Update an existing channel connection.
   */
  async updateConnection(
    id: string,
    dto: UpdateConnectionDto,
    tenantId: string,
    userId: string,
  ): Promise<ChannelConnectionResponse> {
    // Verify ownership
    const existing = await this.prisma.channelConnection.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Channel connection not found');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.workspaceName !== undefined) updateData.workspaceName = dto.workspaceName;
    if (dto.credentials !== undefined) updateData.credentials = dto.credentials;
    if (dto.status !== undefined) {
      updateData.status = dto.status;
      // Set connectedAt when transitioning to active
      if (dto.status === 'active' && existing.status !== 'active') {
        updateData.connectedAt = new Date();
      }
    }

    const connection = await this.prisma.channelConnection.update({
      where: { id },
      data: updateData as any,
      include: {
        _count: { select: { routingRules: true } },
      },
    });

    // Audit log (fire-and-forget)
    this.auditService.logAction({
      actorType: 'user',
      actorId: userId,
      actorName: userId,
      action: 'channel_connection_updated',
      targetType: 'channel',
      targetId: connection.id,
      details: {
        platform: connection.platform,
        workspaceId: connection.workspaceId,
        updatedFields: Object.keys(dto).filter(
          (k) => (dto as Record<string, unknown>)[k] !== undefined,
        ),
      },
      severity: 'info',
      tenantId,
      userId,
    });

    return this.serialize(connection);
  }

  /**
   * Delete a channel connection and all associated routing rules (cascade).
   */
  async deleteConnection(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<{ deleted: true }> {
    const existing = await this.prisma.channelConnection.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Channel connection not found');
    }

    await this.prisma.channelConnection.delete({ where: { id } });

    // Audit log (fire-and-forget)
    this.auditService.logAction({
      actorType: 'user',
      actorId: userId,
      actorName: userId,
      action: 'channel_connection_deleted',
      targetType: 'channel',
      targetId: id,
      details: {
        platform: existing.platform,
        workspaceId: existing.workspaceId,
        workspaceName: existing.workspaceName,
      },
      severity: 'warning',
      tenantId,
      userId,
    });

    this.logger.log(
      `Deleted channel connection ${id} (${existing.platform}) for tenant ${tenantId}`,
    );

    return { deleted: true };
  }

  /**
   * Serialize a ChannelConnection record for API response.
   * Strips credentials to avoid leaking secrets.
   */
  private serialize(connection: any): ChannelConnectionResponse {
    return {
      id: connection.id,
      tenantId: connection.tenantId,
      platform: connection.platform,
      workspaceId: connection.workspaceId,
      workspaceName: connection.workspaceName,
      status: connection.status,
      connectedAt: connection.connectedAt?.toISOString() ?? null,
      lastHealthCheck: connection.lastHealthCheck?.toISOString() ?? null,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
      routingRuleCount: connection._count?.routingRules ?? 0,
    };
  }
}
