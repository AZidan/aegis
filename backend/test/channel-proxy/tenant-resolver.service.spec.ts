import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TenantResolverService } from '../../src/channel-proxy/tenant-resolver.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ROUTING_CACHE_TTL_MS } from '../../src/channel-proxy/channel-proxy.constants';

describe('TenantResolverService', () => {
  let service: TenantResolverService;
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let prisma: {
    channelConnection: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    prisma = {
      channelConnection: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantResolverService,
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(TenantResolverService);
  });

  it('should return tenant when connection found in DB', async () => {
    cache.get.mockResolvedValue(null);
    prisma.channelConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      tenantId: 'tenant-1',
    });

    const result = await service.resolveWorkspaceToTenant('SLACK', 'ws-1');

    expect(result).toEqual({ tenantId: 'tenant-1', connectionId: 'conn-1' });
    expect(prisma.channelConnection.findFirst).toHaveBeenCalledWith({
      where: { platform: 'SLACK', workspaceId: 'ws-1', status: 'active' },
      select: { id: true, tenantId: true },
    });
  });

  it('should return null when no connection found', async () => {
    cache.get.mockResolvedValue(null);
    prisma.channelConnection.findFirst.mockResolvedValue(null);

    const result = await service.resolveWorkspaceToTenant('SLACK', 'ws-404');

    expect(result).toBeNull();
  });

  it('should use cache on second call', async () => {
    const cached = { tenantId: 'tenant-1', connectionId: 'conn-1' };
    cache.get.mockResolvedValue(cached);

    const result = await service.resolveWorkspaceToTenant('SLACK', 'ws-1');

    expect(result).toEqual(cached);
    expect(prisma.channelConnection.findFirst).not.toHaveBeenCalled();
  });

  it('should go to DB on cache miss', async () => {
    cache.get.mockResolvedValue(null);
    prisma.channelConnection.findFirst.mockResolvedValue({
      id: 'conn-2',
      tenantId: 'tenant-2',
    });

    const result = await service.resolveWorkspaceToTenant('TEAMS', 'ws-2');

    expect(result).toEqual({ tenantId: 'tenant-2', connectionId: 'conn-2' });
    expect(cache.get).toHaveBeenCalledWith('workspace-tenant:TEAMS:ws-2');
    expect(prisma.channelConnection.findFirst).toHaveBeenCalled();
  });

  it('should only find active connections', async () => {
    cache.get.mockResolvedValue(null);
    prisma.channelConnection.findFirst.mockResolvedValue(null);

    await service.resolveWorkspaceToTenant('DISCORD', 'ws-3');

    expect(prisma.channelConnection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'active' }),
      }),
    );
  });

  it('should cache result with correct TTL', async () => {
    cache.get.mockResolvedValue(null);
    prisma.channelConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      tenantId: 'tenant-1',
    });

    await service.resolveWorkspaceToTenant('SLACK', 'ws-1');

    expect(cache.set).toHaveBeenCalledWith(
      'workspace-tenant:SLACK:ws-1',
      { tenantId: 'tenant-1', connectionId: 'conn-1' },
      ROUTING_CACHE_TTL_MS,
    );
  });
});
