#!/usr/bin/env tsx
import {
  buildComplianceDashboardFromCache,
  formatComplianceDashboard,
  runComplianceReview,
} from '../src/security/compliance/index.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const failOn = args.includes('--fail-on=warn') ? 'warn' : 'fail';
  const strict = args.includes('--strict');

  if (strict) {
    const dashboard = await runComplianceReview({
      failOn,
      refresh: args.includes('--refresh'),
    });
    if (args.includes('--json')) {
      console.log(JSON.stringify(dashboard, null, 2));
    } else {
      console.log(formatComplianceDashboard(dashboard));
    }
    return;
  }

  const dashboard = await buildComplianceDashboardFromCache();
  if (args.includes('--json')) {
    console.log(JSON.stringify(dashboard, null, 2));
  } else {
    console.log(formatComplianceDashboard(dashboard));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
