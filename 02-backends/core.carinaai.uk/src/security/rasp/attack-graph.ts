import type { AttackNode, RASPSignal } from './types.js';

const MITRE_BY_SOURCE: Partial<Record<RASPSignal['source'], string>> = {
  prompt_guard: 'Initial Access',
  tool_sequence: 'Execution',
  egress_filter: 'Exfiltration',
  honeypot: 'Credential Access',
  trust_state: 'Defense Evasion',
  anomaly: 'Discovery',
};

export class AttackGraphBuilder {
  build(signals: RASPSignal[]): AttackNode[] {
    const sorted = [...signals].sort((a, b) => a.timestamp - b.timestamp);
    const nodes: AttackNode[] = sorted.map((signal, index) => ({
      id: signal.id ?? `${signal.source}-${signal.timestamp}-${index}`,
      label: signal.type,
      source: signal.source,
      severity: signal.severity,
      timestamp: signal.timestamp,
      mitreTactic: MITRE_BY_SOURCE[signal.source],
      next: index < sorted.length - 1
        ? [sorted[index + 1]!.id ?? `${sorted[index + 1]!.source}-${sorted[index + 1]!.timestamp}-${index + 1}`]
        : undefined,
    }));
    return nodes;
  }
}

export function classifyAttack(
  signals: RASPSignal[],
  graph: AttackNode[],
): { attackType: string | null; mitreTactic: string | null } {
  const sources = new Set(signals.map((row) => row.source));
  if (sources.has('prompt_guard') && sources.has('tool_sequence')) {
    return { attackType: 'prompt_injection_chain', mitreTactic: 'Execution' };
  }
  if (sources.has('egress_filter') && (sources.has('honeypot') || sources.has('tool_sequence'))) {
    return { attackType: 'data_exfiltration_attempt', mitreTactic: 'Exfiltration' };
  }
  if (sources.has('tool_sequence') && sources.has('egress_filter')) {
    return { attackType: 'tool_abuse_with_exfil', mitreTactic: 'Exfiltration' };
  }
  if (sources.has('honeypot')) {
    return { attackType: 'decoy_credential_access', mitreTactic: 'Credential Access' };
  }
  if (sources.has('prompt_guard')) {
    return { attackType: 'prompt_injection', mitreTactic: 'Initial Access' };
  }
  if (sources.has('tool_sequence')) {
    return { attackType: 'malicious_tool_sequence', mitreTactic: 'Execution' };
  }
  if (graph.length > 0) {
    return {
      attackType: graph[0]?.label ?? null,
      mitreTactic: graph[graph.length - 1]?.mitreTactic ?? null,
    };
  }
  return { attackType: null, mitreTactic: null };
}

export const attackGraphBuilder = new AttackGraphBuilder();
