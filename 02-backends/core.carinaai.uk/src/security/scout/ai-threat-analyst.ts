import { randomUUID } from 'crypto';
import { config } from '../../config/index.js';
import { reportScoutSignal } from '../scout-client.js';
import { isScoutAgenticLayerEnabled } from './scout-agentic-guard.js';
import {
  fetchEventsForCorrelation,
  fetchScoutEvents,
  filterEvents,
} from './scout-api-client.js';
import type { ScoutSecurityEvent, ThreatAnalysisReport } from './types.js';

const MITRE_BY_EVENT: Record<string, string> = {
  injection: 'TA0001',
  prompt_injection: 'TA0001',
  credential: 'TA0006',
  exfiltration: 'TA0010',
  tool_abuse: 'TA0002',
  egress: 'TA0011',
  honeypot: 'TA0001',
};

function inferMitreTactics(events: ScoutSecurityEvent[]): string[] {
  const tactics = new Set<string>();
  for (const event of events) {
    const key = Object.keys(MITRE_BY_EVENT).find((k) => event.event_type.includes(k));
    if (key) tactics.add(MITRE_BY_EVENT[key]!);
    if (event.metadata.mitre_tactic) tactics.add(String(event.metadata.mitre_tactic));
  }
  if (tactics.size === 0) tactics.add('TA0001');
  return [...tactics];
}

function scoreThreat(events: ScoutSecurityEvent[]): number {
  let score = 0;
  for (const event of events) {
    if (event.severity === 'breach') score += 40;
    else if (event.severity === 'critical') score += 30;
    else if (event.severity === 'warning') score += 15;
    else score += 5;
    if (/injection|exfiltration|credential/.test(event.event_type)) score += 10;
  }
  return Math.min(100, score);
}

function buildAttackChain(events: ScoutSecurityEvent[]): string[] {
  return events
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((e) => `${e.created_at}: ${e.event_type} (${e.severity}) - ${e.description.slice(0, 120)}`);
}

function classifyThreat(events: ScoutSecurityEvent[]): string {
  const types = events.map((e) => e.event_type).join(' ');
  if (/credential|exfiltration|secret/.test(types)) return 'credential_compromise';
  if (/injection|prompt/.test(types)) return 'prompt_injection_campaign';
  if (/tool_abuse|sandbox/.test(types)) return 'tool_abuse';
  if (/egress|network/.test(types)) return 'data_exfiltration_attempt';
  return 'correlated_security_anomaly';
}

function recommendedActions(classification: string, score: number): string[] {
  const actions = ['Review correlated events in Scout dashboard'];
  if (score >= 80) actions.push('Consider session block or instance suspend via Scout kill switch');
  if (classification.includes('credential')) actions.push('Rotate exposed credentials');
  if (classification.includes('injection')) actions.push('Tighten prompt guard rules and review session logs');
  return actions;
}

async function maybeSummariseWithLlm(report: ThreatAnalysisReport, events: ScoutSecurityEvent[]): Promise<string> {
  if (process.env.SCOUT_AGENTIC_LLM === 'false') return report.summary;
  try {
    const { llm } = await import('../../brain/llm.js');
    const snippet = events.slice(0, 12).map((e) => `- ${e.event_type}: ${e.description}`).join('\n');
    const response = await llm.chatCheap([{
      role: 'user',
      content: [
        'Summarise this security threat analysis in 2-3 sentences for an operator dashboard.',
        `Classification: ${report.classification}`,
        `Score: ${report.threatScore}`,
        'Events:',
        snippet,
      ].join('\n'),
      timestamp: new Date(),
    }]);
    const text = response.content?.trim();
    return text || report.summary;
  } catch {
    return report.summary;
  }
}

export async function analyzeThreatCluster(input: {
  threatId?: string;
  clusterId?: string;
  eventIds?: string[];
  sessionId?: string;
}): Promise<ThreatAnalysisReport | null> {
  if (!isScoutAgenticLayerEnabled()) return null;

  const threatId = input.threatId ?? input.clusterId ?? randomUUID();
  let events: ScoutSecurityEvent[] = [];

  if (input.clusterId || input.threatId) {
    const correlation = await fetchEventsForCorrelation(input.clusterId ?? input.threatId ?? '');
    events = correlation.events;
  }

  if (events.length === 0 && input.eventIds?.length) {
    const all = await fetchScoutEvents({ limit: 500 });
    const wanted = new Set(input.eventIds);
    events = all.filter((e) => wanted.has(e.id));
  }

  if (events.length === 0 && input.sessionId) {
    const all = await fetchScoutEvents({ limit: 300 });
    events = filterEvents(all, { sessionId: input.sessionId });
  }

  if (events.length === 0) {
    const all = await fetchScoutEvents({ limit: 50 });
    events = all.filter((e) => e.severity === 'critical' || e.severity === 'breach').slice(0, 10);
  }

  const threatScore = scoreThreat(events);
  const classification = classifyThreat(events);
  const mitreTactics = inferMitreTactics(events);
  const attackChain = buildAttackChain(events);
  const confidence = Math.min(99, Math.max(55, threatScore + (events.length > 2 ? 10 : 0)));

  const report: ThreatAnalysisReport = {
    reportId: randomUUID(),
    generatedAt: new Date().toISOString(),
    threatId,
    classification,
    confidence,
    threatScore,
    mitreTactics,
    attackChain,
    impactAssessment: threatScore >= 80
      ? 'High impact: active attack indicators across multiple signals'
      : threatScore >= 50
        ? 'Moderate impact: suspicious activity requiring operator review'
        : 'Low impact: limited or isolated indicators',
    recommendedActions: recommendedActions(classification, threatScore),
    evidenceEventIds: events.map((e) => e.id),
    summary: `${classification.replace(/_/g, ' ')} with threat score ${threatScore}/100 across ${events.length} correlated signal(s).`,
  };

  report.summary = await maybeSummariseWithLlm(report, events);

  await reportScoutSignal({
    signal_id: report.reportId,
    timestamp: report.generatedAt,
    agent_id: `carina:${config.labyrinth.instanceId}`,
    category: 'threat_analysis',
    action: 'threat_analysis_complete',
    target: threatId,
    severity: threatScore >= 80 ? 'critical' : threatScore >= 50 ? 'warning' : 'info',
    details: report as unknown as Record<string, unknown>,
    mitre_tactic: mitreTactics[0],
    threat_score: threatScore,
    instance_id: config.labyrinth.instanceId,
    session_id: input.sessionId,
  });

  return report;
}
