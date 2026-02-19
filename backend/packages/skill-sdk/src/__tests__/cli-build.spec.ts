import { spawnSync } from 'child_process';
import { buildCommand } from '../cli/commands/build';

jest.mock('child_process', () => ({
  spawnSync: jest.fn(),
}));

const mockedSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;

describe('CLI build command', () => {
  let mockExit: jest.SpyInstance;
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(() => {
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.resetAllMocks();
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  it('should succeed when tsc exits with code 0', () => {
    mockedSpawnSync.mockReturnValue({ status: 0, error: undefined } as any);

    buildCommand('/fake/dir');

    expect(mockedSpawnSync).toHaveBeenCalledWith(
      'npx',
      ['tsc', '--project', expect.stringContaining('tsconfig.json')],
      expect.objectContaining({ cwd: '/fake/dir', stdio: 'inherit' }),
    );
    expect(mockConsoleLog).toHaveBeenCalledWith('Build succeeded.');
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('should exit with tsc exit code on failure', () => {
    mockedSpawnSync.mockReturnValue({ status: 2, error: undefined } as any);

    expect(() => buildCommand('/fake/dir')).toThrow('exit');
    expect(mockExit).toHaveBeenCalledWith(2);
  });

  it('should exit 1 when spawn throws an error', () => {
    mockedSpawnSync.mockReturnValue({
      status: null,
      error: new Error('ENOENT'),
    } as any);

    expect(() => buildCommand('/fake/dir')).toThrow('exit');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('ENOENT'),
    );
  });
});
