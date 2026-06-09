#!/usr/bin/env tsx
/**
 * Register the reference Carina agent on ERC-8004 Base mainnet (chain 8453).
 * Requires TRUST_ATTESTER_PRIVATE_KEY and TRUST_CHAIN_RPC for mainnet.
 */
import { registerReferenceAgentOnErc8004 } from '../src/trust/register-erc8004.js';
import { initDb } from '../src/db.js';
import { BASE_MAINNET_CHAIN_ID } from '../src/trust/chain-config.js';

async function main() {
  await initDb();
  const result = await registerReferenceAgentOnErc8004({
    slug: 'carina-reference-mainnet',
    chainId: BASE_MAINNET_CHAIN_ID,
    name: 'Carina AI Agent (Mainnet)',
    agentUri: 'https://core.carinaai.uk/.well-known/agent-card.json',
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok || result.skipped ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
