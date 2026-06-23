export * from './sso.js';
export * from './audit.js';
export * from './residency.js';
export * from './dr.js';
export * from './zero-trust.js';
export * from './soc2-packager.js';
export * from './types.js';

import { getDrStatus } from './dr.js';
import { buildResidencyStatus } from './residency.js';
import { describeEnterpriseSsoStatus } from './sso.js';
import { describeZeroTrustStatus } from './zero-trust.js';
import { immutableEnterpriseAudit } from './audit.js';

export async function buildEnterpriseSecurityStatus(): Promise<{
  sso: ReturnType<typeof describeEnterpriseSsoStatus>;
  audit: Awaited<ReturnType<typeof immutableEnterpriseAudit.verifyChain>>;
  residency: ReturnType<typeof buildResidencyStatus>;
  dr: Awaited<ReturnType<typeof getDrStatus>>;
  zeroTrust: ReturnType<typeof describeZeroTrustStatus>;
}> {
  const [audit, dr] = await Promise.all([
    immutableEnterpriseAudit.verifyChain(),
    getDrStatus(),
  ]);
  return {
    sso: describeEnterpriseSsoStatus(),
    audit,
    residency: buildResidencyStatus(),
    dr,
    zeroTrust: describeZeroTrustStatus(),
  };
}
