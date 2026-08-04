import { randomUUID } from 'crypto';
import { config } from '../../config/index.js';
import { reportScoutSignal } from '../scout-client.js';
import { isScoutAgenticLayerEnabled } from './scout-agentic-guard.js';
import { fetchScoutEvents, filterEvents } from './scout-api-client.js';
import type { NlQueryResult } from './types.js';

const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const SESSION_RE = /\b(?:session[_-]?)?[a-f0-9]{8,}\b/i;
const HOURS_RE = /last\s+(\d+)\s+hours?/i;
const DAYS_RE = /last\s+(\d+)\s+days?/i;

export type NlQueryFilters = {
  ip?: string;
  sessionId?: string;
  eventTypeContains?: string;
  severity?: string;
  sinceMs?: number;
  instanceId?: string;
};

export function parseNlQueryFilters(query: string): NlQueryFilters {
  const filters: NlQueryFilters = {};
  const lower = query.toLowerCase();

  const ip = query.match(IP_RE)?.[0];
  if (ip) filters.ip = ip;

  const hours = lower.match(HOURS_RE);
  if (hours) filters.sinceMs = parseInt(hours[1]!, 10) * 60 * 60 * 1000;
  const days = lower.match(DAYS_RE);
  if (days) filters.sinceMs = parseInt(days[1]!, 10) * 24 * 60 * 60 * 1000;

  const session = query.match(SESSION_RE)?.[0];
  if (session && !IP_RE.test(session)) filters.sessionId = session;

  if (/injection|prompt/.test(lower)) filters.eventTypeContains = 'injection';
  else if (/anomal/.test(lower)) filters.eventTypeContains = 'anomal';
  else if (/tool/.test(lower)) filters.eventTypeContains = 'tool';
  else if (/credential|secret/.test(lower)) filters.eventTypeContains = 'credential';
  else if (/egress|network/.test(lower)) filters.eventTypeContains = 'egress';

  if (/critical/.test(lower)) filters.severity = 'critical';
  else if (/warning/.test(lower)) filters.severity = 'warning';

  if (/this instance|this carina/.test(lower)) {
    filters.instanceId = config.labyrinth.instanceId;
  }

  return filters;
}

function formatEvidenceSummary(events: Awaited<ReturnType<typeof fetchScoutEvents>>): string {
  if (events.length === 0) return 'No matching security events found for this query.';

  const byType = new Map<string, number>();
  for (const event of events) {
    byType.set(event.event_type, (byType.get(event.event_type) ?? 0) + 1);
  }
  const topTypes = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => `${type} (${count})`)
    .join(', ');

  const critical = events.filter((e) => e.severity === 'critical' || e.severity === 'breach').length;
  const latest = events[0];
  return [
    `Found ${events.length} matching event(s).`,
    critical > 0 ? `${critical} critical or breach severity.` : 'No critical severity events in this slice.',
    `Top event types: ${topTypes}.`,
    latest ? `Most recent: ${latest.event_type} at ${latest.created_at} - ${latest.description.slice(0, 140)}` : '',
  ].filter(Boolean).join(' ');
}

async function maybeEnhanceSummary(query: string, base: string, events: Awaited<ReturnType<typeof fetchScoutEvents>>): Promise<string> {
  if (process.env.SCOUT_AGENTIC_LLM === 'false' || events.length === 0) return base;
  try {
    const { llm } = await import('../../brain/llm.js');
    const lines = events.slice(0, 8).map((e) => `- [${e.severity}] ${e.event_type}: ${e.description.slice(0, 100)}`);
    const response = await llm.chatCheap([{
      role: 'user',
      content: [
        'Answer this security operator query using only the evidence below. Be concise.',
        `Query: ${query}`,
        'Evidence:',
        ...lines,
      ].join('\n'),
      timestamp: new Date(),
    }]);
    return response.content?.trim() || base;
  } catch {
    return base;
  }
}

export async function runNlSecurityQuery(query: string): Promise<NlQueryResult | null> {
  if (!isScoutAgenticLayerEnabled()) return null;
  const trimmed = query.trim();
  if (!trimmed) return null;

  const parsedFilters = parseNlQueryFilters(trimmed);
  const allEvents = await fetchScoutEvents({ limit: 500 });
  const evidence = filterEvents(allEvents, parsedFilters).slice(0, 50);
  let summary = formatEvidenceSummary(evidence);
  summary = await maybeEnhanceSummary(trimmed, summary, evidence);

  const result: NlQueryResult = {
    query: trimmed,
    parsedFilters,
    eventCount: evidence.length,
    summary,
    evidence,
  };

  await reportScoutSignal({
    signal_id: randomUUID(),
    timestamp: new Date().toISOString(),
    agent_id: `carina:${config.labyrinth.instanceId}`,
    category: 'nl_query_result',
    action: 'nl_query_answered',
    target: trimmed.slice(0, 120),
    details: {
      parsedFilters,
      eventCount: evidence.length,
      summary,
    },
    instance_id: config.labyrinth.instanceId,
  });

  return result;
}
