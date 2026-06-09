#!/usr/bin/env tsx
import { registerReferenceAgentOnErc8004 } from '../src/trust/register-erc8004.js';
import { initDb } from '../src/db.js';

async function main() {
  await initDb();
  const result = await registerReferenceAgentOnErc8004();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok || result.skipped ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
