import chalk from 'chalk';
import { loadLocalEnv } from '../config/env.js';

export async function runBillingCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'status';

  if (action === 'status') {
    const stripe = Boolean(process.env.STRIPE_SECRET_KEY);
    console.log(chalk.bold('\nBilling\n'));
    console.log(`  stripe:       ${stripe ? chalk.green('configured') : chalk.gray('not configured')}`);
    console.log(`  price id:     ${process.env.STRIPE_PRICE_ID ?? '(default)'}`);
    console.log(`  portal:       https://carinaai.uk/pricing`);
    console.log('');
    return;
  }

  console.error('Usage: carina billing status');
  process.exit(1);
}
