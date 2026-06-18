import chalk from 'chalk';
import { loadLocalEnv } from '../config/env.js';
import { config } from '../../config/index.js';

export async function runBillingCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'status';

  if (action === 'status') {
    const stripe = Boolean(process.env.STRIPE_SECRET_KEY);
    console.log(chalk.bold('\nBilling\n'));
    console.log(`  stripe:       ${stripe ? chalk.green('configured') : chalk.gray('not configured')}`);
    console.log(`  price id:     ${process.env.STRIPE_PRICE_ID ?? '(default)'}`);
    console.log(`  portal:       ${config.product.marketingUrl}/pricing`);
    console.log('');
    return;
  }

  if (action === 'reconcile') {
    const orgArg = args.find((value) => value.startsWith('--org='));
    const orgId = orgArg ? orgArg.slice('--org='.length).trim() : undefined;
    const { initDb, pool } = await import('../../memory/db.js');
    await initDb();
    const { runBillingReconciliation } = await import('../../billing/reconciliation-job.js');
    const report = await runBillingReconciliation(orgId);
    console.log(chalk.bold('\nBilling reconciliation\n'));
    console.log(`  month:        ${report.month}`);
    console.log(`  threshold:    ${report.driftThresholdPercent}%`);
    console.log(`  drift rows:   ${report.rows.length}`);
    for (const row of report.rows) {
      console.log(
        `  - ${row.orgId}: ledger $${row.ledgerProviderCostUsd.toFixed(4)} `
        + `vs model_usage $${row.modelUsageCostUsd.toFixed(4)} (${row.driftPercent}%)`,
      );
    }
    console.log('');
    await pool.end().catch(() => undefined);
    return;
  }

  console.error('Usage: carina billing status | carina billing reconcile [--org=ORG_ID]');
  process.exit(1);
}
