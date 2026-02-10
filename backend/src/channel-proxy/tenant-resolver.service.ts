import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { ROUTING_CACHE_TTL_MS } from './channel-proxy.constants';

@Injectable()
export class TenantResolverService {
  private readonly logger = new Logger(TenantResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * Resolve a workspace to its tenant via ChannelConnection.
   * Cached in Redis for 5 minutes.
   */
  async resolveWorkspaceToTenant(
    platform: string,
    workspaceId: string,
  ): Promise<{ tenantId: string; connectionId: string } | null> {
    const cacheKey = `workspace-tenant:${platform}:${workspaceId}`;
    const cached = await this.cache.get<{
      tenantId: string;
      connectionId: string;
    }>(cacheKey);
    if (cached) return cached;

    const connection = await this.prisma.channelConnection.findFirst({
      where: {
        platform: platform as any,
        workspaceId,
        status: 'active',
      },
      select: { id: true, tenantId: true },
    });

    if (!connection) return null;

    const result = {
      tenantId: connection.tenantId,
      connectionId: connection.id,
    };
    await this.cache.set(cacheKey, result, ROUTING_CACHE_TTL_MS);

    return result;
  }
}
