#!/usr/bin/env node
import { runDeployCommand } from './deploy/deploy-command.js';
import { runLicenseCommand } from './deploy/license-activator.js';

const args = process.argv.slice(2);
const command = args[0] ?? 'help';

async function main(): Promise<void> {
  if (command === 'deploy') {
    await runDeployCommand(args.slice(1));
    return;
  }
  if (command === 'license' && args[1] === 'activate') {
    await runLicenseCommand(args.slice(2));
    return;
  }
  console.log('Usage: scout <deploy|license activate>');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
