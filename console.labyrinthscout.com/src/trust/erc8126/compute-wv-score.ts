import {
  createPublicClient,
  http,
  type Address,
} from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { pool } from '../../db.js';
import { config } from '../../config/index.js';
import { DEFAULT_TRUST_CHAIN_ID } from '../chain-config.js';
import type { VerificationScoreResult } from './verification-types.js';

export interface WalletChainReader {
  getTransactionCount(input: { address: Address }): Promise<number>;
  getBalance(input: { address: Address }): Promise<bigint>;
}

export interface WvScoreInput {
  walletAddress: string;
  chainId?: number;
  publicClient?: WalletChainReader;
}

function resolveChain(chainId: number) {
  return chainId === 8453 ? base : baseSepolia;
}

function createDefaultPublicClient(chainId: number): WalletChainReader {
  const chain = resolveChain(chainId);
  return createPublicClient({
    chain,
    transport: http(config.trust.chainRpc || undefined),
  }) as unknown as WalletChainReader;
}

async function loadWalletThreatSignals(walletAddress: string): Promise<{
  suspiciousEvents30d: number;
  egressBlocks30d: number;
}> {
  const normalized = walletAddress.toLowerCase();
  const result = await pool.query<{
    suspicious_events_30d: string;
    egress_blocks_30d: string;
  }>(
    `SELECT
       COUNT(*) FILTER (
         WHERE created_at > NOW() - INTERVAL '30 days'
           AND (
             description ILIKE '%malicious%'
             OR description ILIKE '%threat%'
             OR metadata::text ILIKE '%' || $1 || '%'
           )
       )::text AS suspicious_events_30d,
       COUNT(*) FILTER (
         WHERE created_at > NOW() - INTERVAL '30 days'
           AND event_type ~ 'egress'
       )::text AS egress_blocks_30d
     FROM security_events`,
    [normalized],
  );

  const row = result.rows[0];
  return {
    suspiciousEvents30d: parseInt(row?.suspicious_events_30d ?? '0', 10),
    egressBlocks30d: parseInt(row?.egress_blocks_30d ?? '0', 10),
  };
}

export async function computeWvRiskScore(input: WvScoreInput): Promise<VerificationScoreResult> {
  const wallet = input.walletAddress?.trim();
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return {
      applicable: false,
      risk_score: 100,
      notes: 'No valid wallet address for WV',
      checks: { walletConfigured: false },
    };
  }

  const chainId = input.chainId ?? config.trust.chainId ?? DEFAULT_TRUST_CHAIN_ID;
  const client = input.publicClient ?? createDefaultPublicClient(chainId);
  const address = wallet as Address;

  const [txCount, balance, threats] = await Promise.all([
    client.getTransactionCount({ address }),
    client.getBalance({ address }),
    loadWalletThreatSignals(wallet),
  ]);

  let risk = 15;

  if (txCount === 0) {
    risk += 35;
  } else if (txCount < 5) {
    risk += 15;
  }

  if (balance === 0n) {
    risk += 10;
  }

  risk += threats.suspiciousEvents30d * 20;
  risk += Math.min(15, threats.egressBlocks30d * 3);

  const riskScore = Math.min(100, Math.max(0, Math.round(risk)));
  const notes = txCount > 0
    ? `Wallet has on-chain history (${txCount} txs). Threat signals: ${threats.suspiciousEvents30d}.`
    : 'Wallet has no on-chain transaction history.';

  return {
    applicable: true,
    risk_score: riskScore,
    notes,
    checks: {
      walletAddress: wallet,
      transactionCount: Number(txCount),
      balanceWei: balance.toString(),
      suspiciousEvents30d: threats.suspiciousEvents30d,
      egressBlocks30d: threats.egressBlocks30d,
    },
  };
}
