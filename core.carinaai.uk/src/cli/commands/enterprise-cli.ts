import chalk from 'chalk';
import { describeEnterpriseOffering, ENTERPRISE_SUPPORT_SLAS } from '../../enterprise/kernel-support.js';

export async function runEnterpriseCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'status';
  const json = args.includes('--json');

  if (action === 'status' || action === 'offer') {
    const offering = describeEnterpriseOffering();
    if (json) {
      console.log(JSON.stringify({ offering, tiers: ENTERPRISE_SUPPORT_SLAS }, null, 2));
      return;
    }
    console.log(chalk.bold('\nCarina Enterprise (MIT kernel + commercial layers)\n'));
    console.log(`  Model: ${offering.model}`);
    console.log(`  Kernel license: ${offering.kernelLicense}`);
    console.log(`  Active tier: ${offering.activeTier}`);
    console.log(`  SLA: ${offering.sla.uptimeSla ?? 'none'} uptime; ${offering.sla.responseHours ?? 'n/a'}h response`);
    console.log(`  Channels: ${offering.sla.channels.join(', ')}`);
    console.log(chalk.bold('\nPaid layers\n'));
    for (const layer of offering.paidLayers) console.log(`  - ${layer}`);
    console.log(chalk.bold('\nIncludes (active tier)\n'));
    for (const item of offering.sla.includes) console.log(`  - ${item}`);
    console.log('');
    return;
  }

  if (action === 'tiers') {
    if (json) {
      console.log(JSON.stringify(ENTERPRISE_SUPPORT_SLAS, null, 2));
      return;
    }
    console.log(chalk.bold('\nSupport tiers\n'));
    for (const tier of Object.values(ENTERPRISE_SUPPORT_SLAS)) {
      console.log(`  ${tier.name} (${tier.tier})`);
      console.log(chalk.gray(`    uptime ${tier.uptimeSla ?? 'n/a'}; response ${tier.responseHours ?? 'n/a'}h`));
    }
    console.log('');
    return;
  }

  console.error('Usage: carina enterprise <status|tiers|offer> [--json]');
  process.exit(1);
}
