import { execFile } from 'node:child_process';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DockerOrchestratorService } from '../../src/container/docker-orchestrator.service';

jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}));

type ExecFileCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;

describe('DockerOrchestratorService', () => {
  let service: DockerOrchestratorService;
  const execFileMock = execFile as unknown as jest.Mock;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DockerOrchestratorService,
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<DockerOrchestratorService>(DockerOrchestratorService);
  });

  it('create should ensure network and run docker container', async () => {
    execFileMock.mockImplementation(
      (
        _cmd: string,
        args: string[],
        _opts: unknown,
        callback: ExecFileCallback,
      ) => {
        if (args[0] === 'network' && args[1] === 'ls') {
          callback(null, 'aegis-tenant-network\n', '');
          return;
        }
        if (args[0] === 'run') {
          callback(null, 'container-123\n', '');
          return;
        }
        callback(null, '', '');
      },
    );

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

    expect(execFileMock).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['run', '-d', '--name', 'aegis-tenant']),
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('getStatus should map running and healthy state', async () => {
    execFileMock.mockImplementation(
      (
        _cmd: string,
        args: string[],
        _opts: unknown,
        callback: ExecFileCallback,
      ) => {
        if (args[0] === 'inspect') {
          callback(
            null,
            JSON.stringify({
              Status: 'running',
              Running: true,
              StartedAt: '2026-02-10T00:00:00.000Z',
              Health: { Status: 'healthy' },
            }),
            '',
          );
          return;
        }
        callback(null, '', '');
      },
    );

    const status = await service.getStatus('container-123');
    expect(status.state).toBe('running');
    expect(status.health).toBe('healthy');
    expect(status.startedAt).toBeInstanceOf(Date);
  });

  it('getLogs should include tail and since args', async () => {
    execFileMock.mockImplementation(
      (
        _cmd: string,
        args: string[],
        _opts: unknown,
        callback: ExecFileCallback,
      ) => {
        if (args[0] === 'logs') {
          callback(null, 'stdout-line', 'stderr-line');
          return;
        }
        callback(null, '', '');
      },
    );

    const logs = await service.getLogs('container-123', {
      tailLines: 50,
      sinceSeconds: 120,
    });

    expect(logs).toContain('stdout-line');
    expect(logs).toContain('stderr-line');
    expect(execFileMock).toHaveBeenCalledWith(
      'docker',
      ['logs', '--tail', '50', '--since', '120s', 'container-123'],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('updateConfig should not throw for placeholder updates', async () => {
    execFileMock.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: ExecFileCallback,
      ) => callback(null, '', ''),
    );

    await expect(
      service.updateConfig('container-123', {
        openclawConfig: { gateway: { port: 18789 } },
      }),
    ).resolves.toBeUndefined();

    expect(execFileMock).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['cp']),
      expect.any(Object),
      expect.any(Function),
    );
    expect(execFileMock).toHaveBeenCalledWith(
      'docker',
      ['restart', 'container-123'],
      expect.any(Object),
      expect.any(Function),
    );
  });
});
