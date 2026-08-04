import { randomUUID } from 'crypto';
import { config } from '../../config/index.js';
import { reportScoutSignal } from '../scout-client.js';
import { isScoutAgenticLayerEnabled } from './scout-agentic-guard.js';
import {
  fetchScoutCorrelationMatches,
  fetchScoutEvents,
  fetchSessionEvents,
  filterEvents,
} from './scout-api-client.js';
import type { InvestigationReport, InvestigationVerdict, ScoutSecurityEvent } from './types.js';

function deriveVerdict(events: ScoutSecurityEvent[], injectionCount: number): InvestigationVerdict {
  const critical = events.filter((e) => e.severity === 'critical' || e.severity === 'breach').length;
  if (critical >= 2 || injectionCount >= 20) return 'malicious';
  if (critical >= 1 || injectionCount >= 5) return 'suspicious';
  if (events.length === 0) return 'inconclusive';
  return 'benign';
}

function scoreInvestigation(events: ScoutSecurityEvent[], verdict: InvestigationVerdict): number {
  const base = events.length * 3;
  if (verdict === 'malicious') return Math.min(100, 70 + base);
  if (verdict === 'suspicious') return Math.min(90, 45 + base);
  if (verdict === 'inconclusive') return 30;
  return Math.max(10, 20 - base);
}

function findCorrelatedSessions(events: ScoutSecurityEvent[], primarySessionId: string): string[] {
  const ips = new Set(events.map((e) => e.ip_address).filter(Boolean) as string[]);
  const sessions = new Set<string>();
  for (const event of events) {
    if (event.session_id && event.session_id !== primarySessionId) {
      if (!ips.size || (event.ip_address && ips.has(event.ip_address))) {
        sessions.add(event.session_id);
      }
    }
  }
  return [...sessions].slice(0, 10);
}

function buildRecommendations(verdict: InvestigationVerdict, sessionId: string): string[] {
  if (verdict === 'malicious') {
    return [
      `Block session ${sessionId} via Scout`,
      'Capture forensic snapshot',
      'Notify operator and review credential exposure',
    ];
  }
  if (verdict === 'suspicious') {
    return [
      `Rate-limit session ${sessionId}`,
      'Enable heightened monitoring for 24 hours',
      'Operator review recommended before auto-response',
    ];
  }
  if (verdict === 'inconclusive') {
    return ['Collect additional session telemetry', 'Re-run investigation after more signals arrive'];
  }
  return ['No immediate action required', 'Continue standard monitoring'];
}

export async function runInvestigation(input: {
  sessionId: string;
  reason?: string;
  requestedBy?: string;
}): Promise<InvestigationReport | null> {
  if (!isScoutAgenticLayerEnabled()) return null;

  const sessionId = input.sessionId.trim();
  if (!sessionId) return null;

  const sessionEvents = await fetchSessionEvents(sessionId, 300);
  const allEvents = sessionEvents.length > 0 ? sessionEvents : await fetchScoutEvents({ limit: 200 });
  const evidence = sessionEvents.length > 0
    ? sessionEvents
    : filterEvents(allEvents, { sessionId });

  const injectionCount = evidence.filter((e) => /injection/.test(e.event_type)).length;
  const verdict = deriveVerdict(evidence, injectionCount);
  const threatScore = scoreInvestigation(evidence, verdict);
  const confidence = verdict === 'malicious'
    ? Math.min(99, 85 + injectionCount)
    : verdict === 'suspicious'
      ? Math.min(90, 60 + evidence.length * 2)
      : verdict === 'inconclusive'
        ? 35
        : Math.max(70, 90 - evidence.length);

  const correlatedSessions = findCorrelatedSessions(await fetchScoutEvents({ limit: 400 }), sessionId);
  const matches = await fetchScoutCorrelationMatches(20);
  const relatedMatch = matches.find((m) => m.matchedEvents.some((id) => evidence.some((e) => e.id === id)));

  const attackChain = evidence
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((e) => `${e.created_at}: ${e.event_type} - ${e.description.slice(0, 100)}`);

  const report: InvestigationReport = {
    reportId: randomUUID(),
    generatedAt: new Date().toISOString(),
    sessionId,
    verdict,
    confidence,
    threatScore,
    attackChain,
    correlatedSessions,
    summary: [
      `Investigation of session ${sessionId}: verdict ${verdict}.`,
      `${evidence.length} session event(s); ${injectionCount} injection-related.`,
      relatedMatch ? `Correlated detection rule ${relatedMatch.ruleId} fired.` : '',
      input.reason ? `Trigger reason: ${input.reason}` : '',
    ].filter(Boolean).join(' '),
    recommendedActions: buildRecommendations(verdict, sessionId),
    evidence: evidence.slice(0, 30),
  };

  await reportScoutSignal({
    signal_id: report.reportId,
    timestamp: report.generatedAt,
    agent_id: `carina:${config.labyrinth.instanceId}`,
    category: 'investigation',
    action: 'investigation_complete',
    target: sessionId,
    severity: verdict === 'malicious' ? 'critical' : verdict === 'suspicious' ? 'warning' : 'info',
    details: {
      ...report,
      requestedBy: input.requestedBy ?? 'scout',
      correlationMatchId: relatedMatch?.id ?? null,
    } as unknown as Record<string, unknown>,
    threat_score: threatScore,
    session_id: sessionId,
    instance_id: config.labyrinth.instanceId,
  });

  return report;
}
