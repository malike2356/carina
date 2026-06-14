import type { GovernancePosture } from './build-governance-posture.js';

function pdfEscape(text: string): string {
  return text.replace(/[()\\]/g, (ch) => (ch === '(' ? '\\(' : ch === ')' ? '\\)' : '\\\\'));
}

export function generateGovernancePdf(posture: GovernancePosture, meta: {
  scoutVersion: string;
  accountLabel: string;
}): Buffer {
  const dateStr = posture.generated_at.slice(0, 10);
  const primaryGap = posture.action_items[0]?.label
    ?? posture.eu_ai_act.gaps[0]
    ?? 'None identified';

  const sections: string[] = [
    `Executive Summary: Governance score ${posture.governance_score}/100 (${posture.governance_label}).`,
    `EU AI Act classification: ${posture.eu_ai_act.tier_label}.`,
    `Primary gap: ${primaryGap}.`,
    '',
    `Regulatory Classification: EU AI Act ${posture.eu_ai_act.tier_label}. UK DSIT ${posture.uk_dsit.alignment_label}.`,
    `Reasoning: ${posture.eu_ai_act.reasoning.slice(0, 2).join('; ')}`,
    '',
    'Framework Alignment:',
    `EU AI Act readiness: ${posture.frameworks.eu_ai_act_readiness}%`,
    `GDPR readiness: ${posture.frameworks.gdpr_readiness}%`,
    `SOC2 readiness: ${posture.frameworks.soc2_readiness}%`,
    `ISO 42001 readiness: ${posture.frameworks.iso42001_readiness}%`,
    '',
    'Agent Governance Summary:',
    `Total agents: ${posture.agents.total}`,
    `Governed: ${posture.agents.governed}`,
    `Identified on-chain: ${posture.agents.identified}`,
    `Compliant: ${posture.agents.compliant}`,
    '',
    'Human Oversight Status:',
    `Override enabled: ${posture.human_oversight.enabled ? 'YES' : 'NO'}`,
    `Last exercised: ${posture.human_oversight.last_exercised ?? 'Never'}`,
    `Approval workflow active: ${posture.human_oversight.approval_workflow_active ? 'YES' : 'NO'}`,
    '',
    'Active Governance Template:',
    posture.active_industry_template
      ? `${posture.active_industry_template.label} (${posture.active_industry_template.sector})`
      : 'None applied',
    posture.active_industry_template
      ? `Regulations: ${posture.active_industry_template.regulations.slice(0, 3).join(', ')}`
      : '',
    '',
    'Attestation History:',
    ...posture.attestations.slice(0, 3).map((row) =>
      `${row.attested_at.slice(0, 10)} | ${row.chain} | ${row.tx_hash?.slice(0, 16) ?? 'n/a'} | score ${row.risk_score_at_attestation ?? '-'}`,
    ),
    '',
    'Recommended Actions:',
    ...posture.action_items.slice(0, 3).map((item) => `[${item.priority}] ${item.label} (${item.framework} ${item.article})`),
    '',
    `Report generated: ${posture.generated_at}`,
    `Scout version: ${meta.scoutVersion}`,
    `Account: ${meta.accountLabel}`,
  ];

  const lines: string[] = [];
  lines.push('%PDF-1.4');
  lines.push('1 0 obj');
  lines.push('<< /Type /Catalog /Pages 2 0 R >>');
  lines.push('endobj');
  lines.push('2 0 obj');
  lines.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  lines.push('endobj');

  const contentLines: string[] = [];
  contentLines.push('BT');
  contentLines.push('/F1 10 Tf');
  contentLines.push('72 750 Td');
  contentLines.push(`(Labyrinth Scout Governance Board Report - ${dateStr}) Tj`);
  contentLines.push('0 -18 Td');
  contentLines.push('/F1 8 Tf');

  for (const section of sections) {
    const wrapped = section.length > 90 ? section.slice(0, 90) : section;
    contentLines.push(`(${pdfEscape(wrapped)}) Tj`);
    contentLines.push('0 -12 Td');
  }

  contentLines.push('ET');
  const contentStream = contentLines.join('\n');

  lines.push('3 0 obj');
  lines.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]');
  lines.push('   /Contents 4 0 R');
  lines.push('   /Resources << /Font << /F1 5 0 R >> >>');
  lines.push('>>');
  lines.push('endobj');
  lines.push('4 0 obj');
  lines.push(`<< /Length ${contentStream.length} >>`);
  lines.push('stream');
  lines.push(contentStream);
  lines.push('endstream');
  lines.push('endobj');
  lines.push('5 0 obj');
  lines.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  lines.push('endobj');

  const body = lines.join('\n');
  const xrefOffset = body.length + 1;
  lines.push('xref');
  lines.push('0 6');
  lines.push('0000000000 65535 f ');
  lines.push('0000000009 00000 n ');
  lines.push('0000000058 00000 n ');
  lines.push('0000000115 00000 n ');
  lines.push('0000000260 00000 n ');
  lines.push('0000000400 00000 n ');
  lines.push('trailer');
  lines.push('<< /Size 6 /Root 1 0 R >>');
  lines.push('startxref');
  lines.push(String(xrefOffset));
  lines.push('%%EOF');

  return Buffer.from(lines.join('\n'), 'utf8');
}

export function buildReportSections(posture: GovernancePosture): string[] {
  const primaryGap = posture.action_items[0]?.label ?? posture.eu_ai_act.gaps[0] ?? 'None';
  return [
    `Governance score ${posture.governance_score}/100 (${posture.governance_label}). EU AI Act: ${posture.eu_ai_act.tier_label}. Primary gap: ${primaryGap}.`,
    `EU AI Act ${posture.eu_ai_act.tier_label}; UK DSIT ${posture.uk_dsit.alignment_label}.`,
    `Frameworks: EU ${posture.frameworks.eu_ai_act_readiness}%, GDPR ${posture.frameworks.gdpr_readiness}%, SOC2 ${posture.frameworks.soc2_readiness}%, ISO ${posture.frameworks.iso42001_readiness}%.`,
    `Agents: ${posture.agents.governed}/${posture.agents.total} governed; ${posture.agents.compliant} compliant.`,
    `Human oversight: ${posture.human_oversight.enabled ? 'enabled' : 'disabled'}.`,
    `Top actions: ${posture.action_items.slice(0, 3).map((a) => a.label).join('; ') || 'None'}.`,
  ];
}
