import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { validateCommand } from '../cli/commands/validate';

describe('CLI validate command', () => {
  let tempDir: string;
  let mockExit: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;
  let mockConsoleLog: jest.SpyInstance;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-skill-validate-'));
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleLog.mockRestore();
  });

  it('should pass validation for a valid manifest', () => {
    const manifest = {
      name: 'my-skill',
      version: '1.0.0',
      description: 'A valid skill for testing validation.',
      category: 'productivity',
      compatibleRoles: ['engineering'],
      permissions: {
        network: { allowedDomains: ['api.example.com'] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      },
      config: [],
    };
    fs.writeFileSync(
      path.join(tempDir, 'skill.manifest.json'),
      JSON.stringify(manifest),
    );

    validateCommand(tempDir);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('no issues found'),
    );
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('should exit 1 when manifest is missing', () => {
    expect(() => validateCommand(tempDir)).toThrow('exit');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('not found'),
    );
  });

  it('should exit 1 for an invalid manifest', () => {
    fs.writeFileSync(
      path.join(tempDir, 'skill.manifest.json'),
      JSON.stringify({ name: 'x' }),
    );

    expect(() => validateCommand(tempDir)).toThrow('exit');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('[ERROR]'),
    );
  });

  it('should show warnings for overly permissive config', () => {
    const manifest = {
      name: 'warn-skill',
      version: '1.0.0',
      description: 'Skill with warnings for testing.',
      category: 'security',
      compatibleRoles: ['engineering'],
      permissions: {
        network: { allowedDomains: ['*'] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      },
      config: [],
    };
    fs.writeFileSync(
      path.join(tempDir, 'skill.manifest.json'),
      JSON.stringify(manifest),
    );

    // Valid (no errors) but has warnings — should not exit
    validateCommand(tempDir);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('[WARN]'),
    );
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('should exit 1 for unparseable JSON', () => {
    fs.writeFileSync(path.join(tempDir, 'skill.manifest.json'), '{bad json');

    expect(() => validateCommand(tempDir)).toThrow('exit');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse'),
    );
  });
});
