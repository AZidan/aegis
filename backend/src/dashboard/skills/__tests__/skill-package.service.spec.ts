import { Test, TestingModule } from '@nestjs/testing';
import AdmZip from 'adm-zip';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SkillPackageService } from '../skill-package.service';
import { SkillValidatorService } from '../skill-validator.service';
import { ValidationReport } from '../interfaces/validation-report.interface';

/**
 * Helper: create a minimal valid manifest object.
 */
function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    name: 'test-skill',
    version: '1.0.0',
    description: 'A test skill for unit testing purposes.',
    category: 'productivity',
    author: 'test@example.com',
    runtime: 'markdown',
    compatibleRoles: ['admin'],
    permissions: {
      network: { allowedDomains: [] },
      files: { readPaths: [], writePaths: [] },
      env: { required: [], optional: [] },
    },
    ...overrides,
  };
}

/**
 * Helper: create a minimal valid skill.md content.
 */
function validSkillMd() {
  return [
    '---',
    'title: Test Skill',
    'description: A test skill',
    'trigger: on-demand',
    '---',
    '',
    '# Test Skill',
    '',
    'This is a test skill description paragraph.',
    '',
    '1. First step',
    '2. Second step',
    '3. Third step',
  ].join('\n');
}

/**
 * Helper: create a ZIP buffer with the given entries.
 */
function createZipBuffer(
  entries: Record<string, string | Buffer>,
): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(entries)) {
    if (Buffer.isBuffer(content)) {
      zip.addFile(name, content);
    } else {
      zip.addFile(name, Buffer.from(content, 'utf-8'));
    }
  }
  return zip.toBuffer();
}

