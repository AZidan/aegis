import * as fs from 'fs';
import * as path from 'path';
import { validateSkill } from '../../helpers/validate-skill';

/**
 * `aegis-skill validate` — validates the skill manifest in the current (or given) directory.
 *
 * Note: JSON manifests cannot contain a `handler` function, so handler-related
 * validation errors are filtered out for CLI validation.
 */
export function validateCommand(dir?: string): void {
  const targetDir = dir ?? process.cwd();
  const manifestPath = path.resolve(targetDir, 'skill.manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`Error: skill.manifest.json not found in ${targetDir}`);
    process.exit(1);
  }

  let manifest: unknown;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    manifest = JSON.parse(raw);
  } catch (err) {
    console.error(`Error: Failed to parse skill.manifest.json — ${(err as Error).message}`);
    process.exit(1);
  }

  const report = validateSkill(manifest as Record<string, unknown>);

  // Filter out handler-related errors since JSON manifests can't contain functions
  const filteredIssues = report.issues.filter(
    (i) => i.path !== 'handler',
  );

  const hasErrors = filteredIssues.some((i) => i.severity === 'error');

  if (filteredIssues.length === 0) {
    console.log('Validation passed — no issues found.');
    return;
  }

  for (const issue of filteredIssues) {
    const prefix = issue.severity === 'error' ? '[ERROR]' : '[WARN]';
    console.log(`${prefix} ${issue.path}: ${issue.message}`);
  }

  if (hasErrors) {
    process.exit(1);
  }
}
