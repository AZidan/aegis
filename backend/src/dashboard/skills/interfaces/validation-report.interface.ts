/**
 * Validation report types for skill static analysis and dry-run.
 */

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  /** Issue severity */
  severity: IssueSeverity;
  /** Code pattern that triggered the issue */
  pattern: string;
  /** Human-readable message */
  message: string;
  /** Line number if available */
  line?: number;
}

export interface ValidationReport {
  /** Whether the skill passed validation (no errors) */
  valid: boolean;
  /** List of issues found */
  issues: ValidationIssue[];
  /** Dry-run result (if requested) */
  dryRun?: {
    success: boolean;
    output?: unknown;
    error?: string;
    durationMs: number;
  };
}
