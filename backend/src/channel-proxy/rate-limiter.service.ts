import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  RATE_LIMIT_DEFAULT_RPM,
  RATE_LIMIT_WINDOW_MS,
} from './channel-proxy.constants';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetMs: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * Check rate limit for a tenant. Uses Redis sliding window counter.
   * Returns 429-style result when exceeded.
   */
  async checkRateLimit(
    tenantId: string,
    limitRpm: number = RATE_LIMIT_DEFAULT_RPM,
  ): Promise<RateLimitResult> {
    const key = `rate-limit:${tenantId}`;
    const currentRaw = await this.cache.get<number>(key);
    const current = (currentRaw ?? 0) + 1;

    await this.cache.set(key, current, RATE_LIMIT_WINDOW_MS);

    const allowed = current <= limitRpm;
    const remaining = Math.max(0, limitRpm - current);

    if (!allowed) {
      this.logger.warn(
        `Rate limit exceeded for tenant ${tenantId}: ${current}/${limitRpm}`,
      );
    }

    return {
      allowed,
      remaining,
      limit: limitRpm,
      resetMs: RATE_LIMIT_WINDOW_MS,
    };
  }
}
