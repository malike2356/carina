import { randomUUID } from 'node:crypto';
import { readAgentBehaviorTail } from '../../telemetry/agent-behavior-log.js';
import { readTurnLogs } from '../../telemetry/turn-log.js';
import { readSecurityAuditTail } from '../security-audit.js';
import { saveTimeline } from './store.js';
import type { TimelineEvent } from './types.js';

function inWindow(ts: number, startTime: number, endTime: number): boolean {
  return ts >= startTime && ts <= endTime;
}

function parseTs(value: string | number): number {
  return typeof value === 'number' ? value : new Date(value).getTime();
}

function areRelated(a: TimelineEvent, b: TimelineEvent): boolean {
  if (a.source === b.source && Math.abs(a.timestamp - b.timestamp) < 5_000) return true;
  if (a.type === 'tool_call' && b.type === 'tool_result') return true;
  if (a.type === 'user_message' && b.type === 'agent_response') return true;
  if (a.type === 'security_event' && b.severity !== 'info') return true;
  return false;
}

type SuspiciousPattern = {
  detected: boolean;
  timestamp: number;
  severity: 'warning' | 'critical';
  description: string;
  details: Record<string, unknown>;
  eventIds: string[];
};

function detectRapidToolCalls(events: TimelineEvent[]): SuspiciousPattern {
  const toolCalls = events.filter((e) => e.type === 'tool_call');
  if (toolCalls.length < 5) return { detected: false, timestamp: 0, severity: 'warning', description: '', details: {}, eventIds: [] };
  const windowMs = 60_000;
  for (let i = 0; i < toolCalls.length; i++) {
    const start = toolCalls[i]!.timestamp;
    const batch = toolCalls.filter((e) => e.timestamp - start <= windowMs);
    if (batch.length >= 5) {
      return {
        detected: true,
        timestamp: start,
        severity: 'warning',
        description: 'Rapid tool call burst detected',
        details: { count: batch.length, windowMs },
        eventIds: batch.map((e) => e.id),
      };
    }
  }
  return { detected: false, timestamp: 0, severity: 'warning', description: '', details: {}, eventIds: [] };
}

function detectPrivilegeEscalation(events: TimelineEvent[]): SuspiciousPattern {
  const hits = events.filter((e) =>
    /privilege|sudo|chmod|rbac|denied|escalation/i.test(e.description)
    || String(e.details.category ?? '') === 'tool_rbac');
  if (hits.length === 0) {
    return { detected: false, timestamp: 0, severity: 'warning', description: '', details: {}, eventIds: [] };
  }
  return {
    detected: true,
    timestamp: hits[0]!.timestamp,
    severity: 'critical',
    description: 'Privilege escalation pattern detected',
    details: { matches: hits.length },
    eventIds: hits.map((e) => e.id),
  };
}

function detectDataExfiltration(events: TimelineEvent[]): SuspiciousPattern {
  const hits = events.filter((e) =>
    /exfil|egress|email-send|http-request|sequence/i.test(e.description)
    || e.details.ruleId === 'SEQ-001'
    || e.details.ruleId === 'SEQ-002');
  if (hits.length === 0) {
    return { detected: false, timestamp: 0, severity: 'warning', description: '', details: {}, eventIds: [] };
  }
  return {
    detected: true,
    timestamp: hits[0]!.timestamp,
    severity: 'critical',
    description: 'Suspected data exfiltration pattern detected',
    details: { matches: hits.length },
    eventIds: hits.map((e) => e.id),
  };
}

function detectInjection(events: TimelineEvent[]): SuspiciousPattern {
  const hits = events.filter((e) =>
    e.type === 'security_event'
    && (/injection|prompt_guard|blocked/i.test(e.description)
      || e.details.category === 'prompt_injection'));
  if (hits.length === 0) {
    return { detected: false, timestamp: 0, severity: 'warning', description: '', details: {}, eventIds: [] };
  }
  return {
    detected: true,
    timestamp: hits[0]!.timestamp,
    severity: 'critical',
    description: 'Prompt injection activity detected',
    details: { matches: hits.length },
    eventIds: hits.map((e) => e.id),
  };
}

