#!/usr/bin/env tsx
import {
  auditStaleSecrets,
  buildSecretsStatusReport,
  formatSecretsStatus,
  formatStaleAudit,
  shouldBlockStaleSecretsAudit,
} from '../src/security/secrets/index.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const failOn = args.includes('--fail-on=warn') ? 'warn' : 'fail';

  const status = await buildSecretsStatusReport();
  const audit = await auditStaleSecrets();

  if (args.includes('--json')) {
    console.log(JSON.stringify({ status, audit }, null, 2));
  } else {
    console.log(formatSecretsStatus(status));
    console.log('');
    console.log(formatStaleAudit(audit));
  }

  if (shouldBlockStaleSecretsAudit(audit, failOn)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
