import { config } from '../config/index.js';
import { DEFAULT_TRUST_CHAIN_ID } from './chain-config.js';
import { LabyrinthScoutAttestationAdapter } from './attestation-adapter.js';
import { fetchAttestationMetricsFromDb } from './attestation-metrics.js';
import { createTrustSdk } from './create-trust-sdk.js';
import { loadReferenceTrustIdentity } from './load-trust-identity.js';
import { getLastAttestationAt, storeTrustAttestation } from './load-trust-attestations.js';
import { resolveEnterpriseIntervals } from '../lib/trust-settings.js';

export interface WeeklyAttestationResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  txHash?: string;
  explorerUrl?: string;
}

function resolveSubjectWallet(
  identityWallet: string | null,
  override?: string,
): string | null {
  if (override) return override;
  return identityWallet;
}

export async function runWeeklyAttestation(
  deps: {
    adapter?: LabyrinthScoutAttestationAdapter;
    now?: Date;
  } = {},
): Promise<WeeklyAttestationResult> {
  if (!config.trust.attestationEnabled) {
    return { ok: false, skipped: true, reason: 'TRUST_ATTESTATION_ENABLED=false' };
  }

  const sdk = deps.adapter ? null : createTrustSdk();
  if (!deps.adapter && !sdk) {
    return { ok: false, skipped: true, reason: 'TRUST_ATTESTER_PRIVATE_KEY not set' };
  }

  const identity = await loadReferenceTrustIdentity();
  if (!identity?.registered || !identity.wallet_address) {
    return { ok: false, skipped: true, reason: 'Reference agent not registered on ERC-8004' };
  }

  const subjectWallet = resolveSubjectWallet(
    identity.wallet_address,
    config.trust.subjectAgentWallet || undefined,
  );
  if (!subjectWallet) {
    return { ok: false, skipped: true, reason: 'No subject agent wallet configured' };
  }

  const now = deps.now ?? new Date();
  const enterprise = await resolveEnterpriseIntervals();
  const intervalDays = Math.min(
    config.trust.attestationIntervalDays,
    enterprise.attestationDays,
  );
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  const lastAt = await getLastAttestationAt(identity.slug ?? 'carina-reference');
  if (lastAt && now.getTime() - lastAt.getTime() < intervalMs) {
    return {
      ok: false,
      skipped: true,
      reason: `Last attestation ${lastAt.toISOString()} is within ${intervalDays}d window`,
    };
  }

  const { fields, eligibility } = await fetchAttestationMetricsFromDb();
  if (!eligibility.eligible) {
    return { ok: false, skipped: true, reason: eligibility.reason };
  }

  const adapter = deps.adapter ?? LabyrinthScoutAttestationAdapter.fromSdk(sdk!);
  const periodKey = now.toISOString().slice(0, 10);

  try {
    const result = await adapter.submitSecurityAttestation({
      toAgentWallet: subjectWallet,
      fields,
      periodKey,
    });

    const chainId = config.trust.chainId ?? DEFAULT_TRUST_CHAIN_ID;
    await storeTrustAttestation({
      identitySlug: identity.slug ?? 'carina-reference',
      namespace: result.namespace,
      tag: result.tag,
      score: result.score,
      txHash: result.txHash,
      chainId,
      metrics: fields,
      comment: result.comment,
      attestationUid: result.txHash,
    });

    const { explorerTxUrl } = await import('./chain-config.js');
    return {
      ok: true,
      txHash: result.txHash,
      explorerUrl: explorerTxUrl(chainId, result.txHash),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: msg };
  }
}
