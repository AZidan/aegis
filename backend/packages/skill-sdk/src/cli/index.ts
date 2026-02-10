#!/usr/bin/env node
import { initCommand } from './commands/init';

const args = process.argv.slice(2);
const command = args[0];

function printUsage(): void {
  console.log('Usage: aegis-skill <command> [options]\n');
  console.log('Commands:');
  console.log('  init <name>    Scaffold a new skill project');
  console.log('  validate       Validate skill in current directory');
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
