import { runSecurityAudit, type SecurityAuditReport } from '../ops/security-audit.js';
import { buildSecurityTrustState, type SecurityTrustState } from './trust-state.js';
import { readSecurityAuditTail, type SecurityAuditEvent } from './security-audit.js';

export type TrustComplianceReport = {
  generatedAt: string;
  executiveSummary: string;
  posture: SecurityAuditReport;
  trust: SecurityTrustState;
  injectionBlocks: SecurityAuditEvent[];
  totals: {
    postureOk: number;
    postureWarn: number;
    postureFail: number;
    injectionBlocksRecorded: number;
  };
  recommendations: string[];
  partialBehavior: string[];
};

function buildRecommendations(
  posture: SecurityAuditReport,
  trust: SecurityTrustState,
  injectionBlocks: SecurityAuditEvent[],
): string[] {
  const recs: string[] = [];
  for (const check of posture.checks) {
    if (check.severity === 'fail') {
      recs.push(`Resolve failed check: ${check.name} (${check.detail})`);
    }
  }
  if (!trust.labyrinthEnabled) {
    recs.push('Enable LABYRINTH_ENABLED=true and configure Scout for remote attestation and alert delivery.');
  } else if (!trust.enforcement.remoteScoutPolicy) {
    recs.push('Restore Scout connectivity so policy evaluate and critical attestation use remote enforcement.');
  }
  if (injectionBlocks.length === 0) {
    recs.push('No local injection blocks recorded yet; validate prompt guard with a test block before production rollout.');
  }
  if (trust.suspended) {
    recs.push('Instance is suspended; review Scout kill-switch events before resuming agent traffic.');
  }
  return recs.slice(0, 8);
}

function buildPartialBehavior(trust: SecurityTrustState): string[] {
  const notes = [...trust.notes];
  if (trust.availability.scoutPolicyEvaluate === 'fallback') {
    notes.push('Scout policy evaluate is in local fallback mode.');
  }
  if (trust.availability.criticalEventAttestation === 'unavailable') {
    notes.push('Critical event attestation is unavailable until Scout is reachable.');
  }
  return notes;
}

export async function buildTrustComplianceReport(): Promise<TrustComplianceReport> {
  const [posture, trust] = await Promise.all([
    runSecurityAudit(),
    buildSecurityTrustState(),
  ]);
  const auditTail = readSecurityAuditTail(300);
  const injectionBlocks = auditTail.filter(
    (row) => row.category === 'prompt_injection' && row.action === 'block',
  );

  const totals = {
    postureOk: posture.summary.ok,
    postureWarn: posture.summary.warn,
    postureFail: posture.summary.fail,
    injectionBlocksRecorded: injectionBlocks.length,
  };

  const partialBehavior = buildPartialBehavior(trust);
  const executiveSummary = [
    `Generated ${new Date().toISOString()}.`,
    `Posture: ${totals.postureOk} ok, ${totals.postureWarn} warn, ${totals.postureFail} fail.`,
    `Local injection blocks recorded: ${totals.injectionBlocksRecorded}.`,
    trust.labyrinthEnabled
      ? (trust.enforcement.remoteScoutPolicy ? 'Scout is connected.' : 'Scout is configured but unreachable (local fallback active).')
      : 'Scout is disabled; local prompt guard and audit still apply when enabled.',
  ].join(' ');

  return {
    generatedAt: new Date().toISOString(),
    executiveSummary,
    posture,
    trust,
    injectionBlocks: injectionBlocks.slice(-25),
    totals,
    recommendations: buildRecommendations(posture, trust, injectionBlocks),
    partialBehavior,
  };
}

export function formatTrustComplianceMarkdown(report: TrustComplianceReport): string {
  const lines: string[] = [
    '# Carina Security and Compliance Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Executive summary',
    '',
    report.executiveSummary,
    '',
    '## Posture checks',
    '',
  ];

  for (const check of report.posture.checks) {
    lines.push(`- [${check.severity.toUpperCase()}] ${check.name}: ${check.detail}`);
  }

  lines.push('', '## Trust state', '');
  lines.push(`- Scout: ${report.trust.labyrinthEnabled ? (report.trust.enforcement.remoteScoutPolicy ? 'connected' : 'fallback') : 'disabled'}`);
  lines.push(`- Suspended: ${report.trust.suspended}`);
  lines.push(`- Sandbox policy: ${report.trust.sandboxPolicyMode}`);
  lines.push(`- Policy evaluate: ${report.trust.availability.scoutPolicyEvaluate}`);
  lines.push(`- Critical attestation: ${report.trust.availability.criticalEventAttestation}`);

  if (report.partialBehavior.length > 0) {
    lines.push('', '## Partial or fallback behavior', '');
    for (const note of report.partialBehavior) {
      lines.push(`- ${note}`);
    }
  }

  lines.push('', '## Recent prompt injection blocks', '');
  if (report.injectionBlocks.length === 0) {
    lines.push('- None recorded in local audit log.');
  } else {
    for (const row of report.injectionBlocks) {
      const ref = row.metadata?.shield_ref ? ` ref=${String(row.metadata.shield_ref)}` : '';
      const patterns = Array.isArray(row.metadata?.patterns)
        ? ` patterns=${(row.metadata.patterns as string[]).join(',')}`
        : '';
      lines.push(`- ${row.at}${ref}${patterns}: ${row.detail}`);
    }
  }

  if (report.recommendations.length > 0) {
    lines.push('', '## Recommendations', '');
    for (const rec of report.recommendations) {
      lines.push(`- ${rec}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
