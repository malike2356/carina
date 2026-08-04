import { pool } from '../db.js';
import { explorerAddressUrl, explorerTxUrl } from './chain-config.js';

export interface TrustIdentityRow {
  slug: string;
  name: string;
  agent_uri: string;
  chain_id: number;
  registry_address: string;
  agent_id: string | null;
  wallet_address: string | null;
  register_tx_hash: string | null;
  status: 'pending' | 'registering' | 'live' | 'failed';
  registered_at: Date | null;
}

export interface PublicTrustIdentity {
  registered: boolean;
  slug: string | null;
  name: string | null;
  agent_id: string | null;
  agent_registry: string | null;
  wallet_address: string | null;
  registry_explorer_url: string | null;
  register_tx_url: string | null;
  status: string | null;
}

export async function loadReferenceTrustIdentity(
  slug = 'carina-reference',
): Promise<PublicTrustIdentity | null> {
  const result = await pool.query<TrustIdentityRow>(
    `SELECT slug, name, agent_uri, chain_id, registry_address,
            agent_id, wallet_address, register_tx_hash, status, registered_at
     FROM trust_identities
     WHERE slug = $1
     LIMIT 1`,
    [slug],
  );

  const row = result.rows[0];
  if (!row) return null;

  const registered = row.status === 'live' && row.agent_id !== null;

  return {
    registered,
    slug: row.slug,
    name: row.name,
    agent_id: row.agent_id,
    agent_registry: registered
      ? `eip155:${row.chain_id}:${row.registry_address}`
      : null,
    wallet_address: row.wallet_address,
    registry_explorer_url: explorerAddressUrl(row.chain_id, row.registry_address),
    register_tx_url: row.register_tx_hash
      ? explorerTxUrl(row.chain_id, row.register_tx_hash)
      : null,
    status: row.status,
  };
}

export async function ensureReferenceIdentityRow(
  slug: string,
  name: string,
  agentUri: string,
  chainId: number,
  registryAddress: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO trust_identities (
       slug, name, agent_uri, chain_id, registry_address, status
     ) VALUES ($1, $2, $3, $4, $5, 'pending')
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       agent_uri = EXCLUDED.agent_uri,
       chain_id = EXCLUDED.chain_id,
       registry_address = EXCLUDED.registry_address,
       status = CASE
         WHEN trust_identities.status = 'live' THEN trust_identities.status
         ELSE EXCLUDED.status
       END,
       updated_at = NOW()`,
    [slug, name, agentUri, chainId, registryAddress],
  );
}
