import fs from 'fs';
import path from 'path';
import { resolveCarinaHome } from '../../config/paths.js';
import { readTurnLogs, type TurnLogEntry } from '../../telemetry/turn-log.js';
import { readRecentNodeAudit, type NodeAuditEvent } from '../../infrastructure/node-host/audit.js';

export type GatewayLogLine = {
  ts: string;
  source: 'turn' | 'node-audit' | 'gateway';
  level: 'info' | 'warn' | 'error';
  message: string;
  meta?: Record<string, unknown>;
};

export type GatewayLogQuery = {
  since?: Date;
  limit?: number;
  source?: GatewayLogLine['source'];
};

function tailJsonlFile(filePath: string, limit: number): Array<Record<string, unknown>> {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n').filter(Boolean);
  return lines.slice(-limit).map((line) => {
    try {
      return JSON.parse(line) as Record<string, unknown>;
    } catch {
      return { raw: line };
    }
  });
}

function turnToLogLine(entry: TurnLogEntry): GatewayLogLine {
  const level = entry.bucket === 'tool_error' || entry.bucket === 'injection' ? 'error'
    : entry.bucket === 'slow' || entry.bucket === 'missing_config' ? 'warn'
      : 'info';
  return {
    ts: entry.ts,
    source: 'turn',
    level,
    message: `${entry.platform} turn ${entry.bucket} (${entry.latencyMs}ms)`,
    meta: {
      sessionId: entry.sessionId,
      profile: entry.profile,
      provider: entry.provider,
      model: entry.model,
      bucket: entry.bucket,
      toolsUsed: entry.toolsUsed,
      toolErrors: entry.toolErrors,
    },
  };
}

function auditToLogLine(entry: NodeAuditEvent): GatewayLogLine {
  return {
    ts: entry.at,
    source: 'node-audit',
    level: entry.action.includes('blocked') ? 'warn' : 'info',
    message: `node ${entry.action}${entry.detail ? `: ${entry.detail}` : ''}`,
    meta: {
      nodeId: entry.nodeId,
      action: entry.action,
      actor: entry.actor,
    },
  };
}

export async function collectGatewayLogs(query: GatewayLogQuery = {}): Promise<GatewayLogLine[]> {
  const limit = query.limit ?? 100;
  const sinceMs = query.since?.getTime();

  const turns = await readTurnLogs({ limit: limit * 2 });
  const turnLines = turns
    .filter((t) => !sinceMs || new Date(t.ts).getTime() >= sinceMs)
    .map(turnToLogLine);

  const auditLines = readRecentNodeAudit(limit * 2)
    .filter((a) => !sinceMs || new Date(a.at).getTime() >= sinceMs)
    .map(auditToLogLine);

  const gatewayPath = path.join(resolveCarinaHome(), 'data', 'logs', 'gateway.jsonl');
  const gatewayRaw = tailJsonlFile(gatewayPath, limit).map((row) => {
    const ts = String(row.ts ?? row.at ?? new Date().toISOString());
    return {
      ts,
      source: 'gateway' as const,
      level: (row.level === 'error' || row.level === 'warn' ? row.level : 'info') as GatewayLogLine['level'],
      message: String(row.message ?? row.event ?? 'gateway event'),
      meta: row,
    };
  }).filter((l) => !sinceMs || new Date(l.ts).getTime() >= sinceMs);

  let merged = [...turnLines, ...auditLines, ...gatewayRaw];
  if (query.source) {
    merged = merged.filter((l) => l.source === query.source);
  }
  merged.sort((a, b) => b.ts.localeCompare(a.ts));
  return merged.slice(0, limit);
}

export function appendGatewayLog(event: Omit<GatewayLogLine, 'ts' | 'source'> & { source?: GatewayLogLine['source'] }): void {
  const file = path.join(resolveCarinaHome(), 'data', 'logs', 'gateway.jsonl');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const row: GatewayLogLine = {
    ts: new Date().toISOString(),
    source: event.source ?? 'gateway',
    level: event.level,
    message: event.message,
    meta: event.meta,
  };
  fs.appendFileSync(file, `${JSON.stringify(row)}\n`, { mode: 0o600 });
}

export function formatSseLogLine(line: GatewayLogLine): string {
  return `data: ${JSON.stringify(line)}\n\n`;
}
