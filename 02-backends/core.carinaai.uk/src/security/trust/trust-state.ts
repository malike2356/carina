export {
  buildSecurityTrustState,
  formatTrustStateSummary,
  type SecurityTrustState,
} from '../trust-state.js';

import { buildSecurityTrustState as buildBaseTrustState } from '../trust-state.js';
import { buildErc8004IdentityState } from './onchain/identity.js';
import { buildErc8126VerificationState } from './onchain/verification.js';
import { getPolicyVersionState } from '../scout/policy-tracker.js';

export type ExtendedSecurityTrustState = Awaited<ReturnType<typeof buildBaseTrustState>> & {
  identity: ReturnType<typeof buildErc8004IdentityState>;
  verification: ReturnType<typeof buildErc8126VerificationState>;
  policyVersion: ReturnType<typeof getPolicyVersionState>;
};

export async function buildExtendedSecurityTrustState(): Promise<ExtendedSecurityTrustState> {
  const base = await buildBaseTrustState();
  const identity = buildErc8004IdentityState();
  const verification = buildErc8126VerificationState();
  const policyVersion = getPolicyVersionState();

  const notes = [...base.notes];
  if (!verification.hashMatch) {
    notes.push('Code integrity hash mismatch; ERC-8126 verification would fail.');
  }
  if (!identity.registered) {
    notes.push('ERC-8004 agent identity not registered for this instance.');
  }

  return {
    ...base,
    notes,
    identity,
    verification,
    policyVersion,
  };
}
