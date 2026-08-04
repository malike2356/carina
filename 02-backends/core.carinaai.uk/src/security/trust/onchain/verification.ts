import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildErc8004IdentityState, computeCarinaBuildFingerprint } from './identity.js';
import { isScoutMutualIntegrationActive } from '../../scout-mode.js';
import { config } from '../../../config/index.js';

export type Erc8126VerificationState = {
  standard: 'ERC-8126';
  verified: boolean;
  codeHash: string;
  expectedHash: string | null;
  hashMatch: boolean;
  lastVerifiedAt: string | null;
  requestTxHash: string | null;
  responseTxHash: string | null;
  unifiedRiskScore: number;
  unifiedRiskTier: 'low' | 'medium' | 'high' | 'critical';
  status: 'live' | 'pending' | 'failed' | 'unconfigured';
};

function distIntegrityHash(): string | null {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const distEntry = path.resolve(here, '../../../../dist/src/index.js');
    if (!existsSync(distEntry)) return null;
    const content = readFileSync(distEntry);
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}

export function computeCodeIntegrityHash(): string {
  const distHash = distIntegrityHash();
  if (distHash) return distHash;
  return computeCarinaBuildFingerprint();
}

function riskFromVerification(hashMatch: boolean, identityRegistered: boolean): {
  score: number;
  tier: Erc8126VerificationState['unifiedRiskTier'];
} {
  if (!hashMatch) return { score: 85, tier: 'critical' };
  if (!identityRegistered) return { score: 45, tier: 'medium' };
  return { score: 12, tier: 'low' };
}

export function buildErc8126VerificationState(now = new Date()): Erc8126VerificationState {
  const codeHash = computeCodeIntegrityHash();
  const expectedHash = process.env.CARINA_TRUST_CODE_HASH?.trim() || null;
  const hashMatch = expectedHash ? codeHash === expectedHash : true;
  const identity = buildErc8004IdentityState();
  const risk = riskFromVerification(hashMatch, identity.registered);

  let status: Erc8126VerificationState['status'] = 'pending';
  if (!isScoutMutualIntegrationActive()) status = 'unconfigured';
  else if (!hashMatch) status = 'failed';
  else if (identity.registered) status = 'live';

  return {
    standard: 'ERC-8126',
    verified: hashMatch && identity.registered,
    codeHash,
    expectedHash,
    hashMatch,
    lastVerifiedAt: process.env.CARINA_TRUST_LAST_VERIFIED_AT ?? now.toISOString(),
    requestTxHash: process.env.CARINA_TRUST_VERIFY_REQUEST_TX?.trim() || null,
    responseTxHash: process.env.CARINA_TRUST_VERIFY_RESPONSE_TX?.trim() || null,
    unifiedRiskScore: risk.score,
    unifiedRiskTier: risk.tier,
    status,
  };
}

export async function requestScoutReverification(reason: string): Promise<{ ok: boolean; detail?: string }> {
  if (!isScoutMutualIntegrationActive()) {
    return { ok: false, detail: 'Scout integration disabled' };
  }

  const { reportEvent } = await import('../../scout-client.js');
  const verification = buildErc8126VerificationState();
  await reportEvent({
    severity: verification.hashMatch ? 'info' : 'critical',
    source: 'carina-core',
    event_type: 'trust_reverification_requested',
    description: reason,
    instance_id: config.labyrinth.instanceId,
    metadata: {
      codeHash: verification.codeHash,
      hashMatch: verification.hashMatch,
      identityRegistered: buildErc8004IdentityState().registered,
    },
  });
  return { ok: true };
}
