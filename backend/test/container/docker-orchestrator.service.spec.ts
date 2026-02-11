import { PassThrough } from 'node:stream';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DockerOrchestratorService } from '../../src/container/docker-orchestrator.service';
import { ContainerNetworkService } from '../../src/container/container-network.service';
import { SecretsManagerService } from '../../src/container/secrets-manager.service';

type MockContainer = {
  id: string;
  start: jest.Mock;
  inspect: jest.Mock;
  restart: jest.Mock;
  stop: jest.Mock;
  remove: jest.Mock;
  logs: jest.Mock;
  exec: jest.Mock;
  putArchive: jest.Mock;
};

const createContainerMock = (): MockContainer => ({
  id: 'container-123',
  start: jest.fn().mockResolvedValue(undefined),
  inspect: jest.fn().mockResolvedValue({
    State: {
      Status: 'running',
      Running: true,
      StartedAt: '2026-02-10T00:00:00.000Z',
      Health: { Status: 'healthy' },
    },
  }),
  restart: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  logs: jest.fn().mockResolvedValue(Buffer.from('stdout-line\nstderr-line')),
  putArchive: jest.fn().mockResolvedValue(undefined),
  exec: jest.fn().mockResolvedValue({
    start: jest.fn().mockImplementation(async () => {
      const stream = new PassThrough();
      setImmediate(() => stream.end());
      return stream;
    }),
    inspect: jest.fn().mockResolvedValue({ ExitCode: 0 }),
  }),
});

const dockerClientMock = {
  createContainer: jest.fn(),
  getContainer: jest.fn(),
  listNetworks: jest.fn(),
  createNetwork: jest.fn(),
};

jest.mock('dockerode', () =>
  jest.fn().mockImplementation(() => dockerClientMock),
);

describe('DockerOrchestratorService', () => {
  let service: DockerOrchestratorService;
  let containerMock: MockContainer;

  const configServiceMock = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'container.basePort') return 19000;
      if (key === 'container.dockerHost') return 'unix:///var/run/docker.sock';
      if (key === 'container.openclawImage') return 'openclaw/openclaw:latest';
      if (key === 'container.networkName') return 'aegis-tenant-network';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    containerMock = createContainerMock();
    dockerClientMock.createContainer.mockResolvedValue(containerMock);
    dockerClientMock.getContainer.mockReturnValue(containerMock);
    dockerClientMock.listNetworks.mockResolvedValue([
      { Name: 'aegis-tenant-network' },
    ]);
    dockerClientMock.createNetwork.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DockerOrchestratorService,
        { provide: ConfigService, useValue: configServiceMock },
        ContainerNetworkService,
        SecretsManagerService,
      ],
    }).compile();

    service = module.get<DockerOrchestratorService>(DockerOrchestratorService);
  });

  it('create should ensure network and create a container', async () => {
    const result = await service.create({
      tenantId: 'tenant-uuid-1',
      name: 'aegis-tenant',
      hostPort: 19123,
      environment: { NODE_ENV: 'production' },
      resourceLimits: { cpu: '2', memoryMb: 2048 },
    });

    expect(result).toEqual({
      id: 'container-123',
      url: 'http://localhost:19123',
      hostPort: 19123,
    });
    expect(dockerClientMock.createContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'aegis-tenant',
        Image: 'openclaw/openclaw:latest',
        Healthcheck: expect.objectContaining({
          Retries: 5,
        }),
        HostConfig: expect.objectContaining({
          ReadonlyRootfs: true,
          Tmpfs: expect.objectContaining({
            '/run/secrets/openclaw': expect.any(String),
            '/home/node/.openclaw': expect.any(String),
          }),
        }),
        Labels: expect.objectContaining({
          'aegis.tenantId': 'tenant-uuid-1',
          'aegis.managedBy': 'aegis-container-orchestrator',
        }),
      }),
    );
    expect(containerMock.start).toHaveBeenCalled();
  });

  it('create should inject age key into /run/secrets after start', async () => {
    await service.create({
      tenantId: 'tenant-uuid-1',
      name: 'aegis-tenant-age',
      hostPort: 19125,
    });

    // putArchive called for age key injection
    expect(containerMock.putArchive).toHaveBeenCalledWith(
      expect.any(Buffer),
      { path: '/run/secrets' },
    );
  });

  it('create should create managed network when missing', async () => {
    dockerClientMock.listNetworks.mockResolvedValueOnce([]);

    await service.create({
      tenantId: 'tenant-uuid-2',
      hostPort: 19124,
    });

    expect(dockerClientMock.createNetwork).toHaveBeenCalledWith(
      expect.objectContaining({
        Name: 'aegis-tenant-network',
        Labels: expect.objectContaining({
          'aegis.tenantId': 'tenant-uuid-2',
          'aegis.networkScope': 'tenant',
        }),
      }),
    );
  });

  it('getStatus should map running and healthy state', async () => {
    const status = await service.getStatus('container-123');
    expect(status.state).toBe('running');
    expect(status.health).toBe('healthy');
    expect(status.startedAt).toBeInstanceOf(Date);
  });

  it('getLogs should include options', async () => {
    const logs = await service.getLogs('container-123', {
      tailLines: 50,
      sinceSeconds: 120,
    });

    expect(logs).toContain('stdout-line');
    expect(containerMock.logs).toHaveBeenCalledWith(
      expect.objectContaining({
        tail: 50,
        since: 120,
      }),
    );
  });

  it('updateConfig should write config and restart container', async () => {
    await expect(
      service.updateConfig('container-123', {
        openclawConfig: { gateway: { port: 18789 } },
      }),
    ).resolves.toBeUndefined();

    expect(containerMock.putArchive).toHaveBeenCalled();
    expect(containerMock.exec).toHaveBeenCalled();
    expect(containerMock.restart).toHaveBeenCalled();
  });

  it('getLogs should read stream output', async () => {
    const stream = new PassThrough();
    containerMock.logs.mockResolvedValueOnce(stream);
    setImmediate(() => {
      stream.write('stream-line');
      stream.end();
    });

    const logs = await service.getLogs('container-123');
    expect(logs).toContain('stream-line');
  });
});
