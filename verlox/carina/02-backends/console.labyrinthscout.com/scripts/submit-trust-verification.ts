import 'dotenv/config';
import { initDb } from '../src/db.js';
import { runWeeklyVerification } from '../src/trust/erc8126/run-weekly-verification.js';

async function main(): Promise<void> {
  await initDb();
  const result = await runWeeklyVerification();

  if (result.ok) {
    console.log('ERC-8126 verification submitted.');
    console.log('unified risk score:', result.unifiedRiskScore);
    console.log('request tx:', result.requestTxHash);
    console.log('response tx:', result.responseTxHash);
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
