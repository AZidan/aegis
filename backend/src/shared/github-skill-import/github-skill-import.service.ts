import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as https from 'node:https';
import { createWriteStream } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const matter = require('gray-matter');

/** Parsed GitHub URL components */
export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  branch?: string;
  subPath?: string;
}

/** A companion file found alongside SKILL.md (e.g. scripts/deploy.sh) */
export interface SkillCompanionFile {
  relativePath: string;
  content: string;
}

/** A skill discovered from a SKILL.md file in a GitHub repo */
export interface DiscoveredSkill {
  name: string;
  version: string;
  description: string;
  category: string;
  compatibleRoles: string[];
  sourceCode: string;
  documentation: string;
  permissions: {
    network: { allowedDomains: string[] };
    files: { readPaths: string[]; writePaths: string[] };
    env: { required: string[]; optional: string[] };
  };
  skillPath: string;
  companionFiles: SkillCompanionFile[];
}

/** Result returned from fetchSkillsFromGitHub */
export interface GitHubImportResult {
  repoUrl: string;
  skills: DiscoveredSkill[];
}

const MAX_DOWNLOAD_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_DISCOVERY_DEPTH = 5;
const DOWNLOAD_TIMEOUT_MS = 60_000;

@Injectable()
export class GitHubSkillImportService {
  private readonly logger = new Logger(GitHubSkillImportService.name);

