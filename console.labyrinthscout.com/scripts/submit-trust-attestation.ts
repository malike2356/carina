import 'dotenv/config';
import { initDb } from '../src/db.js';
import { runWeeklyAttestation } from '../src/trust/run-weekly-attestation.js';

async function main(): Promise<void> {
  await initDb();
  const result = await runWeeklyAttestation();

  if (result.ok) {
    console.log('Attestation submitted.');
    console.log('tx:', result.txHash);
    if (result.explorerUrl) console.log('explorer:', result.explorerUrl);
    process.exit(0);
  }

  if (result.skipped) {
    console.log('Skipped:', result.reason);
    process.exit(0);
  }

  console.error('Failed:', result.reason);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
