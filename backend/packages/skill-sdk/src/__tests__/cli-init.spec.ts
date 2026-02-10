import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { initCommand } from '../cli/commands/init';

describe('CLI init command', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-skill-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should scaffold a new skill project', () => {
    const skillDir = path.join(tempDir, 'my-new-skill');
    // Override process.exit for test
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    initCommand('my-new-skill', skillDir);

    expect(fs.existsSync(path.join(skillDir, 'skill.ts'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'skill.manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'skill.spec.ts'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'tsconfig.json'))).toBe(true);

    mockExit.mockRestore();
  });

  it('should include skill name in generated files', () => {
    const skillDir = path.join(tempDir, 'custom-analyzer');
    initCommand('custom-analyzer', skillDir);

    const skillContent = fs.readFileSync(path.join(skillDir, 'skill.ts'), 'utf-8');
    expect(skillContent).toContain("name: 'custom-analyzer'");

    const pkgContent = fs.readFileSync(path.join(skillDir, 'package.json'), 'utf-8');
    expect(pkgContent).toContain('"name": "custom-analyzer"');
  });

  it('should fail if directory already exists', () => {
    const skillDir = path.join(tempDir, 'existing');
    fs.mkdirSync(skillDir);

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    expect(() => initCommand('existing', skillDir)).toThrow('exit');

    mockExit.mockRestore();
  });
});