export class TimelineReconstructor {
  async reconstruct(
    incidentId: string,
    startTime: number,
    endTime: number,
    sessionId?: string,
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];

    const turns = await readTurnLogs({ since: new Date(startTime), limit: 500 });
    for (const turn of turns) {
      const ts = parseTs(turn.ts);
      if (!inWindow(ts, startTime, endTime)) continue;
      if (sessionId && turn.sessionId !== sessionId) continue;
      events.push({
        id: randomUUID(),
        incidentId,
        timestamp: ts,
        type: turn.bucket === 'injection' ? 'security_event' : 'agent_response',
        severity: turn.bucket === 'injection' ? 'critical' : turn.toolErrors > 0 ? 'warning' : 'info',
        source: 'turn-log',
        description: `Turn ${turn.path} via ${turn.provider}/${turn.model}`,
        details: {
          sessionId: turn.sessionId,
          toolsUsed: turn.toolsUsed,
          bucket: turn.bucket,
          latencyMs: turn.latencyMs,
        },
        relatedEvents: [],
      });
      if (turn.toolsUsed.length > 0) {
        events.push({
          id: randomUUID(),
          incidentId,
          timestamp: ts + 1,
          type: 'tool_call',
          severity: turn.toolErrors > 0 ? 'warning' : 'info',
          source: 'turn-log',
          description: `Tools used: ${turn.toolsUsed.join(', ')}`,
          details: { toolsUsed: turn.toolsUsed, toolErrors: turn.toolErrors },
          relatedEvents: [],
        });
      }
    }

    const behavior = await readAgentBehaviorTail(200);
    for (const row of behavior) {
      const ts = parseTs(row.ts);
      if (!inWindow(ts, startTime, endTime)) continue;
      if (sessionId && row.sessionId !== sessionId) continue;
      events.push({
        id: randomUUID(),
        incidentId,
        timestamp: ts,
        type: 'system_event',
        severity: 'info',
        source: 'agent-behavior-log',
        description: row.detail ?? row.action,
        details: { action: row.action, ...(row.meta ?? {}) },
        relatedEvents: [],
      });
    }

    for (const audit of readSecurityAuditTail(200)) {
      const ts = parseTs(audit.at);
      if (!inWindow(ts, startTime, endTime)) continue;
      if (sessionId && audit.sessionId && audit.sessionId !== sessionId) continue;
      events.push({
        id: randomUUID(),
        incidentId,
        timestamp: ts,
        type: 'security_event',
        severity: audit.action === 'block' ? 'critical' : 'warning',
        source: 'security-audit',
        description: `${audit.category}: ${audit.detail}`,
        details: {
          category: audit.category,
          action: audit.action,
          toolName: audit.toolName,
          metadata: audit.metadata,
        },
        relatedEvents: [],
      });
    }

    events.sort((a, b) => a.timestamp - b.timestamp);
    this.correlateEvents(events);
    this.flagSuspiciousPatterns(events);
    await saveTimeline(incidentId, events);
    return events;
  }

  private correlateEvents(events: TimelineEvent[]): void {
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        if (!areRelated(events[i]!, events[j]!)) continue;
        events[i]!.relatedEvents.push(events[j]!.id);
        events[j]!.relatedEvents.push(events[i]!.id);
      }
    }
  }

  private flagSuspiciousPatterns(events: TimelineEvent[]): void {
    const patterns = [
      detectRapidToolCalls(events),
      detectPrivilegeEscalation(events),
      detectDataExfiltration(events),
      detectInjection(events),
    ];

    for (const pattern of patterns) {
      if (!pattern.detected) continue;
      events.push({
        id: randomUUID(),
        incidentId: events[0]?.incidentId ?? 'unknown',
        timestamp: pattern.timestamp,
        type: 'security_event',
        severity: pattern.severity,
        source: 'pattern-detector',
        description: pattern.description,
        details: pattern.details,
        relatedEvents: pattern.eventIds,
        suspicious: true,
      });
    }
  }
}

export const timelineReconstructor = new TimelineReconstructor();
