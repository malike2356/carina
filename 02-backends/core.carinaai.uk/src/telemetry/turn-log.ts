import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { globalCarinaHome } from '../config/paths.js';

export type TurnBucket =
  | 'ok'
  | 'slow'
  | 'tool_error'
  | 'injection'
  | 'missing_config'
  | 'verbose';

export interface TurnLogEntry {
  ts: string;
  sessionId: string;
  profile: string;
  platform: string;
  provider: string;
  model: string;
  latencyMs: number;
  fastMode: boolean;
  complexity: 'simple' | 'complex';
  path: 'quick' | 'single' | 'multi';
  toolsUsed: string[];
  toolErrors: number;
  userMessageHash: string;
  messageLength: number;
  responseLength: number;
  bucket: TurnBucket;
  error?: string;
}

export interface TurnLogQuery {
  since?: Date;
  bucket?: TurnBucket;
  limit?: number;
}

const DEFAULT_SLOW_MS = 8_000;

export function turnLogEnabled(): boolean {
  return process.env.CARINA_TURN_LOG !== 'false';
}

export function turnLogPath(): string {
  const home = process.env.CARINA_HOME ?? globalCarinaHome();
  return path.join(home, 'data', 'logs', 'turns.jsonl');
}

export function hashUserMessage(message: string): string {
  return createHash('sha256').update(message.trim()).digest('hex').slice(0, 16);
}

export function slowThresholdMs(): number {
  const raw = process.env.CARINA_TURN_LOG_SLOW_MS;
  if (!raw) return DEFAULT_SLOW_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SLOW_MS;
}

export function classifyTurnBucket(input: {
  latencyMs: number;
  toolErrors: number;
  responseText: string;
  responseLength: number;
}): TurnBucket {
  if (
    input.responseText.includes('[Session blocked by security policy')
    || input.responseText.includes('[Carina is suspended by Labyrinth Scout')
    || input.responseText.includes('prompt guard')
  ) {
    return 'injection';
  }
  if (input.toolErrors > 0) return 'tool_error';
  if (input.latencyMs >= slowThresholdMs()) return 'slow';
  if (input.responseLength > 4_000) return 'verbose';
  return 'ok';
}

export function parseSinceArg(value: string): Date {
  const m = value.match(/^(\d+)(m|h|d)$/i);
  if (!m) throw new Error(`invalid --since value: ${value} (use e.g. 24h, 7d, 30m)`);
  const n = Number(m[1]);
  const unit = m[2]!.toLowerCase();
  const ms = unit === 'm' ? n * 60_000 : unit === 'h' ? n * 3_600_000 : n * 86_400_000;
  return new Date(Date.now() - ms);
}

export async function recordTurn(entry: Omit<TurnLogEntry, 'ts' | 'bucket'> & { bucket?: TurnBucket }): Promise<void> {
  if (!turnLogEnabled()) return;

  const bucket = entry.bucket ?? classifyTurnBucket({
    latencyMs: entry.latencyMs,
    toolErrors: entry.toolErrors,
    responseText: '',
    responseLength: entry.responseLength,
  });

  const line: TurnLogEntry = {
    ...entry,
    bucket,
    ts: new Date().toISOString(),
  };

  const file = turnLogPath();
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, `${JSON.stringify(line)}\n`, 'utf8');
  } catch {
    // Non-blocking: logging must not affect chat latency.
  }
}

export async function readTurnLogs(query: TurnLogQuery = {}): Promise<TurnLogEntry[]> {
  const file = turnLogPath();
  let raw = '';
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    return [];
  }

  const entries: TurnLogEntry[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as TurnLogEntry);
    } catch {
      // skip corrupt lines
    }
  }

  let filtered = entries;
  if (query.since) {
    const sinceMs = query.since.getTime();
    filtered = filtered.filter((e) => new Date(e.ts).getTime() >= sinceMs);
  }
  if (query.bucket) {
    filtered = filtered.filter((e) => e.bucket === query.bucket);
  }

  filtered.sort((a, b) => b.ts.localeCompare(a.ts));
  const limit = query.limit ?? 50;
  return filtered.slice(0, limit);
}

export function countTurnBuckets(entries: TurnLogEntry[]): Record<TurnBucket, number> {
  const counts: Record<TurnBucket, number> = {
    ok: 0,
    slow: 0,
    tool_error: 0,
    injection: 0,
    missing_config: 0,
    verbose: 0,
  };
  for (const e of entries) {
    counts[e.bucket] = (counts[e.bucket] ?? 0) + 1;
  }
  return counts;
}
