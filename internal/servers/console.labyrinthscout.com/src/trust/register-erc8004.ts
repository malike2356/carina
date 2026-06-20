import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { pool } from '../db.js';
import { config } from '../config/index.js';
import {
  DEFAULT_TRUST_CHAIN_ID,
  ERC8004_IDENTITY_REGISTRY,
  IDENTITY_REGISTRY_ABI,
  explorerTxUrl,
} from './chain-config.js';
import { ensureReferenceIdentityRow } from './load-trust-identity.js';

export interface RegisterErc8004Input {
  slug?: string;
  name?: string;
  agentUri?: string;
  chainId?: number;
}

export interface RegisterErc8004Result {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  agentId?: string;
  txHash?: string;
  explorerUrl?: string;
}

function resolveChain(chainId: number) {
  return chainId === 8453 ? base : baseSepolia;
}

function normalizePrivateKey(raw: string): Hex {
  const trimmed = raw.trim();
  return (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as Hex;
}

const ERC721_TRANSFER_ABI = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
    ],
  },
] as const;

function parseAgentIdFromReceipt(
  logs: Parameters<typeof parseEventLogs>[0]['logs'],
): string | null {
  const events = parseEventLogs({ abi: ERC721_TRANSFER_ABI, logs });
  const mint = events.find(
    (e) => e.eventName === 'Transfer' && e.args.from === '0x0000000000000000000000000000000000000000',
  );
  return mint?.args.tokenId !== undefined ? String(mint.args.tokenId) : null;
}

export async function registerReferenceAgentOnErc8004(
  input: RegisterErc8004Input = {},
): Promise<RegisterErc8004Result> {
  const privateKey = config.trust.attesterPrivateKey;
  if (!privateKey) {
    return { ok: false, skipped: true, reason: 'TRUST_ATTESTER_PRIVATE_KEY not set' };
  }

  const slug = input.slug ?? 'carina-reference';
  const existing = await pool.query<{ status: string; agent_id: string | null; register_tx_hash: string | null }>(
    `SELECT status, agent_id, register_tx_hash FROM trust_identities WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  if (existing.rows[0]?.status === 'live' && existing.rows[0].agent_id) {
    return {
      ok: true,
      skipped: true,
      reason: 'Already registered',
      agentId: existing.rows[0].agent_id,
      txHash: existing.rows[0].register_tx_hash ?? undefined,
    };
  }

  const chainId = input.chainId ?? config.trust.chainId ?? DEFAULT_TRUST_CHAIN_ID;
  const registry = (config.trust.erc8004Registry || ERC8004_IDENTITY_REGISTRY[chainId]) as Address;
  const name = input.name ?? 'Carina AI Agent';
  const agentUri = input.agentUri ?? 'https://core.carinaai.uk/.well-known/agent-card.json';

  await ensureReferenceIdentityRow(slug, name, agentUri, chainId, registry);

  await pool.query(
    `UPDATE trust_identities SET status = 'registering', updated_at = NOW() WHERE slug = $1`,
    [slug],
  );

  const account = privateKeyToAccount(normalizePrivateKey(privateKey));
  const chain = resolveChain(chainId);
  const transport = http(config.trust.chainRpc || undefined);

  const walletClient = createWalletClient({ account, chain, transport });
  const publicClient = createPublicClient({ chain, transport });

  try {
    const txHash = await walletClient.writeContract({
      address: registry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'register',
      args: [agentUri],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      await pool.query(
        `UPDATE trust_identities SET status = 'failed', updated_at = NOW() WHERE slug = $1`,
        [slug],
      );
      return { ok: false, reason: `Transaction reverted: ${txHash}` };
    }

    const agentId = parseAgentIdFromReceipt(receipt.logs) ?? 'unknown';

    await pool.query(
      `UPDATE trust_identities SET
         status = 'live',
         agent_id = $2,
         wallet_address = $3,
         register_tx_hash = $4,
         registered_at = NOW(),
         updated_at = NOW()
       WHERE slug = $1`,
      [slug, agentId, account.address, txHash],
    );

    return {
      ok: true,
      agentId,
      txHash,
      explorerUrl: explorerTxUrl(chainId, txHash),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await pool.query(
      `UPDATE trust_identities SET status = 'failed', updated_at = NOW() WHERE slug = $1`,
      [slug],
    );
    return { ok: false, reason: msg };
  }
}
