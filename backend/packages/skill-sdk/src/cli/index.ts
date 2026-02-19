#!/usr/bin/env node
import { initCommand } from './commands/init';
import { validateCommand } from './commands/validate';
import { buildCommand } from './commands/build';
import { publishCommand } from './commands/publish';

const args = process.argv.slice(2);
const command = args[0];

function printUsage(): void {
  console.log('Usage: aegis-skill <command> [options]\n');
  console.log('Commands:');
  console.log('  init <name>    Scaffold a new skill project');
  console.log('  validate       Validate skill manifest in current directory');
  console.log('  build          Compile skill project with TypeScript');
  console.log('  publish        Publish skill to Aegis registry');
  console.log('');
  console.log('Publish options:');
  console.log('  --registry-url <url>   Registry API URL (or AEGIS_REGISTRY_URL env)');
  console.log('  --token <token>        Auth token (or AEGIS_TOKEN env)');
  console.log('');
  console.log('  --help         Show this help message');
  console.log('');
}

switch (command) {
  case 'init': {
    const name = args[1];
    if (!name) {
      console.error('Error: Skill name is required.\n');
      console.log('Usage: aegis-skill init <name>');
      process.exit(1);
    }
    initCommand(name);
    break;
  }
  case 'validate':
    validateCommand(args[1]);
    break;
  case 'build':
    buildCommand(args[1]);
    break;
  case 'publish':
    publishCommand(args.slice(1));
    break;
  case '--help':
  case '-h':
  case undefined:
    printUsage();
    break;
  default:
    console.error(`Unknown command: ${command}\n`);
    printUsage();
    process.exit(1);
}
