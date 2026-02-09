import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import {
  PermissionManifest,
  LegacyPermissions,
  PermissionDiff,
  PermissionViolation,
} from './interfaces/permission-manifest.interface';
import {
  PermissionManifestSchema,
  LegacyPermissionsSchema,
} from './dto/permission-manifest.dto';

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  constructor(private readonly auditService: AuditService) {}

  /**
   * Validate a permission manifest against the new schema.
   * @throws BadRequestException if invalid.
   */
  validateManifest(data: unknown): PermissionManifest {
    const result = PermissionManifestSchema.safeParse(data);
    if (!result.success) {
      throw new BadRequestException(
        `Invalid permission manifest: ${result.error.issues.map((i) => i.message).join(', ')}`,
      );
    }
    return result.data;
  }

  /**
   * Detect whether permissions are in legacy (v1) format.
   */
  isLegacyFormat(data: unknown): data is LegacyPermissions {
    return (
      LegacyPermissionsSchema.safeParse(data).success &&
      !PermissionManifestSchema.safeParse(data).success
    );
  }

  /**
   * Migrate legacy format to new manifest format.
   * Additive-only: no data is lost.
   */
  migrateOldFormat(legacy: LegacyPermissions): PermissionManifest {
    return {
      network: { allowedDomains: legacy.network ?? [] },
      files: {
        readPaths: legacy.files ?? [],
        writePaths: [],
      },
      env: {
        required: legacy.env ?? [],
        optional: [],
      },
    };
  }

  /**
   * Normalize permissions -- return new format regardless of input.
   * Returns empty defaults for null/undefined input.
   */
  normalizePermissions(data: unknown): PermissionManifest {
    if (data == null) {
      return {
        network: { allowedDomains: [] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      };
    }
    if (this.isLegacyFormat(data)) {
      return this.migrateOldFormat(data as LegacyPermissions);
    }
    return this.validateManifest(data);
  }

  /**
   * Compute diff between two permission manifests.
   */
  computeDiff(
    existing: PermissionManifest,
    incoming: PermissionManifest,
  ): PermissionDiff {
    const diffArray = (a: string[], b: string[]) => ({
      added: b.filter((x) => !a.includes(x)),
      removed: a.filter((x) => !b.includes(x)),
      unchanged: a.filter((x) => b.includes(x)),
    });

    const networkDiff = diffArray(
      existing.network.allowedDomains,
      incoming.network.allowedDomains,
    );
    const readPathsDiff = diffArray(
      existing.files.readPaths,
      incoming.files.readPaths,
    );
    const writePathsDiff = diffArray(
      existing.files.writePaths,
      incoming.files.writePaths,
    );
    const requiredEnvDiff = diffArray(
      existing.env.required,
      incoming.env.required,
    );
    const optionalEnvDiff = diffArray(
      existing.env.optional,
      incoming.env.optional,
    );

    return {
      added: {
        network: { allowedDomains: networkDiff.added },
        files: {
          readPaths: readPathsDiff.added,
          writePaths: writePathsDiff.added,
        },
        env: {
          required: requiredEnvDiff.added,
          optional: optionalEnvDiff.added,
        },
      },
      removed: {
        network: { allowedDomains: networkDiff.removed },
        files: {
          readPaths: readPathsDiff.removed,
          writePaths: writePathsDiff.removed,
        },
        env: {
          required: requiredEnvDiff.removed,
          optional: optionalEnvDiff.removed,
        },
      },
      unchanged: {
        network: { allowedDomains: networkDiff.unchanged },
        files: {
          readPaths: readPathsDiff.unchanged,
          writePaths: writePathsDiff.unchanged,
        },
        env: {
          required: requiredEnvDiff.unchanged,
          optional: optionalEnvDiff.unchanged,
        },
      },
    };
  }

  /**
   * Check if a skill's manifest is compatible with an agent's tool policy.
   * Returns true if compatible, false if there would be violations.
   */
  checkPolicyCompatibility(
    manifest: PermissionManifest,
    toolPolicy: { allow: string[] },
  ): { compatible: boolean; violations: string[] } {
    const violations: string[] = [];

    if (
      manifest.network.allowedDomains.length > 0 &&
      !toolPolicy.allow.includes('network')
    ) {
      violations.push(
        `Skill requires network access to: ${manifest.network.allowedDomains.join(', ')}`,
      );
    }

    if (
      (manifest.files.readPaths.length > 0 ||
        manifest.files.writePaths.length > 0) &&
      !toolPolicy.allow.includes('filesystem')
    ) {
      violations.push('Skill requires filesystem access');
    }

    return { compatible: violations.length === 0, violations };
  }

  /**
   * Log a permission violation via the audit service.
   */
  logPermissionViolation(
    violation: PermissionViolation,
    tenantId: string,
  ): void {
    this.auditService.logAction({
      actorType: 'agent',
      actorId: violation.agentId,
      actorName: violation.agentId,
      action: 'permission_violation',
      targetType: 'skill',
      targetId: violation.skillId,
      details: {
        violationType: violation.violationType,
        detail: violation.detail,
      },
      severity: 'warning',
      tenantId,
      agentId: violation.agentId,
    });

    this.logger.warn(
      `Permission violation: ${violation.violationType} for skill ${violation.skillId} on agent ${violation.agentId}: ${violation.detail}`,
    );
  }
}
