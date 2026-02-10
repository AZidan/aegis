import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { randomUUID } from 'crypto';
import { SessionContext } from './interfaces/channel-proxy.interface';
import { SESSION_TTL_MS } from './channel-proxy.constants';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * Get an existing session or create a new one.
   * Session key: channel-session:{tenantId}:{platform}:{workspaceId}:{channelId}:{userId}
   */
  async getOrCreateSession(params: {
    tenantId: string;
    agentId: string;
    platform: string;
    workspaceId: string;
    channelId?: string;
    userId?: string;
  }): Promise<SessionContext> {
    const key = this.sessionKey(
      params.tenantId,
      params.platform,
      params.workspaceId,
      params.channelId,
      params.userId,
    );
    const existing = await this.cache.get<SessionContext>(key);

    if (existing) {
      // Touch: update lastActivityAt
      existing.lastActivityAt = new Date().toISOString();
      await this.cache.set(key, existing, SESSION_TTL_MS);
      return existing;
    }

    const session: SessionContext = {
      sessionId: randomUUID(),
      tenantId: params.tenantId,
      agentId: params.agentId,
      platform: params.platform,
      workspaceId: params.workspaceId,
      channelId: params.channelId,
      userId: params.userId,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };

    await this.cache.set(key, session, SESSION_TTL_MS);
    this.logger.log(
      `Session created: ${session.sessionId} for tenant ${params.tenantId}`,
    );
    return session;
  }

  /**
   * Get session by key components.
   */
  async getSession(
    tenantId: string,
    platform: string,
    workspaceId: string,
    channelId?: string,
    userId?: string,
  ): Promise<SessionContext | null> {
    const key = this.sessionKey(
      tenantId,
      platform,
      workspaceId,
      channelId,
      userId,
    );
    return (await this.cache.get<SessionContext>(key)) ?? null;
  }

  /**
   * Touch session to refresh TTL.
   */
  async touchSession(
    tenantId: string,
    platform: string,
    workspaceId: string,
    channelId?: string,
    userId?: string,
  ): Promise<void> {
    const key = this.sessionKey(
      tenantId,
      platform,
      workspaceId,
      channelId,
      userId,
    );
    const session = await this.cache.get<SessionContext>(key);
    if (session) {
      session.lastActivityAt = new Date().toISOString();
      await this.cache.set(key, session, SESSION_TTL_MS);
    }
  }

  private sessionKey(
    tenantId: string,
    platform: string,
    workspaceId: string,
    channelId?: string,
    userId?: string,
  ): string {
    return `channel-session:${tenantId}:${platform}:${workspaceId}:${channelId ?? '*'}:${userId ?? '*'}`;
  }
}
