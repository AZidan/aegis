import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// Shared mock references — hoisted by jest.mock factories
const execFileAsyncMock = jest.fn();
const httpsGetMock = jest.fn();
const createWriteStreamMock = jest.fn();

jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}));
jest.mock('node:util', () => ({
  ...jest.requireActual('node:util'),
  promisify: () => execFileAsyncMock,
}));
jest.mock('node:https', () => ({
  get: (...args: any[]) => httpsGetMock(...args),
}));
jest.mock('node:fs', () => ({
  createWriteStream: (...args: any[]) => createWriteStreamMock(...args),
}));

// Mock fs/promises
const mockReaddir = jest.fn();
const mockStat = jest.fn();
const mockAccess = jest.fn();
const mockReadFile = jest.fn();
const mockRm = jest.fn().mockResolvedValue(undefined);
const mockMkdir = jest.fn().mockResolvedValue(undefined);
const mockUnlink = jest.fn().mockResolvedValue(undefined);

jest.mock('node:fs/promises', () => ({
  readdir: (...args: any[]) => mockReaddir(...args),
  stat: (...args: any[]) => mockStat(...args),
  access: (...args: any[]) => mockAccess(...args),
  readFile: (...args: any[]) => mockReadFile(...args),
  rm: (...args: any[]) => mockRm(...args),
  mkdir: (...args: any[]) => mockMkdir(...args),
  unlink: (...args: any[]) => mockUnlink(...args),
}));

import { GitHubSkillImportService } from '../../../src/admin/skills/github-skill-import.service';

