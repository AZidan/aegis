import * as fs from 'fs';
import * as path from 'path';
import {
  skillTemplate,
  manifestTemplate,
  testTemplate,
  packageTemplate,
  tsconfigTemplate,
} from '../templates';

/**
 * `aegis-skill init <name>` — scaffolds a new skill project.
 */
export function initCommand(name: string, targetDir?: string): void {
  const dir = targetDir ?? path.resolve(process.cwd(), name);

  if (fs.existsSync(dir)) {
    console.error(`Error: Directory "${dir}" already exists.`);
    process.exit(1);
  }

  fs.mkdirSync(dir, { recursive: true });

  const files: Record<string, string> = {
    'skill.ts': skillTemplate(name),
    'skill.manifest.json': manifestTemplate(name),
    'skill.spec.ts': testTemplate(name),
    'package.json': packageTemplate(name),
    'tsconfig.json': tsconfigTemplate(),
  };

  for (const [filename, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, filename), content, 'utf-8');
  }

  console.log(`\nSkill "${name}" scaffolded at ${dir}\n`);
  console.log('Next steps:');
  console.log(`  cd ${name}`);
  console.log('  npm install');
  console.log('  npm test');
  console.log('');
}