describe('SkillPackageService', () => {
  let service: SkillPackageService;
  let validatorMock: jest.Mocked<SkillValidatorService>;
  let tmpDir: string;

  beforeEach(async () => {
    // Create a temp directory for package storage
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-pkg-test-'));
    process.env.SKILL_PACKAGE_STORAGE_PATH = tmpDir;

    validatorMock = {
      validate: jest.fn().mockResolvedValue({
        valid: true,
        issues: [],
      } as ValidationReport),
    } as unknown as jest.Mocked<SkillValidatorService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillPackageService,
        { provide: SkillValidatorService, useValue: validatorMock },
      ],
    }).compile();

    service = module.get<SkillPackageService>(SkillPackageService);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    delete process.env.SKILL_PACKAGE_STORAGE_PATH;
  });

  it('should validate a valid package successfully', async () => {
    const buf = createZipBuffer({
      'skill.md': validSkillMd(),
      'manifest.json': JSON.stringify(validManifest()),
    });

    const result = await service.parseAndValidate(buf);

    expect(result.valid).toBe(true);
    expect(result.manifest).toBeDefined();
    expect(result.skillMd).toBeDefined();
    expect(result.issues).toHaveLength(0);
    expect(result.files).toHaveLength(2);
  });

  it('should fail when skill.md is missing', async () => {
    const buf = createZipBuffer({
      'manifest.json': JSON.stringify(validManifest()),
    });

    const result = await service.parseAndValidate(buf);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          file: 'skill.md',
          message: expect.stringContaining('Missing required file'),
        }),
      ]),
    );
  });

  it('should fail when manifest.json is missing', async () => {
    const buf = createZipBuffer({
      'skill.md': validSkillMd(),
    });

    const result = await service.parseAndValidate(buf);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          file: 'manifest.json',
          message: expect.stringContaining('Missing required file'),
        }),
      ]),
    );
  });

  it('should fail with invalid manifest JSON', async () => {
    const buf = createZipBuffer({
      'skill.md': validSkillMd(),
      'manifest.json': '{ invalid json }',
    });

    const result = await service.parseAndValidate(buf);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          file: 'manifest.json',
          message: expect.stringContaining('Invalid JSON'),
        }),
      ]),
    );
  });

  it('should fail with manifest that does not match Zod schema', async () => {
    const buf = createZipBuffer({
      'skill.md': validSkillMd(),
      'manifest.json': JSON.stringify({
        name: 'INVALID_NAME!',
        version: 'not-semver',
        description: 'short',
        category: 'invalid-category',
        author: '',
        runtime: 'python',
        compatibleRoles: [],
      }),
    });

    const result = await service.parseAndValidate(buf);

    expect(result.valid).toBe(false);
    expect(result.issues.filter((i) => i.severity === 'error').length).toBeGreaterThan(0);
  });

  it('should reject oversized compressed package (>5MB)', async () => {
    // Create a buffer larger than 5MB
    const bigBuffer = Buffer.alloc(5 * 1024 * 1024 + 1, 0);

    const result = await service.parseAndValidate(bigBuffer);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('Compressed package exceeds'),
        }),
      ]),
    );
  });

  it('should reject oversized uncompressed package (>20MB)', async () => {
    const zip = new AdmZip();
    zip.addFile('skill.md', Buffer.from(validSkillMd(), 'utf-8'));
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(validManifest()), 'utf-8'));
    zip.addFile('assets/large.txt', Buffer.alloc(21 * 1024 * 1024, 'a'));
    const buf = zip.toBuffer();

    const result = await service.parseAndValidate(buf);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('Uncompressed package exceeds'),
        }),
      ]),
    );
  });

  it('should detect eval() in scripts via SkillValidatorService', async () => {
    validatorMock.validate.mockResolvedValueOnce({
      valid: false,
      issues: [
        {
          severity: 'error',
          pattern: 'eval',
          message: 'Use of eval() detected',
        },
      ],
    });

    const buf = createZipBuffer({
      'skill.md': validSkillMd(),
      'manifest.json': JSON.stringify(validManifest()),
      'scripts/danger.js': 'eval("alert(1)")',
    });

    const result = await service.parseAndValidate(buf);

    expect(result.valid).toBe(false);
    expect(validatorMock.validate).toHaveBeenCalledWith(
      'eval("alert(1)")',
      false,
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          file: 'scripts/danger.js',
          message: expect.stringContaining('eval'),
        }),
      ]),
    );
  });

  it('should detect child_process in scripts via SkillValidatorService', async () => {
    validatorMock.validate.mockResolvedValueOnce({
      valid: false,
      issues: [
        {
          severity: 'error',
          pattern: 'child_process',
          message: 'Use of child_process detected',
        },
      ],
    });

    const buf = createZipBuffer({
      'skill.md': validSkillMd(),
      'manifest.json': JSON.stringify(validManifest()),
      'scripts/exec.js': 'require("child_process").execSync("ls")',
    });

    const result = await service.parseAndValidate(buf);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          file: 'scripts/exec.js',
          message: expect.stringContaining('child_process'),
        }),
      ]),
    );
  });

  it('should detect invalid handlebars template', async () => {
    const buf = createZipBuffer({
      'skill.md': validSkillMd(),
      'manifest.json': JSON.stringify(validManifest()),
      'templates/broken.hbs': '{{#if something}}unclosed if block',
    });

    const result = await service.parseAndValidate(buf);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          file: 'templates/broken.hbs',
          message: expect.stringContaining('Invalid Handlebars template'),
        }),
      ]),
    );
  });

  it('should accept valid handlebars template', async () => {
    const buf = createZipBuffer({
      'skill.md': validSkillMd(),
      'manifest.json': JSON.stringify(validManifest()),
      'templates/valid.hbs': '{{#if name}}Hello {{name}}!{{/if}}',
    });

    const result = await service.parseAndValidate(buf);

    expect(result.valid).toBe(true);
    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'templates/valid.hbs',
          type: 'handlebars',
        }),
      ]),
    );
  });

  it('should reject assets with disallowed extensions', async () => {
    const buf = createZipBuffer({
      'skill.md': validSkillMd(),
      'manifest.json': JSON.stringify(validManifest()),
      'assets/payload.exe': 'binary content',
    });

    const result = await service.parseAndValidate(buf);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          file: 'assets/payload.exe',
          message: expect.stringContaining('disallowed extension'),
        }),
      ]),
    );
  });

  it('should accept assets with allowed extensions', async () => {
    const buf = createZipBuffer({
      'skill.md': validSkillMd(),
      'manifest.json': JSON.stringify(validManifest()),
      'assets/data.json': '{"key":"value"}',
      'assets/data.csv': 'a,b,c',
      'assets/readme.txt': 'hello',
    });

    const result = await service.parseAndValidate(buf);

    expect(result.valid).toBe(true);
    expect(result.files.filter((f) => f.type === 'data')).toHaveLength(3);
  });

  it('should store package to disk when store option is true', async () => {
    const buf = createZipBuffer({
      'skill.md': validSkillMd(),
      'manifest.json': JSON.stringify(validManifest()),
    });

    const result = await service.parseAndValidate(buf, {
      store: true,
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(result.valid).toBe(true);
    expect(result.packageId).toBeDefined();
    expect(result.packagePath).toBeDefined();

    // Verify file exists on disk
    const stat = await fs.stat(result.packagePath!);
    expect(stat.isFile()).toBe(true);

    // Verify metadata file exists
    const metaPath = result.packagePath!.replace(/\.zip$/, '.meta.json');
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
    expect(meta.packageId).toBe(result.packageId);
    expect(meta.tenantId).toBe('tenant-1');
    expect(meta.userId).toBe('user-1');
  });

  it('should read stored package metadata from disk', async () => {
    const buf = createZipBuffer({
      'skill.md': validSkillMd(),
      'manifest.json': JSON.stringify(validManifest()),
    });

    const result = await service.parseAndValidate(buf, {
      store: true,
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    const stored = await service.getStoredPackage(result.packagePath!);
    expect(stored).not.toBeNull();
    expect(stored!.packageId).toBe(result.packageId);
    expect(stored!.tenantId).toBe('tenant-1');
  });

  it('should return null for non-existent stored package', async () => {
    const stored = await service.getStoredPackage('/nonexistent/path/package.zip');
    expect(stored).toBeNull();
  });

  it('should not store when validation fails', async () => {
    const buf = createZipBuffer({
      'manifest.json': JSON.stringify(validManifest()),
      // Missing skill.md
    });

    const result = await service.parseAndValidate(buf, {
      store: true,
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(result.valid).toBe(false);
    expect(result.packageId).toBeUndefined();
    expect(result.packagePath).toBeUndefined();
  });

  it('should reject an empty ZIP', async () => {
    const zip = new AdmZip();
    const buf = zip.toBuffer();

    const result = await service.parseAndValidate(buf);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('empty'),
        }),
      ]),
    );
  });

  it('should parse frontmatter from skill.md correctly', async () => {
    const md = [
      '---',
      'title: My Custom Title',
      'description: A custom description from frontmatter',
      'trigger: webhook',
      'customField: 42',
      '---',
      '',
      '# My Custom Title',
      '',
      'Some body text.',
      '',
      '1. Step one',
      '2. Step two',
    ].join('\n');

    const buf = createZipBuffer({
      'skill.md': md,
      'manifest.json': JSON.stringify(validManifest()),
    });

    const result = await service.parseAndValidate(buf);

    expect(result.valid).toBe(true);
    expect(result.skillMd).toBeDefined();
    expect(result.skillMd!.title).toBe('My Custom Title');
    expect(result.skillMd!.description).toBe(
      'A custom description from frontmatter',
    );
    expect(result.skillMd!.trigger).toBe('webhook');
    expect(result.skillMd!.steps).toEqual(['Step one', 'Step two']);
    expect(result.skillMd!.frontmatter.customField).toBe(42);
  });

  it('should handle corrupted ZIP gracefully', async () => {
    const corruptedBuffer = Buffer.from('this is not a zip file');

    const result = await service.parseAndValidate(corruptedBuffer);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
        }),
      ]),
    );
  });

  it('should warn about files in unexpected locations', async () => {
    const buf = createZipBuffer({
      'skill.md': validSkillMd(),
      'manifest.json': JSON.stringify(validManifest()),
      'random/file.txt': 'some content',
    });

    const result = await service.parseAndValidate(buf);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'warning',
          file: 'random/file.txt',
          message: expect.stringContaining('Unexpected file location'),
        }),
      ]),
    );
  });

  it('should include script analysis in result', async () => {
    const report: ValidationReport = {
      valid: true,
      issues: [],
    };
    validatorMock.validate.mockResolvedValueOnce(report);

    const buf = createZipBuffer({
      'skill.md': validSkillMd(),
      'manifest.json': JSON.stringify(validManifest()),
      'scripts/safe.js': 'console.log("hello");',
    });

    const result = await service.parseAndValidate(buf);

    expect(result.valid).toBe(true);
    expect(result.scriptAnalysis).toBeDefined();
    expect(result.scriptAnalysis).toHaveLength(1);
    expect(result.scriptAnalysis![0].valid).toBe(true);
  });

  it('should use tenant-scoped storage paths', () => {
    const pkgPath = service.getPackagePath('tenant-abc', 'my-skill', '2.0.0');
    expect(pkgPath).toBe(path.join(tmpDir, 'tenant-abc', 'my-skill', '2.0.0', 'package.zip'));
  });

  describe('extractPackageToDir', () => {
    it('should extract all files except manifest.json', async () => {
      // First store a package
      const buf = createZipBuffer({
        'skill.md': validSkillMd(),
        'manifest.json': JSON.stringify(validManifest()),
        'scripts/helper.js': 'console.log("hello");',
        'templates/prompt.hbs': '{{greeting}}',
        'references/guide.md': '# Guide',
        'assets/data.json': '{"key":"value"}',
      });

      const result = await service.parseAndValidate(buf, {
        store: true,
        tenantId: 'tenant-1',
        userId: 'user-1',
      });

      // Extract to a target directory
      const targetDir = path.join(tmpDir, 'extract-test');
      const extracted = await service.extractPackageToDir(
        result.packagePath!,
        targetDir,
        { excludeManifest: true },
      );

      // Verify manifest.json was excluded
      expect(extracted).not.toContain('manifest.json');
      expect(extracted).toContain('skill.md');
      expect(extracted).toContain('scripts/helper.js');
      expect(extracted).toContain('templates/prompt.hbs');
      expect(extracted).toContain('references/guide.md');
      expect(extracted).toContain('assets/data.json');

      // Verify files exist on disk
      const skillMdContent = await fs.readFile(
        path.join(targetDir, 'skill.md'),
        'utf-8',
      );
      expect(skillMdContent).toContain('# Test Skill');

      // Verify file is read-only
      const stat = await fs.stat(path.join(targetDir, 'skill.md'));
      // 0o444 = 292 in decimal
      expect(stat.mode & 0o777).toBe(0o444);
    });

    it('should include manifest.json when excludeManifest is false', async () => {
      const buf = createZipBuffer({
        'skill.md': validSkillMd(),
        'manifest.json': JSON.stringify(validManifest()),
      });

      const result = await service.parseAndValidate(buf, {
        store: true,
        tenantId: 'tenant-1',
        userId: 'user-1',
      });

      const targetDir = path.join(tmpDir, 'extract-with-manifest');
      const extracted = await service.extractPackageToDir(
        result.packagePath!,
        targetDir,
        { excludeManifest: false },
      );

      expect(extracted).toContain('manifest.json');
    });
  });
});