describe('GitHubSkillImportService', () => {
  let service: GitHubSkillImportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GitHubSkillImportService],
    }).compile();

    service = module.get<GitHubSkillImportService>(GitHubSkillImportService);

    jest.clearAllMocks();
    mockRm.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
  });

  // =========================================================================
  // parseGitHubUrl
  // =========================================================================
  describe('parseGitHubUrl', () => {
    it('should parse standard github.com URL', () => {
      const result = service.parseGitHubUrl('https://github.com/anthropics/skills');
      expect(result).toEqual({
        owner: 'anthropics',
        repo: 'skills',
        branch: undefined,
        subPath: undefined,
      });
    });

    it('should parse URL with tree/branch/path', () => {
      const result = service.parseGitHubUrl(
        'https://github.com/owner/repo/tree/main/skills/my-skill',
      );
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        subPath: 'skills/my-skill',
      });
    });

    it('should parse URL without protocol', () => {
      const result = service.parseGitHubUrl('github.com/owner/repo');
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        branch: undefined,
        subPath: undefined,
      });
    });

    it('should strip .git suffix from repo name', () => {
      const result = service.parseGitHubUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        branch: undefined,
        subPath: undefined,
      });
    });

    it('should strip trailing slashes', () => {
      const result = service.parseGitHubUrl('https://github.com/owner/repo///');
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        branch: undefined,
        subPath: undefined,
      });
    });

    it('should parse tree URL with branch only (no subpath)', () => {
      const result = service.parseGitHubUrl('https://github.com/owner/repo/tree/develop');
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        branch: 'develop',
        subPath: undefined,
      });
    });

    it('should reject non-GitHub URL', () => {
      expect(() => service.parseGitHubUrl('https://gitlab.com/owner/repo')).toThrow(
        BadRequestException,
      );
    });

    it('should reject URL without owner/repo', () => {
      expect(() => service.parseGitHubUrl('https://github.com/')).toThrow(
        BadRequestException,
      );
    });

    it('should reject invalid URL', () => {
      expect(() => service.parseGitHubUrl('not-a-url')).toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // parseSkillMd
  // =========================================================================
  describe('parseSkillMd', () => {
    it('should parse valid SKILL.md with full frontmatter', () => {
      const content = `---
name: my-test-skill
description: A test skill for unit testing
license: MIT
compatibility: Requires git and bash
metadata:
  author: test-org
  version: "2.0"
allowed-tools: Bash(git:*) Read
---

# My Test Skill

Instructions for the skill go here.
`;
      const result = service.parseSkillMd(content, 'skills/my-test-skill/SKILL.md');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('my-test-skill');
      expect(result!.description).toBe('A test skill for unit testing');
      expect(result!.version).toBe('2.0');
      expect(result!.category).toBe('custom');
      expect(result!.compatibleRoles).toContain('developer');
      expect(result!.sourceCode).toContain('# My Test Skill');
      expect(result!.documentation).toContain('License: MIT');
      expect(result!.documentation).toContain('Allowed Tools: Bash(git:*) Read');
      expect(result!.skillPath).toBe('skills/my-test-skill/SKILL.md');
    });

    it('should parse SKILL.md with minimal frontmatter', () => {
      const content = `---
name: minimal-skill
description: Minimal description
---

Do the thing.
`;
      const result = service.parseSkillMd(content, 'SKILL.md');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('minimal-skill');
      expect(result!.version).toBe('1.0.0');
      expect(result!.compatibleRoles).toEqual(['developer']);
    });

    it('should return null when name is missing', () => {
      const content = `---
description: Missing name
---

Body content.
`;
      const result = service.parseSkillMd(content, 'SKILL.md');
      expect(result).toBeNull();
    });

    it('should return null when description is missing', () => {
      const content = `---
name: no-desc
---

Body content.
`;
      const result = service.parseSkillMd(content, 'SKILL.md');
      expect(result).toBeNull();
    });

    it('should return null for content without frontmatter', () => {
      const content = '# Just markdown, no frontmatter\n\nSome text.';
      const result = service.parseSkillMd(content, 'SKILL.md');
      expect(result).toBeNull();
    });

    it('should truncate long descriptions to 500 chars', () => {
      const longDesc = 'A'.repeat(600);
      const content = `---
name: long-desc
description: ${longDesc}
---

Body.
`;
      const result = service.parseSkillMd(content, 'SKILL.md');
      expect(result).not.toBeNull();
      expect(result!.description.length).toBe(500);
      expect(result!.description).toMatch(/\.\.\.$/);
    });

    it('should derive developer role from git compatibility', () => {
      const content = `---
name: git-skill
description: Uses git
compatibility: Requires git CLI
---
Body.
`;
      const result = service.parseSkillMd(content, 'SKILL.md');
      expect(result!.compatibleRoles).toContain('developer');
    });

    it('should derive analyst role from data compatibility', () => {
      const content = `---
name: data-skill
description: Data analysis
compatibility: Requires data analytics tools
---
Body.
`;
      const result = service.parseSkillMd(content, 'SKILL.md');
      expect(result!.compatibleRoles).toContain('analyst');
    });
  });

  // =========================================================================
  // discoverSkillFiles
  // =========================================================================
  describe('discoverSkillFiles', () => {
    it('should find SKILL.md in priority skills/ directory', async () => {
      const baseDir = '/tmp/test-repo';

      mockStat.mockImplementation((p: string) => {
        if (p.endsWith('/skills')) return Promise.resolve({ isDirectory: () => true });
        return Promise.reject(new Error('not found'));
      });

      mockReaddir.mockImplementation((dir: string) => {
        if (dir === `${baseDir}/skills`) {
          return Promise.resolve([
            { name: 'my-skill', isFile: () => false, isDirectory: () => true },
          ]);
        }
        if (dir === `${baseDir}/skills/my-skill`) {
          return Promise.resolve([
            { name: 'SKILL.md', isFile: () => true, isDirectory: () => false },
          ]);
        }
        return Promise.resolve([]);
      });

      mockAccess.mockRejectedValue(new Error('not found'));

      const files = await service.discoverSkillFiles(baseDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('SKILL.md');
    });

    it('should find root-level SKILL.md', async () => {
      const baseDir = '/tmp/test-repo';

      mockStat.mockRejectedValue(new Error('not found'));
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([]);

      const files = await service.discoverSkillFiles(baseDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('SKILL.md');
    });

    it('should respect subPath parameter', async () => {
      const baseDir = '/tmp/test-repo';

      mockStat.mockRejectedValue(new Error('not found'));
      mockAccess.mockRejectedValue(new Error('not found'));
      mockReaddir.mockImplementation((dir: string) => {
        if (dir === `${baseDir}/specific/path`) {
          return Promise.resolve([
            { name: 'SKILL.md', isFile: () => true, isDirectory: () => false },
          ]);
        }
        return Promise.resolve([]);
      });

      const files = await service.discoverSkillFiles(baseDir, 'specific/path');
      expect(mockStat).toHaveBeenCalledWith(expect.stringContaining('specific/path/skills'));
    });
  });

  // =========================================================================
  // downloadRepo
  // =========================================================================
  describe('downloadRepo', () => {
    it('should download and extract tarball successfully', async () => {
      // Mock https.get for tarball download
      const mockRes = {
        statusCode: 200,
        pipe: jest.fn(),
        headers: {},
      };
      httpsGetMock.mockImplementation((_url: string, _opts: any, cb: any) => {
        const fileStream: any = {
          on: jest.fn((event: string, handler: () => void) => {
            if (event === 'finish') setTimeout(handler, 0);
            return fileStream;
          }),
        };
        createWriteStreamMock.mockReturnValue(fileStream);
        mockRes.pipe.mockReturnValue(fileStream);
        cb(mockRes);
        return { on: jest.fn() };
      });

      // Mock tar extraction
      execFileAsyncMock.mockResolvedValue({ stdout: '', stderr: '' });

      // Mock stat for size check and extracted dir
      mockStat.mockResolvedValue({ size: 5000, isDirectory: () => true });

      // Mock readdir for extracted contents
      mockReaddir.mockResolvedValue(['repo-main']);

      const result = await service.downloadRepo('owner', 'repo', 'main');
      expect(result).toContain('repo-main');
      expect(execFileAsyncMock).toHaveBeenCalledWith('tar', expect.arrayContaining(['xzf']));
    });

    it('should follow redirects', async () => {
      // First call returns 302
      const mockRedirectRes = {
        statusCode: 302,
        headers: { location: 'https://codeload.github.com/owner/repo/tar.gz/main' },
      };
      // Second call returns 200
      const mockRes = {
        statusCode: 200,
        pipe: jest.fn(),
        headers: {},
      };
      let callCount = 0;
      httpsGetMock.mockImplementation((_url: string, _opts: any, cb: any) => {
        callCount++;
        if (callCount === 1) {
          cb(mockRedirectRes);
        } else {
          const fileStream: any = {
            on: jest.fn((event: string, handler: () => void) => {
              if (event === 'finish') setTimeout(handler, 0);
              return fileStream;
            }),
          };
          createWriteStreamMock.mockReturnValue(fileStream);
          mockRes.pipe.mockReturnValue(fileStream);
          cb(mockRes);
        }
        return { on: jest.fn() };
      });

      execFileAsyncMock.mockResolvedValue({ stdout: '', stderr: '' });
      mockStat.mockResolvedValue({ size: 5000, isDirectory: () => true });
      mockReaddir.mockResolvedValue(['repo-main']);

      const result = await service.downloadRepo('owner', 'repo', 'main');
      expect(callCount).toBe(2);
      expect(result).toContain('repo-main');
    });

    it('should throw on HTTP error status', async () => {
      httpsGetMock.mockImplementation((_url: string, _opts: any, cb: any) => {
        cb({ statusCode: 404, headers: {} });
        return { on: jest.fn() };
      });

      await expect(service.downloadRepo('owner', 'nonexistent')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // =========================================================================
  // fetchSkillsFromGitHub (integration)
  // =========================================================================
  describe('fetchSkillsFromGitHub', () => {
    /**
     * Helper: set up mocks for a successful downloadRepo
     */
    function setupDownloadMock() {
      const mockRes = {
        statusCode: 200,
        pipe: jest.fn(),
        headers: {},
      };
      httpsGetMock.mockImplementation((_url: string, _opts: any, cb: any) => {
        const fileStream: any = {
          on: jest.fn((event: string, handler: () => void) => {
            if (event === 'finish') setTimeout(handler, 0);
            return fileStream;
          }),
        };
        createWriteStreamMock.mockReturnValue(fileStream);
        mockRes.pipe.mockReturnValue(fileStream);
        cb(mockRes);
        return { on: jest.fn() };
      });
      execFileAsyncMock.mockResolvedValue({ stdout: '', stderr: '' });
    }

    it('should orchestrate download → discover → parse (happy path)', async () => {
      setupDownloadMock();

      mockStat.mockImplementation((p: string) => {
        if (p.includes('repo.tar.gz')) return Promise.resolve({ size: 5000 });
        if (p.includes('repo-HEAD') || p.includes('repo-main')) return Promise.resolve({ isDirectory: () => true });
        // Only match primary skills/ dir
        if (p.match(/repo-HEAD\/skills$/) && !p.includes('.')) return Promise.resolve({ isDirectory: () => true });
        return Promise.reject(new Error('not found'));
      });

      mockReaddir.mockImplementation((dir: string, opts?: any) => {
        // downloadRepo calls readdir without withFileTypes
        if (dir.includes('aegis-gh-import') && (!opts || !opts.withFileTypes)) {
          return Promise.resolve(['repo-HEAD']);
        }
        // Skills directory contents
        if (dir.endsWith('/skills') && !dir.includes('.')) {
          return Promise.resolve([
            { name: 'test-skill', isFile: () => false, isDirectory: () => true },
          ]);
        }
        if (dir.endsWith('/test-skill')) {
          return Promise.resolve([
            { name: 'SKILL.md', isFile: () => true, isDirectory: () => false },
          ]);
        }
        return Promise.resolve([]);
      });

      mockAccess.mockRejectedValue(new Error('not found'));

      mockReadFile.mockResolvedValue(`---
name: test-skill
description: A test skill
---

Instructions here.
`);

      const result = await service.fetchSkillsFromGitHub('https://github.com/owner/repo');
      expect(result.repoUrl).toBe('https://github.com/owner/repo');
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].name).toBe('test-skill');

      // Cleanup should be called
      expect(mockRm).toHaveBeenCalled();
    });

    it('should throw BadRequestException when download fails', async () => {
      httpsGetMock.mockImplementation((_url: string, _opts: any, cb: any) => {
        cb({ statusCode: 404, headers: {} });
        return { on: jest.fn() };
      });

      await expect(
        service.fetchSkillsFromGitHub('https://github.com/owner/repo'),
      ).rejects.toThrow(BadRequestException);

      expect(mockRm).toHaveBeenCalled();
    });

    it('should throw NotFoundException when no SKILL.md files found', async () => {
      setupDownloadMock();

      mockStat.mockImplementation((p: string) => {
        if (p.includes('repo.tar.gz')) return Promise.resolve({ size: 1000 });
        if (p.includes('repo-HEAD')) return Promise.resolve({ isDirectory: () => true });
        return Promise.reject(new Error('not found'));
      });

      mockReaddir.mockImplementation((dir: string, opts?: any) => {
        // downloadRepo calls readdir without withFileTypes (returns strings)
        if (dir.includes('aegis-gh-import') && (!opts || !opts.withFileTypes)) {
          return Promise.resolve(['repo-HEAD']);
        }
        // walkForSkillMd calls readdir with withFileTypes (returns dirents)
        return Promise.resolve([]);
      });

      mockAccess.mockRejectedValue(new Error('not found'));

      await expect(
        service.fetchSkillsFromGitHub('https://github.com/owner/empty-repo'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should skip unparseable SKILL.md files and continue', async () => {
      setupDownloadMock();

      mockStat.mockImplementation((p: string) => {
        if (p.includes('repo.tar.gz')) return Promise.resolve({ size: 1000 });
        if (p.includes('repo-HEAD')) return Promise.resolve({ isDirectory: () => true });
        // Only match the primary skills/ dir, not .claude/skills etc.
        if (p.match(/repo-HEAD\/skills$/) && !p.includes('.')) return Promise.resolve({ isDirectory: () => true });
        return Promise.reject(new Error('not found'));
      });

      mockReaddir.mockImplementation((dir: string, opts?: any) => {
        // downloadRepo calls readdir without withFileTypes
        if (dir.includes('aegis-gh-import') && (!opts || !opts.withFileTypes)) {
          return Promise.resolve(['repo-HEAD']);
        }
        if (dir.endsWith('/skills') && !dir.includes('.')) {
          return Promise.resolve([
            { name: 'good-skill', isFile: () => false, isDirectory: () => true },
            { name: 'bad-skill', isFile: () => false, isDirectory: () => true },
          ]);
        }
        if (dir.endsWith('/good-skill') || dir.endsWith('/bad-skill')) {
          return Promise.resolve([
            { name: 'SKILL.md', isFile: () => true, isDirectory: () => false },
          ]);
        }
        return Promise.resolve([]);
      });

      mockAccess.mockRejectedValue(new Error('not found'));

      mockReadFile.mockImplementation((filePath: string) => {
        if (filePath.includes('good-skill')) {
          return Promise.resolve(`---
name: good-skill
description: A valid skill
---
Good instructions.
`);
        }
        return Promise.resolve(`---
title: bad format
---
No name or description field.
`);
      });

      const result = await service.fetchSkillsFromGitHub('https://github.com/owner/repo');
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].name).toBe('good-skill');
    });

    it('should cleanup temp dir even on error', async () => {
      setupDownloadMock();

      mockStat.mockImplementation((p: string) => {
        if (p.includes('repo.tar.gz')) return Promise.resolve({ size: 1000 });
        if (p.includes('repo-HEAD')) return Promise.resolve({ isDirectory: () => true });
        return Promise.reject(new Error('not found'));
      });

      mockReaddir.mockImplementation((dir: string, opts?: any) => {
        if (dir.includes('aegis-gh-import') && (!opts || !opts.withFileTypes)) {
          return Promise.resolve(['repo-HEAD']);
        }
        return Promise.resolve([]);
      });

      mockAccess.mockRejectedValue(new Error('not found'));

      try {
        await service.fetchSkillsFromGitHub('https://github.com/owner/repo');
      } catch {
        // Expected
      }

      expect(mockRm).toHaveBeenCalled();
    });
  });
});
