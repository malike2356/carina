import type { ScoutFinding } from './scout-findings-types.js';

const TOOL_SUGGESTIONS: Record<string, string[]> = {
  cve: ['nuclei', 'security audit', 'carina security trust'],
  open_port: ['nmap', 'attack surface review', 'egress filter check'],
  subdomain: ['amass', 'recon workflow', 'dns review'],
  misconfig: ['security audit', 'policy review', 'config snapshot'],
  vulnerability: ['nuclei', 'penetration test suite', 'sandbox validation'],
  injection: ['prompt guard review', 'security events', 'incident timeline'],
};

const SCAN_TOOL_SUGGESTIONS: Record<string, string[]> = {
  nuclei: ['nuclei targeted validation', 'CVE cross-check'],
  nmap: ['service fingerprint', 'port justification review'],
  nikto: ['web hardening checklist', 'remediation draft'],
  wpscan: ['wordpress patch plan', 'access review'],
  amass: ['subdomain ownership verify', 'dns hardening'],
};

export function suggestToolsForFinding(finding: ScoutFinding): string[] {
  const suggestions = new Set<string>();

  for (const tool of TOOL_SUGGESTIONS[finding.findingType] ?? []) {
    suggestions.add(tool);
  }

  for (const tool of SCAN_TOOL_SUGGESTIONS[finding.tool] ?? []) {
    suggestions.add(tool);
  }

  if (finding.severity === 'critical' || finding.severity === 'high') {
    suggestions.add('open investigation case');
    suggestions.add('export evidence package');
  }

  if (finding.remediation) {
    suggestions.add('draft remediation plan');
  }

  if (suggestions.size === 0) {
    suggestions.add('review finding in Scout dashboard');
    suggestions.add('correlate with security events');
  }

  return [...suggestions];
}

export function formatInvestigationBrief(finding: ScoutFinding, tools: string[]): string {
  const lines = [
    `Finding: ${finding.title}`,
    `Severity: ${finding.severity}${finding.cvssScore !== null ? ` (CVSS ${finding.cvssScore})` : ''}`,
    `Type: ${finding.findingType} via ${finding.tool}`,
    `Target: ${finding.targetId}`,
    `Status: ${finding.status}`,
  ];

  if (finding.description) lines.push(`Description: ${finding.description}`);
  if (finding.remediation) lines.push(`Remediation: ${finding.remediation}`);
  lines.push('', 'Suggested next steps:');
  for (const tool of tools) {
    lines.push(`  - ${tool}`);
  }

  return lines.join('\n');
}
