import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import { EventEmitter } from 'events';
import { publishCommand } from '../cli/commands/publish';

// Mock http.request
jest.mock('http', () => {
  const actual = jest.requireActual('http');
  return {
    ...actual,
    request: jest.fn(),
  };
});

const mockedRequest = http.request as jest.MockedFunction<typeof http.request>;

describe('CLI publish command', () => {
  let tempDir: string;
  let mockExit: jest.SpyInstance;
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-skill-publish-'));
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    // Clean env
    delete process.env.AEGIS_REGISTRY_URL;
    delete process.env.AEGIS_TOKEN;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    jest.resetAllMocks();
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    process.env = { ...originalEnv };
  });

  function setupFiles() {
    fs.writeFileSync(
      path.join(tempDir, 'skill.manifest.json'),
      JSON.stringify({ name: 'my-skill', version: '1.0.0' }),
    );
    fs.mkdirSync(path.join(tempDir, 'dist'));
    fs.writeFileSync(path.join(tempDir, 'dist', 'skill.js'), 'export default {}');
  }

  it('should exit 1 when registry URL is missing', () => {
    expect(() => publishCommand(['--token', 'abc'], tempDir)).toThrow('exit');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('registry-url'),
    );
  });

  it('should exit 1 when token is missing', () => {
    expect(() =>
      publishCommand(['--registry-url', 'http://localhost:3000/api/dashboard/skills/private'], tempDir),
    ).toThrow('exit');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('token'),
    );
  });

  it('should exit 1 when manifest is missing', () => {
    expect(() =>
      publishCommand(
        ['--registry-url', 'http://localhost:3000/api', '--token', 'abc'],
        tempDir,
      ),
    ).toThrow('exit');
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('skill.manifest.json not found'),
    );
  });

  it('should exit 1 when dist/skill.js is missing', () => {
    fs.writeFileSync(
      path.join(tempDir, 'skill.manifest.json'),
      JSON.stringify({ name: 'x', version: '1.0.0' }),
    );

    expect(() =>
      publishCommand(
        ['--registry-url', 'http://localhost:3000/api', '--token', 'abc'],
        tempDir,
      ),
    ).toThrow('exit');
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('dist/skill.js not found'),
    );
  });

  it('should publish successfully on HTTP 201', () => {
    setupFiles();

    const mockReq = new EventEmitter() as EventEmitter & { write: jest.Mock; end: jest.Mock };
    mockReq.write = jest.fn();
    mockReq.end = jest.fn();

    mockedRequest.mockImplementation((_options: unknown, callback: unknown) => {
      const cb = callback as (res: EventEmitter & { statusCode: number }) => void;
      const mockRes = new EventEmitter() as EventEmitter & { statusCode: number };
      mockRes.statusCode = 201;

      // Simulate async response
      process.nextTick(() => {
        cb(mockRes);
        mockRes.emit('data', '{"id":"123"}');
        mockRes.emit('end');
      });

      return mockReq as unknown as http.ClientRequest;
    });

    publishCommand(
      ['--registry-url', 'http://localhost:3000/api/dashboard/skills/private', '--token', 'test-token'],
      tempDir,
    );

    // Allow async callbacks
    return new Promise<void>((resolve) => {
      process.nextTick(() => {
        process.nextTick(() => {
          expect(mockConsoleLog).toHaveBeenCalledWith(
            expect.stringContaining('published successfully'),
          );
          expect(mockReq.write).toHaveBeenCalled();
          expect(mockReq.end).toHaveBeenCalled();
          resolve();
        });
      });
    });
  });

  it('should use env vars as fallback for registry-url and token', () => {
    setupFiles();
    process.env.AEGIS_REGISTRY_URL = 'http://localhost:3000/api/dashboard/skills/private';
    process.env.AEGIS_TOKEN = 'env-token';

    const mockReq = new EventEmitter() as EventEmitter & { write: jest.Mock; end: jest.Mock };
    mockReq.write = jest.fn();
    mockReq.end = jest.fn();

    mockedRequest.mockImplementation((_options: unknown, callback: unknown) => {
      const cb = callback as (res: EventEmitter & { statusCode: number }) => void;
      const mockRes = new EventEmitter() as EventEmitter & { statusCode: number };
      mockRes.statusCode = 201;
      process.nextTick(() => {
        cb(mockRes);
        mockRes.emit('end');
      });
      return mockReq as unknown as http.ClientRequest;
    });

    // No args — should use env vars
    publishCommand([], tempDir);

    return new Promise<void>((resolve) => {
      process.nextTick(() => {
        process.nextTick(() => {
          expect(mockedRequest).toHaveBeenCalledWith(
            expect.objectContaining({
              hostname: 'localhost',
              headers: expect.objectContaining({
                Authorization: 'Bearer env-token',
              }),
            }),
            expect.any(Function),
          );
          resolve();
        });
      });
    });
  });
});
