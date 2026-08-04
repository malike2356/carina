import chalk from 'chalk';
import {
  backfillHostedEmailAddresses,
  hostedEmailOperatorStatus,
} from '../../ingestion/email/hosted-email-address.js';

export async function runAivaEmailAddressesCommand(args: string[] = []): Promise<void> {
  const action = args[0] ?? 'status';
  const json = args.includes('--json');

  if (action === 'backfill') {
    const result = await backfillHostedEmailAddresses();
    if (json) {
      console.log(JSON.stringify(result));
      return;
    }
    console.log(chalk.bold('\nAiva hosted email backfill\n'));
    console.log(`  scanned: ${result.scanned}`);
    console.log(`  created: ${result.created}`);
    console.log(`  skipped: ${result.skipped}`);
    console.log(`  errors:  ${result.errors}`);
    console.log('');
    return;
  }

  if (action === 'status' || action === undefined) {
    const status = hostedEmailOperatorStatus();
    if (json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }
    console.log(chalk.bold('\nAiva hosted email\n'));
    console.log(`  enabled:              ${status.enabled}`);
    console.log(`  domain:               ${status.domain}`);
    console.log(`  provider:             ${status.provider}`);
    console.log(`  inbound secret:       ${status.inboundSecretPresent}`);
    console.log(`  last inbound:         ${status.lastInboundAt ?? 'never'}`);
    console.log(`  accepted:             ${status.acceptedCount}`);
    console.log(`  unknown recipients:   ${status.unknownRecipientCount}`);
    console.log('');
    return;
  }

  console.error('Usage: carina aiva:email-addresses [status|backfill] [--json]');
  process.exit(1);
}
