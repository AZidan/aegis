import { Injectable, Logger } from '@nestjs/common';
import AdmZip from 'adm-zip';
import matter from 'gray-matter';
import Handlebars from 'handlebars';
import crypto from 'crypto';
import path from 'path';
import * as fs from 'fs/promises';
import { SkillValidatorService } from './skill-validator.service';
import { manifestSchema } from './dto/skill-package.dto';
import {
  PackageValidationResult,
  PackageValidationIssue,
  PackageFileInfo,
  SkillMdParsed,
  StoredPackage,
} from './interfaces/skill-package.interface';
import { ValidationReport } from './interfaces/validation-report.interface';

/** Maximum compressed size: 5 MB */
const MAX_COMPRESSED_SIZE = 5 * 1024 * 1024;
/** Maximum uncompressed size: 20 MB */
const MAX_UNCOMPRESSED_SIZE = 20 * 1024 * 1024;
/** Allowed asset extensions */
const ALLOWED_ASSET_EXTENSIONS = new Set(['.csv', '.json', '.txt', '.png', '.jpg']);
/** Allowed reference extensions */
const ALLOWED_REFERENCE_EXTENSIONS = new Set(['.md', '.txt', '.pdf']);
/** Default storage path (overridden by SKILL_PACKAGE_STORAGE_PATH env) */
const DEFAULT_STORAGE_PATH = '/data/skill-packages';

@Injectable()
export class SkillPackageService {
  private readonly logger = new Logger(SkillPackageService.name);
  private readonly storagePath: string;

  constructor(private readonly skillValidator: SkillValidatorService) {
    this.storagePath =
      process.env.SKILL_PACKAGE_STORAGE_PATH ?? DEFAULT_STORAGE_PATH;
  }

  /**
   * Parse and validate a skill package ZIP buffer.
   * Optionally store the ZIP to disk for later use (upload flow).
   */
  async parseAndValidate(
    buffer: Buffer,
    options?: { store?: boolean; tenantId?: string; userId?: string },
  ): Promise<PackageValidationResult> {
    const issues: PackageValidationIssue[] = [];
    const files: PackageFileInfo[] = [];
    const scriptAnalysis: ValidationReport[] = [];
    let manifest: Record<string, unknown> | null = null;
    let skillMd: SkillMdParsed | null = null;

    // 1. Check compressed size
    if (buffer.length > MAX_COMPRESSED_SIZE) {
      issues.push({
        severity: 'error',
        message: `Compressed package exceeds maximum size of ${MAX_COMPRESSED_SIZE / 1024 / 1024}MB`,
      });
      return { valid: false, manifest: null, skillMd: null, files: [], issues };
    }

    // 2. Attempt to open the ZIP
    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      issues.push({
        severity: 'error',
        message: 'Failed to open ZIP archive. File may be corrupted or not a valid ZIP.',
      });
      return { valid: false, manifest: null, skillMd: null, files: [], issues };
    }

    const entries = zip.getEntries();
    if (entries.length === 0) {
      issues.push({
        severity: 'error',
        message: 'ZIP archive is empty',
      });
      return { valid: false, manifest: null, skillMd: null, files: [], issues };
    }

    // 3. Check total uncompressed size
    const totalUncompressed = entries.reduce(
      (sum, e) => sum + (e.header?.size ?? 0),
      0,
    );
    if (totalUncompressed > MAX_UNCOMPRESSED_SIZE) {
      issues.push({
        severity: 'error',
        message: `Uncompressed package exceeds maximum size of ${MAX_UNCOMPRESSED_SIZE / 1024 / 1024}MB`,
      });
      return { valid: false, manifest: null, skillMd: null, files: [], issues };
    }

