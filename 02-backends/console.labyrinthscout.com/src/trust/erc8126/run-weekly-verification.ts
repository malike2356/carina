import { config } from '../../config/index.js';
import { DEFAULT_TRUST_CHAIN_ID } from '../chain-config.js';
import { loadReferenceTrustIdentity } from '../load-trust-identity.js';
import { computeWavRiskScore } from './compute-wav-score.js';
import { computeWvRiskScore } from './compute-wv-score.js';
import {
  getLastVerificationAt,
  storeTrustVerification,
} from './load-verifications.js';
import {
  buildVerificationPayload,
  trustResponseFromRisk,
} from './verification-types.js';
import {
  createValidationRegistryClients,
  submitValidationRequest,
  submitValidationResponse,
} from './validation-registry.js';
import { resolveEnterpriseIntervals } from '../../lib/trust-settings.js';

export interface WeeklyVerificationResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  unifiedRiskScore?: number;
  requestTxHash?: string;
  responseTxHash?: string;
}

function resolveSubjectWallet(
  identityWallet: string | null,
  override?: string,
): string | null {
  if (override) return override;
  return identityWallet;
}

export async function runWeeklyVerification(
  deps: {
    now?: Date;
    wavScoreFn?: typeof computeWavRiskScore;
    wvScoreFn?: typeof computeWvRiskScore;
  } = {},
): Promise<WeeklyVerificationResult> {
  if (!config.trust.verificationEnabled) {
    return { ok: false, skipped: true, reason: 'TRUST_VERIFICATION_ENABLED=false' };
  }

  const clients = createValidationRegistryClients();
  if (!clients) {
    return { ok: false, skipped: true, reason: 'TRUST_ATTESTER_PRIVATE_KEY not set' };
  }

  const identity = await loadReferenceTrustIdentity();
  if (!identity?.registered || !identity.agent_id) {
    return { ok: false, skipped: true, reason: 'Reference agent not registered on ERC-8004' };
  }

  const subjectWallet = resolveSubjectWallet(
    identity.wallet_address,
    config.trust.subjectAgentWallet || undefined,
  );
  if (!subjectWallet) {
    return { ok: false, skipped: true, reason: 'No subject wallet configured for WV' };
  }

  const now = deps.now ?? new Date();
  const enterprise = await resolveEnterpriseIntervals();
  const intervalDays = Math.min(
    config.trust.verificationIntervalDays,
    enterprise.verificationDays,
  );
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  const lastAt = await getLastVerificationAt(identity.slug ?? 'carina-reference');
  if (lastAt && now.getTime() - lastAt.getTime() < intervalMs) {
    return {
      ok: false,
      skipped: true,
      reason: `Last verification ${lastAt.toISOString()} is within ${intervalDays}d window`,
    };
  }

  const wavFn = deps.wavScoreFn ?? computeWavRiskScore;
  const wvFn = deps.wvScoreFn ?? computeWvRiskScore;

  try {
    const [wav, wv] = await Promise.all([
      wavFn(),
      wvFn({ walletAddress: subjectWallet, chainId: clients.chainId }),
    ]);

    const payload = buildVerificationPayload(identity.agent_id, { wav, wv }, now);
    const requestBody = JSON.stringify(payload);
    const responseBody = JSON.stringify({
      ...payload,
      validator: clients.validatorAddress,
      trustResponseScore: trustResponseFromRisk(payload.unifiedRiskScore),
    });

    const agentId = BigInt(identity.agent_id);
    const request = await submitValidationRequest(clients, agentId, requestBody);
    const responseTxHash = await submitValidationResponse(
      clients,
      request.requestHash,
      trustResponseFromRisk(payload.unifiedRiskScore),
      responseBody,
    );

    await storeTrustVerification({
      identitySlug: identity.slug ?? 'carina-reference',
      agentId: identity.agent_id,
      chainId: clients.chainId ?? config.trust.chainId ?? DEFAULT_TRUST_CHAIN_ID,
      wavRiskScore: wav.risk_score,
      wvRiskScore: wv.risk_score,
      unifiedRiskScore: payload.unifiedRiskScore,
      trustResponseScore: trustResponseFromRisk(payload.unifiedRiskScore),
      requestHash: request.requestHash,
      requestTxHash: request.txHash,
      responseTxHash,
      responseUri: request.requestUri,
      details: { scores: { wav, wv }, payload },
    });

    return {
      ok: true,
      unifiedRiskScore: payload.unifiedRiskScore,
      requestTxHash: request.txHash,
      responseTxHash,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: msg };
  }
}
