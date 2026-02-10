import { SkillDefinition } from '../types/skill-definition';
import { skillSchema } from './create-skill';

export interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Validates a skill definition and returns a report (does not throw).
 * Also performs additional semantic checks beyond schema validation.
 */
export function validateSkill(
  definition: Partial<SkillDefinition>,
): ValidationReport {
  const issues: ValidationIssue[] = [];

  // Schema validation
  const result = skillSchema.safeParse(definition);
  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push({
        path: issue.path.join('.'),
        message: issue.message,
        severity: 'error',
      });
    }
  }

  // Semantic checks (only if schema passed basic shape)
  if (definition.permissions) {
    // Warn about overly permissive network access
    const domains = definition.permissions.network?.allowedDomains ?? [];
    if (domains.includes('*') || domains.includes('*.*')) {
      issues.push({
        path: 'permissions.network.allowedDomains',
        message: 'Wildcard "*" grants access to all domains — consider restricting to specific domains',
        severity: 'warning',
      });
    }

    // Warn about write to root
    const writePaths = definition.permissions.files?.writePaths ?? [];
    if (writePaths.includes('/') || writePaths.includes('/*')) {
      issues.push({
        path: 'permissions.files.writePaths',
        message: 'Writing to root "/" is overly permissive — restrict to specific directories',
        severity: 'warning',
      });
    }
  }

  // Warn if config options have 'select' type but no options
  if (definition.config) {
    for (const opt of definition.config) {
      if (opt.type === 'select' && (!opt.options || opt.options.length === 0)) {
        issues.push({
          path: `config.${opt.key}`,
          message: `Config option "${opt.key}" has type "select" but no options defined`,
          severity: 'warning',
        });
      }
    }
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  };
}