    // 4. Build a map of entry paths (normalize: strip leading ./ or /)
    const entryMap = new Map<string, AdmZip.IZipEntry>();
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const normalized = entry.entryName
        .replace(/^\.\//, '')
        .replace(/^\//, '');
      entryMap.set(normalized, entry);
    }

    // 5. Check for required files
    if (!entryMap.has('skill.md')) {
      issues.push({
        severity: 'error',
        file: 'skill.md',
        message: 'Missing required file: skill.md',
      });
    }
    if (!entryMap.has('manifest.json')) {
      issues.push({
        severity: 'error',
        file: 'manifest.json',
        message: 'Missing required file: manifest.json',
      });
    }

    // If both required files are missing, return early
    if (!entryMap.has('skill.md') && !entryMap.has('manifest.json')) {
      return { valid: false, manifest: null, skillMd: null, files: [], issues };
    }

    // 6. Parse manifest.json
    const manifestEntry = entryMap.get('manifest.json');
    if (manifestEntry) {
      try {
        const raw = manifestEntry.getData().toString('utf-8');
        const parsed = JSON.parse(raw);
        const result = manifestSchema.safeParse(parsed);
        if (!result.success) {
          for (const err of result.error.issues) {
            issues.push({
              severity: 'error',
              file: 'manifest.json',
              message: `Manifest validation: ${err.path.join('.')} - ${err.message}`,
            });
          }
        } else {
          manifest = result.data as unknown as Record<string, unknown>;
        }
      } catch (e) {
        issues.push({
          severity: 'error',
          file: 'manifest.json',
          message: `Invalid JSON in manifest.json: ${(e as Error).message}`,
        });
      }
      files.push({
        path: 'manifest.json',
        size: manifestEntry.header?.size ?? 0,
        type: 'manifest',
      });
    }

    // 7. Parse skill.md
    const skillMdEntry = entryMap.get('skill.md');
    if (skillMdEntry) {
      try {
        const raw = skillMdEntry.getData().toString('utf-8');
        const parsed = matter(raw);
        const content = parsed.content.trim();

        // Extract title: first H1 heading or frontmatter title
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title =
          (parsed.data.title as string) ||
          (titleMatch ? titleMatch[1].trim() : 'Untitled Skill');

        // Extract description: frontmatter description or first paragraph
        const descriptionMatch = content
          .replace(/^#.*$/m, '')
          .trim()
          .split('\n\n')[0];
        const description =
          (parsed.data.description as string) || descriptionMatch || '';

        // Extract trigger
        const trigger = parsed.data.trigger as string | undefined;

        // Extract steps: look for ordered list items
        const stepMatches = content.match(/^\d+\.\s+(.+)$/gm);
        const steps = stepMatches
          ? stepMatches.map((s) => s.replace(/^\d+\.\s+/, '').trim())
          : [];

        skillMd = {
          title,
          description,
          trigger,
          steps,
          rawContent: raw,
          frontmatter: parsed.data as Record<string, unknown>,
        };
      } catch (e) {
        issues.push({
          severity: 'error',
          file: 'skill.md',
          message: `Failed to parse skill.md: ${(e as Error).message}`,
        });
      }
      files.push({
        path: 'skill.md',
        size: skillMdEntry.header?.size ?? 0,
        type: 'skill-definition',
      });
    }

    // 8. Process all other files
    for (const [filePath, entry] of entryMap) {
      if (filePath === 'manifest.json' || filePath === 'skill.md') continue;

      const ext = path.extname(filePath).toLowerCase();
      const dir = filePath.split('/')[0];

      if (dir === 'scripts' && ext === '.js') {
        // JavaScript scripts - validate with SkillValidatorService
        files.push({
          path: filePath,
          size: entry.header?.size ?? 0,
          type: 'javascript',
        });

        const content = entry.getData().toString('utf-8');
        try {
          const report = await this.skillValidator.validate(content, false);
          scriptAnalysis.push(report);
          if (!report.valid) {
            for (const issue of report.issues) {
              issues.push({
                severity: issue.severity,
                file: filePath,
                message: issue.message,
              });
            }
          }
        } catch (e) {
          issues.push({
            severity: 'error',
            file: filePath,
            message: `Script analysis failed: ${(e as Error).message}`,
          });
        }
      } else if (dir === 'templates' && ext === '.hbs') {
        // Handlebars templates - validate syntax
        files.push({
          path: filePath,
          size: entry.header?.size ?? 0,
          type: 'handlebars',
        });

        const content = entry.getData().toString('utf-8');
        try {
          Handlebars.precompile(content);
        } catch (e) {
          issues.push({
            severity: 'error',
            file: filePath,
            message: `Invalid Handlebars template: ${(e as Error).message}`,
          });
        }
      } else if (dir === 'references') {
        // References - static docs for agent context
        files.push({
          path: filePath,
          size: entry.header?.size ?? 0,
          type: 'reference',
        });

        if (!ALLOWED_REFERENCE_EXTENSIONS.has(ext)) {
          issues.push({
            severity: 'error',
            file: filePath,
            message: `Reference has disallowed extension '${ext}'. Allowed: ${[...ALLOWED_REFERENCE_EXTENSIONS].join(', ')}`,
          });
        }
      } else if (dir === 'assets') {
        // Assets - check allowed extensions
        files.push({
          path: filePath,
          size: entry.header?.size ?? 0,
          type: 'data',
        });

        if (!ALLOWED_ASSET_EXTENSIONS.has(ext)) {
          issues.push({
            severity: 'error',
            file: filePath,
            message: `Asset has disallowed extension '${ext}'. Allowed: ${[...ALLOWED_ASSET_EXTENSIONS].join(', ')}`,
          });
        }
      } else if (filePath === 'README.md') {
        // README at root is allowed
        files.push({
          path: filePath,
          size: entry.header?.size ?? 0,
          type: 'reference',
        });
      } else {
        // Unknown file in package
        files.push({
          path: filePath,
          size: entry.header?.size ?? 0,
          type: 'data',
        });

        issues.push({
          severity: 'warning',
          file: filePath,
          message: `Unexpected file location. Files should be in scripts/, templates/, references/, or assets/ directories.`,
        });
      }

      // Check per-file size limits from manifest fileRules
      if (manifest) {
        const validation = manifest.validation as
          | { fileRules?: Record<string, { maxSizeKb?: number }> }
          | undefined;
        if (validation?.fileRules) {
          for (const [pattern, rule] of Object.entries(validation.fileRules)) {
            if (rule.maxSizeKb && this.matchGlob(filePath, pattern)) {
              const sizeKb = (entry.header?.size ?? 0) / 1024;
              if (sizeKb > rule.maxSizeKb) {
                issues.push({
                  severity: 'error',
                  file: filePath,
                  message: `File exceeds maximum size of ${rule.maxSizeKb}KB (actual: ${Math.round(sizeKb)}KB)`,
                });
              }
            }
          }
        }
      }
    }

    const hasErrors = issues.some((i) => i.severity === 'error');
    const result: PackageValidationResult = {
      valid: !hasErrors,
      manifest,
      skillMd,
      files,
      issues,
      scriptAnalysis: scriptAnalysis.length > 0 ? scriptAnalysis : undefined,
    };

    // 9. Persist the ZIP to disk (tenant-scoped)
    if (options?.store && !hasErrors && manifest && options.tenantId && options.userId) {
      const skillName = (manifest as { name?: string }).name ?? 'unknown';
      const skillVersion = (manifest as { version?: string }).version ?? '0.0.0';
      const packageId = crypto.randomUUID();

      const packagePath = this.getPackagePath(options.tenantId, skillName, skillVersion);
      await fs.mkdir(path.dirname(packagePath), { recursive: true });
      await fs.writeFile(packagePath, buffer);

      const stored: StoredPackage = {
        packageId,
        packagePath,
        manifest: manifest!,
        skillMd: skillMd!,
        files,
        validationResult: result,
        createdAt: new Date(),
        tenantId: options.tenantId,
        userId: options.userId,
      };

      // Write metadata alongside the ZIP for later retrieval
      const metaPath = packagePath.replace(/\.zip$/, '.meta.json');
      await fs.writeFile(metaPath, JSON.stringify(stored, null, 2), 'utf-8');

      result.packageId = packageId;
      result.packagePath = packagePath;

      this.logger.log(
        `Stored package ${packageId} at ${packagePath} for tenant ${options.tenantId}`,
      );
    }

    return result;
  }

  /**
   * Get the disk path for a skill package ZIP.
   * Storage is tenant-scoped: {storagePath}/{tenantId}/{skillName}/{version}/package.zip
   */
  getPackagePath(tenantId: string, skillName: string, version: string): string {
    return path.join(this.storagePath, tenantId, skillName, version, 'package.zip');
  }

  /**
   * Read stored package metadata from disk.
   */
  async getStoredPackage(packagePath: string): Promise<StoredPackage | null> {
    try {
      const metaPath = packagePath.replace(/\.zip$/, '.meta.json');
      const raw = await fs.readFile(metaPath, 'utf-8');
      return JSON.parse(raw) as StoredPackage;
    } catch {
      return null;
    }
  }

  /**
   * Extract all files from a stored package ZIP to a target directory.
   * Excludes manifest.json by default (security sidecar stays server-side).
   * All extracted files are set read-only (chmod 444).
   */
  async extractPackageToDir(
    packagePath: string,
    targetDir: string,
    options?: { excludeManifest?: boolean },
  ): Promise<string[]> {
    const excludeManifest = options?.excludeManifest ?? true;

    const buffer = await fs.readFile(packagePath);
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    const extracted: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const normalized = entry.entryName
        .replace(/^\.\//, '')
        .replace(/^\//, '');

      // Skip manifest.json if excluded
      if (excludeManifest && normalized === 'manifest.json') continue;

      // Security: prevent path traversal
      const targetPath = path.join(targetDir, normalized);
      if (!targetPath.startsWith(path.resolve(targetDir))) {
        this.logger.warn(`Skipping path traversal attempt: ${normalized}`);
        continue;
      }

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, entry.getData());
      await fs.chmod(targetPath, 0o444); // Read-only
      extracted.push(normalized);
    }

    this.logger.log(
      `Extracted ${extracted.length} files to ${targetDir}`,
    );
    return extracted;
  }

  /**
   * Simple glob matching for file rules (supports * wildcard).
   */
  private matchGlob(filePath: string, pattern: string): boolean {
    const regex = new RegExp(
      '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^/]*') + '$',
    );
    return regex.test(filePath);
  }
}
