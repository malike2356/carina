import fs from 'node:fs/promises';
import { buildSecurityTrustState } from '../trust-state.js';
import { readSecurityAuditTail } from '../security-audit.js';
import type { TrustDataPoint, TrustFramework } from './types.js';
import { governanceRoot, trustHistoryPath } from './paths.js';

async function loadTrustHistory(): Promise<TrustDataPoint[]> {
  try {
    const raw = JSON.parse(await fs.readFile(trustHistoryPath(), 'utf8')) as { history?: TrustDataPoint[] };
    return raw.history ?? [];
  } catch {
    return [];
  }
}

async function appendTrustHistory(score: number): Promise<TrustDataPoint[]> {
  const history = [...(await loadTrustHistory()), { at: new Date().toISOString(), score }].slice(-30);
  await fs.mkdir(governanceRoot(), { recursive: true });
  await fs.writeFile(trustHistoryPath(), JSON.stringify({ history }, null, 2), { mode: 0o600 });
  return history;
}

export async function buildTrustFramework(): Promise<TrustFramework> {
  const trustState = await buildSecurityTrustState();
  const auditTail = readSecurityAuditTail(100);
  const injectionBlocks = auditTail.filter((row) => row.category === 'prompt_injection' && row.action === 'block').length;
  const toolBlocks = auditTail.filter((row) => row.category === 'tool_policy' || row.category === 'tool_rbac').length;

  const promptCompliance = Math.max(0, 100 - injectionBlocks * 5);
  const toolDiscipline = Math.max(0, 100 - toolBlocks * 8);
  const errorRate = trustState.suspended ? 40 : 90;
  const sequenceNormality = trustState.enforcement.toolRbac ? 85 : 60;
  const agentScore = Math.round((promptCompliance + toolDiscipline + errorRate + sequenceNormality) / 4);

  const authStrength = trustState.scoutConfigured ? 85 : 65;
  const sessionHistory = Math.min(100, auditTail.length);
  const actionPatterns = trustState.enforcement.remoteScoutPolicy ? 80 : 55;
  const userScore = Math.round((authStrength + sessionHistory + actionPatterns) / 3);

  let provenanceVerified = false;
  let scannerPassed = true;
  try {
    const { checkProvenance } = await import('../supply-chain/provenance.js');
    const check = await checkProvenance('property-uk');
    provenanceVerified = check.verdict !== 'blocked';
    scannerPassed = check.verdict !== 'blocked';
  } catch {
    scannerPassed = false;
  }

  const skillScore = Math.round(
    (provenanceVerified ? 40 : 0)
    + (scannerPassed ? 40 : 0)
    + 20,
  );

  const history = await appendTrustHistory(agentScore);

  return {
    generatedAt: new Date().toISOString(),
    agentTrust: {
      score: agentScore,
      factors: {
        promptCompliance,
        toolDiscipline,
        errorRate,
        sequenceNormality,
      },
      history,
    },
    userTrust: {
      score: userScore,
      factors: {
        authenticationStrength: authStrength,
        sessionHistory,
        actionPatterns,
      },
    },
    skillTrust: {
      score: skillScore,
      factors: {
        provenanceVerified,
        scannerPassed,
        communityRating: provenanceVerified ? 4.2 : 0,
        installCount: provenanceVerified ? 1 : 0,
      },
    },
  };
}

export function formatTrustFramework(trust: TrustFramework): string {
  return [
    `Agent trust: ${trust.agentTrust.score}/100`,
    `  promptCompliance=${trust.agentTrust.factors.promptCompliance} toolDiscipline=${trust.agentTrust.factors.toolDiscipline}`,
    `User trust: ${trust.userTrust.score}/100`,
    `  authenticationStrength=${trust.userTrust.factors.authenticationStrength}`,
    `Skill trust: ${trust.skillTrust.score}/100`,
    `  provenanceVerified=${trust.skillTrust.factors.provenanceVerified}`,
  ].join('\n');
}
