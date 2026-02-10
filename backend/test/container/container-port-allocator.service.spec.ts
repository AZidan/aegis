import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ContainerPortAllocatorService } from '../../src/container/container-port-allocator.service';

describe('ContainerPortAllocatorService', () => {
  let service: ContainerPortAllocatorService;

  const prismaMock = {
    tenant: {
      findMany: jest.fn(),
    },
  };

  const configMock = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'container.basePort') return 19000;
      if (key === 'container.portRange') return 10;
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContainerPortAllocatorService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<ContainerPortAllocatorService>(
      ContainerPortAllocatorService,
    );
  });

  it('allocates deterministically for same tenant when no collisions', async () => {
    prismaMock.tenant.findMany.mockResolvedValue([]);

    const first = await service.allocate('tenant-a');
    const second = await service.allocate('tenant-a');

    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(19000);
    expect(first).toBeLessThanOrEqual(19009);
  });

  it('skips occupied ports using linear probing', async () => {
    prismaMock.tenant.findMany.mockResolvedValue([
      { id: 't1', containerUrl: 'http://localhost:19000' },
      { id: 't2', containerUrl: 'http://localhost:19001' },
      { id: 't3', containerUrl: 'http://localhost:19002' },
    ]);

    const port = await service.allocate('tenant-collision');
    expect([19000, 19001, 19002]).not.toContain(port);
    expect(port).toBeGreaterThanOrEqual(19000);
    expect(port).toBeLessThanOrEqual(19009);
  });

  it('throws when no free ports are available in range', async () => {
    prismaMock.tenant.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `t-${i}`,
        containerUrl: `http://localhost:${19000 + i}`,
      })),
    );

    await expect(service.allocate('tenant-full')).rejects.toThrow(
      'No free container ports available',
    );
  });
});
