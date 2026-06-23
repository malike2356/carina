import chalk from 'chalk';
import { loadLocalEnv } from '../config/env.js';

export async function runTenantCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'status';

  if (action === 'status') {
    const hosted = process.env.CARINA_HOSTED_MODE === 'true' || process.env.HOSTED_MODE === 'true';
    console.log(chalk.bold('\nTenant / hosted mode\n'));
    console.log(`  hosted mode:  ${hosted ? chalk.green('on') : chalk.gray('off')}`);
    console.log(`  tenant id:    ${process.env.CARINA_TENANT_ID ?? '(local)'}`);
    console.log(`  domain:       ${process.env.CARINA_HOSTED_DOMAIN ?? '(none)'}`);
    console.log('');
    return;
  }

  console.error('Usage: carina tenant status');
  process.exit(1);
}
