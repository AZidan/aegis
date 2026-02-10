import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RateLimiterService } from '../../src/channel-proxy/rate-limiter.service';
import {
  RATE_LIMIT_DEFAULT_RPM,
  RATE_LIMIT_WINDOW_MS,
} from '../../src/channel-proxy/channel-proxy.constants';

describe('RateLimiterService', () => {
  let service: RateLimiterService;
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimiterService,
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get(RateLimiterService);
  });

  it('should allow when under limit', async () => {
    cache.get.mockResolvedValue(5);

    const result = await service.checkRateLimit('tenant-1');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(RATE_LIMIT_DEFAULT_RPM - 6); // 5 + 1 = 6
    expect(result.limit).toBe(RATE_LIMIT_DEFAULT_RPM);
    expect(result.resetMs).toBe(RATE_LIMIT_WINDOW_MS);
  });

  it('should deny when over limit', async () => {
    cache.get.mockResolvedValue(RATE_LIMIT_DEFAULT_RPM);

    const result = await service.checkRateLimit('tenant-1');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should return correct remaining count', async () => {
    cache.get.mockResolvedValue(null); // First request

    const result = await service.checkRateLimit('tenant-1');

    // current = (null ?? 0) + 1 = 1
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(RATE_LIMIT_DEFAULT_RPM - 1);
  });

  it('should increment counter in cache', async () => {
    cache.get.mockResolvedValue(10);

    await service.checkRateLimit('tenant-1');

    expect(cache.set).toHaveBeenCalledWith(
      'rate-limit:tenant-1',
      11, // 10 + 1
      RATE_LIMIT_WINDOW_MS,
    );
  });
});
