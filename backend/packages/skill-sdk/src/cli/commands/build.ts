import { spawnSync } from 'child_process';
import * as path from 'path';

/**
 * `aegis-skill build` — compiles the skill project using TypeScript.
 */
export function buildCommand(dir?: string): void {
  const targetDir = dir ?? process.cwd();
  const tsconfigPath = path.resolve(targetDir, 'tsconfig.json');

  console.log('Building skill project...');

  const result = spawnSync('npx', ['tsc', '--project', tsconfigPath], {
    cwd: targetDir,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`Error: Build failed — ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`Build failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }

  console.log('Build succeeded.');
}