  /**
   * Parse various GitHub URL formats into components.
   */
  parseGitHubUrl(url: string): ParsedGitHubUrl {
    // Normalize: strip trailing slashes, add https if missing
    let normalized = url.trim().replace(/\/+$/, '');
    if (!normalized.startsWith('http')) {
      normalized = `https://${normalized}`;
    }

    let parsed: URL;
    try {
      parsed = new URL(normalized);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    if (!parsed.hostname.includes('github.com')) {
      throw new BadRequestException('Must be a GitHub URL');
    }

    // pathname: /owner/repo or /owner/repo/tree/branch/sub/path
    const segments = parsed.pathname.split('/').filter(Boolean);

    if (segments.length < 2) {
      throw new BadRequestException('URL must include owner and repository (e.g. github.com/owner/repo)');
    }

    const owner = segments[0];
    // Remove .git suffix if present
    const repo = segments[1].replace(/\.git$/, '');
    let branch: string | undefined;
    let subPath: string | undefined;

    // /owner/repo/tree/branch/optional/path
    if (segments.length >= 4 && segments[2] === 'tree') {
      branch = segments[3];
      if (segments.length > 4) {
        subPath = segments.slice(4).join('/');
      }
    }

    return { owner, repo, branch, subPath };
  }

  /**
   * Download and extract a GitHub repo tarball to a temp directory.
   * Uses GitHub's tarball API — no git binary required.
   */
  async downloadRepo(owner: string, repo: string, branch?: string): Promise<string> {
    const tmpDir = path.join(os.tmpdir(), `aegis-gh-import-${randomUUID()}`);
    await fs.mkdir(tmpDir, { recursive: true });

    const ref = branch || 'HEAD';
    const tarballUrl = `https://github.com/${owner}/${repo}/archive/${ref}.tar.gz`;

    try {
      const tarballPath = path.join(tmpDir, 'repo.tar.gz');

      // Download tarball with redirect following
      await this.downloadFile(tarballUrl, tarballPath);

      // Check size
      const stat = await fs.stat(tarballPath);
      if (stat.size > MAX_DOWNLOAD_SIZE_BYTES) {
        throw new BadRequestException('Repository archive exceeds 100MB size limit');
      }

      // Extract tarball using system tar (available on Alpine)
      await execFileAsync('tar', ['xzf', tarballPath, '-C', tmpDir]);

      // Remove the tarball
      await fs.unlink(tarballPath);

      // GitHub tarballs extract to a directory like "repo-branch/" or "repo-HEAD/"
      // Find the extracted directory
      const entries = await fs.readdir(tmpDir);
      if (entries.length === 0) {
        throw new BadRequestException('Failed to extract repository archive');
      }

      // Return the path to the extracted repo root
      const extractedDir = path.join(tmpDir, entries[0]);
      const extractedStat = await fs.stat(extractedDir);
      if (extractedStat.isDirectory()) {
        return extractedDir;
      }

      return tmpDir;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to download repo ${owner}/${repo}: ${message}`);
      throw new BadRequestException('Failed to download repository. Ensure the URL is correct and the repo is public.');
    }
  }

  /**
   * Download a file from a URL, following redirects (GitHub returns 302).
   */
  private downloadFile(url: string, destPath: string, redirectCount = 0): Promise<void> {
    if (redirectCount > 5) {
      return Promise.reject(new Error('Too many redirects'));
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Download timed out'));
      }, DOWNLOAD_TIMEOUT_MS);

      const req = https.get(url, { headers: { 'User-Agent': 'Aegis-Platform/1.0' } }, (res) => {
        // Follow redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          clearTimeout(timer);
          this.downloadFile(res.headers.location, destPath, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          clearTimeout(timer);
          reject(new Error(`HTTP ${res.statusCode} downloading tarball`));
          return;
        }

        const fileStream = createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          clearTimeout(timer);
          resolve();
        });
        fileStream.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      req.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Discover SKILL.md files in a repo directory.
   */
  async discoverSkillFiles(baseDir: string, subPath?: string): Promise<string[]> {
    const searchRoot = subPath ? path.join(baseDir, subPath) : baseDir;
    const skillFiles: string[] = [];

    // Priority directories to check first
    const priorityDirs = ['skills', '.claude/skills', '.github/skills', '.agents/skills'];

    for (const dir of priorityDirs) {
      const dirPath = path.join(searchRoot, dir);
      try {
        const stat = await fs.stat(dirPath);
        if (stat.isDirectory()) {
          const found = await this.walkForSkillMd(dirPath, 0, MAX_DISCOVERY_DEPTH);
          skillFiles.push(...found);
        }
      } catch {
        // Directory doesn't exist, skip
      }
    }

    // Check root-level SKILL.md
    const rootSkillMd = path.join(searchRoot, 'SKILL.md');
    try {
      await fs.access(rootSkillMd);
      if (!skillFiles.includes(rootSkillMd)) {
        skillFiles.push(rootSkillMd);
      }
    } catch {
      // No root SKILL.md
    }

    // If nothing found in priority dirs or root, do a recursive search
    if (skillFiles.length === 0) {
      const found = await this.walkForSkillMd(searchRoot, 0, MAX_DISCOVERY_DEPTH);
      skillFiles.push(...found);
    }

    return skillFiles;
  }

  /**
   * Recursively walk directories to find SKILL.md files.
   */
  private async walkForSkillMd(dir: string, depth: number, maxDepth: number): Promise<string[]> {
    if (depth > maxDepth) return [];

    const results: string[] = [];

    let entries: { name: string; isFile(): boolean; isDirectory(): boolean }[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true }) as any;
    } catch {
      return [];
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name as string);
      if (entry.isFile() && entry.name === 'SKILL.md') {
        results.push(fullPath);
      } else if (entry.isDirectory() && !(entry.name as string).startsWith('.git') && entry.name !== 'node_modules') {
        const sub = await this.walkForSkillMd(fullPath, depth + 1, maxDepth);
        results.push(...sub);
      }
    }

    return results;
  }

  /**
   * Parse a single SKILL.md file into a DiscoveredSkill.
   * Returns null if parsing fails.
   */
  parseSkillMd(content: string, relativePath: string): DiscoveredSkill | null {
    try {
      const { data: frontmatter, content: body } = matter(content);

      const name = frontmatter.name;
      if (!name || typeof name !== 'string') {
        this.logger.warn(`SKILL.md missing required 'name' field: ${relativePath}`);
        return null;
      }

      const description = frontmatter.description;
      if (!description || typeof description !== 'string') {
        this.logger.warn(`SKILL.md missing required 'description' field: ${relativePath}`);
        return null;
      }

      // Extract version from metadata or default
      const version = frontmatter.metadata?.version?.toString() || '1.0.0';

      // Map compatibility to compatibleRoles heuristic
      const compatibleRoles = this.deriveCompatibleRoles(frontmatter.compatibility);

      // Extract allowed-tools for informational purposes
      const allowedTools = frontmatter['allowed-tools'] || '';

      // Build documentation from metadata and license
      const docParts: string[] = [];
      if (frontmatter.license) {
        docParts.push(`License: ${frontmatter.license}`);
      }
      if (frontmatter.compatibility) {
        docParts.push(`Compatibility: ${frontmatter.compatibility}`);
      }
      if (allowedTools) {
        docParts.push(`Allowed Tools: ${allowedTools}`);
      }
      if (frontmatter.metadata) {
        const metaEntries = Object.entries(frontmatter.metadata)
          .filter(([k]) => k !== 'version')
          .map(([k, v]) => `${k}: ${v}`);
        if (metaEntries.length) {
          docParts.push(`Metadata:\n${metaEntries.join('\n')}`);
        }
      }

      return {
        name,
        version,
        description: description.length > 500 ? description.slice(0, 497) + '...' : description,
        category: 'custom',
        compatibleRoles,
        sourceCode: body.trim(),
        documentation: docParts.join('\n\n') || description,
        permissions: {
          network: { allowedDomains: [] },
          files: { readPaths: [], writePaths: [] },
          env: { required: [], optional: [] },
        },
        skillPath: relativePath,
        companionFiles: [],
      };
    } catch (err) {
      this.logger.warn(`Failed to parse SKILL.md at ${relativePath}: ${err}`);
      return null;
    }
  }

  /**
   * Derive compatible roles from the compatibility field.
   */
  private deriveCompatibleRoles(compatibility?: string): string[] {
    if (!compatibility || typeof compatibility !== 'string') {
      return ['developer'];
    }

    const lower = compatibility.toLowerCase();
    const roles: string[] = [];

    if (lower.includes('git') || lower.includes('code') || lower.includes('bash') || lower.includes('terminal')) {
      roles.push('developer');
    }
    if (lower.includes('analy') || lower.includes('data') || lower.includes('report')) {
      roles.push('analyst');
    }
    if (lower.includes('secur') || lower.includes('audit') || lower.includes('compliance')) {
      roles.push('security');
    }

    return roles.length > 0 ? roles : ['developer'];
  }

  /**
   * Collect companion files (scripts, configs, etc.) from the same directory as a SKILL.md.
   * Reads text files up to 50KB each, max 20 files per skill.
   */
  private async collectCompanionFiles(skillMdPath: string, repoDir: string): Promise<SkillCompanionFile[]> {
    const skillDir = path.dirname(skillMdPath);
    const companions: SkillCompanionFile[] = [];
    const MAX_FILE_SIZE = 50 * 1024; // 50KB
    const MAX_FILES = 20;
    const TEXT_EXTENSIONS = new Set([
      '.sh', '.bash', '.zsh', '.fish',
      '.ts', '.js', '.mjs', '.cjs', '.tsx', '.jsx',
      '.py', '.rb', '.go', '.rs', '.java', '.kt',
      '.json', '.yaml', '.yml', '.toml', '.xml',
      '.md', '.txt', '.csv', '.env', '.conf', '.cfg',
      '.html', '.css', '.scss', '.sql',
      '.dockerfile', '.Makefile',
    ]);

    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > 3 || companions.length >= MAX_FILES) return;
      let entries: { name: string; isFile(): boolean; isDirectory(): boolean }[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true }) as any;
      } catch {
        return;
      }

      for (const entry of entries) {
        if (companions.length >= MAX_FILES) break;
        const fullPath = path.join(dir, entry.name as string);

        if (entry.isFile() && entry.name !== 'SKILL.md') {
          const ext = path.extname(entry.name as string).toLowerCase();
          // Include known text extensions or extensionless files (like Makefile, Dockerfile)
          const basename = (entry.name as string).toLowerCase();
          if (TEXT_EXTENSIONS.has(ext) || basename === 'makefile' || basename === 'dockerfile') {
            try {
              const stat = await fs.stat(fullPath);
              if (stat.size <= MAX_FILE_SIZE) {
                const content = await fs.readFile(fullPath, 'utf-8');
                companions.push({
                  relativePath: path.relative(skillDir, fullPath),
                  content,
                });
              }
            } catch {
              // Skip unreadable files
            }
          }
        } else if (entry.isDirectory() && !(entry.name as string).startsWith('.') && entry.name !== 'node_modules') {
          await walk(fullPath, depth + 1);
        }
      }
    };

    await walk(skillDir, 0);
    return companions;
  }

  /**
   * Main orchestrator: fetch and parse skills from a GitHub URL.
   */
  async fetchSkillsFromGitHub(url: string): Promise<GitHubImportResult> {
    const { owner, repo, branch, subPath } = this.parseGitHubUrl(url);
    const repoUrl = `https://github.com/${owner}/${repo}`;

    let repoDir: string | undefined;
    let tmpParent: string | undefined;
    try {
      repoDir = await this.downloadRepo(owner, repo, branch);
      // Track the parent tmp directory for cleanup (repoDir is a subdirectory)
      tmpParent = path.dirname(repoDir);

      const skillFiles = await this.discoverSkillFiles(repoDir, subPath);

      if (skillFiles.length === 0) {
        throw new NotFoundException('No SKILL.md files found in repository');
      }

      const skills: DiscoveredSkill[] = [];
      for (const filePath of skillFiles) {
        const content = await fs.readFile(filePath, 'utf-8');
        const relativePath = path.relative(repoDir, filePath);
        const skill = this.parseSkillMd(content, relativePath);
        if (skill) {
          // Collect companion files (scripts, configs) from the same directory
          skill.companionFiles = await this.collectCompanionFiles(filePath, repoDir);
          skills.push(skill);
        }
      }

      if (skills.length === 0) {
        throw new NotFoundException('SKILL.md files found but none could be parsed. Ensure they have valid YAML frontmatter with name and description fields.');
      }

      this.logger.log(`Discovered ${skills.length} skills from ${owner}/${repo}`);

      return { repoUrl, skills };
    } finally {
      // Clean up the entire temp directory
      const cleanupDir = tmpParent || repoDir;
      if (cleanupDir) {
        await fs.rm(cleanupDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
}
