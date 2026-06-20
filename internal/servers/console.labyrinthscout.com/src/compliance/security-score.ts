import { buildPublicTrustFromDb } from '../trust/build-public-trust.js';

export async function getSecurityScore(): Promise<{ score: number; riskScore: number }> {
  const trust = await buildPublicTrustFromDb();
  const riskScore = trust.risk_score ?? 0;
  const score = Math.max(0, Math.min(100, 100 - riskScore));
  return { score, riskScore };
}
