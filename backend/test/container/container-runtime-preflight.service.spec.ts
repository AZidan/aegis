import { execFile } from 'node:child_process';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ContainerRuntimePreflightService } from '../../src/container/container-runtime-preflight.service';

// Mock dockerode — docker.info() used by verifyDocker
const mockDockerInfo = jest.fn();
jest.mock('dockerode', () =>
  jest.fn().mockImplementation(() => ({
    info: mockDockerInfo,
  })),
);

jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}));

type ExecFileCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;

describe('ContainerRuntimePreflightService', () => {
  const execFileMock = execFile as unknown as jest.Mock;

  function buildConfig(runtime: 'mock' | 'docker' | 'kubernetes') {
    return {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const map: Record<string, unknown> = {
          'container.runtime': runtime,
          'container.dockerHost': 'unix:///var/run/docker.sock',
          'container.kubernetes.context': '',
          'container.kubernetes.namespace': 'aegis-tenants',
        };
        return map[key] ?? defaultValue;
      }),
    };
  }

  async function makeService(config: { get: jest.Mock }) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContainerRuntimePreflightService,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    return module.get<ContainerRuntimePreflightService>(
      ContainerRuntimePreflightService,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should skip checks for mock runtime', async () => {
    const service = await makeService(buildConfig('mock'));
    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(mockDockerInfo).not.toHaveBeenCalled();
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('should call docker.info() for docker runtime', async () => {
    mockDockerInfo.mockResolvedValue({ ServerVersion: '27.5.1' });

    const service = await makeService(buildConfig('docker'));
    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(mockDockerInfo).toHaveBeenCalled();
    // Should NOT shell out to docker CLI
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('should throw when docker daemon is unreachable', async () => {
    mockDockerInfo.mockRejectedValue(new Error('connect ENOENT'));

    const service = await makeService(buildConfig('docker'));
    await expect(service.onModuleInit()).rejects.toThrow(
      /cannot reach Docker daemon/,
    );
  });

  it('should run kubectl client and namespace checks for kubernetes runtime', async () => {
    execFileMock.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: ExecFileCallback,
      ) => callback(null, '', ''),
    );

    const service = await makeService(buildConfig('kubernetes'));
    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(execFileMock).toHaveBeenCalledWith(
      'kubectl',
      ['version', '--client=true'],
      expect.any(Object),
      expect.any(Function),
    );
    expect(execFileMock).toHaveBeenCalledWith(
      'kubectl',
      ['get', 'namespace', 'aegis-tenants'],
      expect.any(Object),
      expect.any(Function),
    );
  });
});
