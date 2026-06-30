import type { Role } from '../types/index.js';
import { getRedis } from './redis.js';
import { scanMemoryContent, type MemoryContentSource } from './content-scanner.js';
import { reportEvent } from '../security/scout-client.js';

const WRITE_RATE_LIMIT = 50;
const WINDOW_MS = 60 * 60 * 1000;

const inMemoryCounts = new Map<string, { count: number; expiresAt: number }>();

export function isMemoryContentScanEnabled(): boolean {
  return process.env.CARINA_MEMORY_CONTENT_SCAN !== 'false';
}

export function roleToMemorySource(role: Role): MemoryContentSource {
  if (role === 'user') return 'user';
  if (role === 'system') return 'tool_result';
  return 'inference';
}

async function incrementWriteCount(sessionId: string): Promise<number> {
  const redis = getRedis();
  const key = `memory:ratelimit:${sessionId}`;

  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, Math.ceil(WINDOW_MS / 1000));
    }
    return count;
  }

  const now = Date.now();
  const existing = inMemoryCounts.get(key);
  if (!existing || existing.expiresAt <= now) {
    inMemoryCounts.set(key, { count: 1, expiresAt: now + WINDOW_MS });
    return 1;
  }
  existing.count += 1;
  return existing.count;
}

export type MemoryWriteGuardResult = { allowed: true } | { allowed: false };

export async function guardMemoryWrite(
  content: string,
  source: MemoryContentSource,
  sessionId: string,
): Promise<MemoryWriteGuardResult> {
  if (!isMemoryContentScanEnabled()) {
    return { allowed: true };
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return { allowed: true };
  }

  const count = await incrementWriteCount(sessionId);
  if (count > WRITE_RATE_LIMIT) {
    void reportEvent({
      severity: 'warning',
      source: 'memory-write-guard',
      event_type: 'memory_write_rate_exceeded',
      description: 'Memory write rate limit exceeded for session.',
      session_id: sessionId,
      metadata: { sessionId, count, source },
    });
    return { allowed: false };
  }

  const scan = scanMemoryContent(trimmed, source);
  if (scan.blocked) {
    void reportEvent({
      severity: 'critical',
      source: 'memory-write-guard',
      event_type: 'memory_write_blocked',
      description: scan.description,
      session_id: sessionId,
      metadata: {
        patternId: scan.patternId,
        severity: scan.severity,
        description: scan.description,
        source,
        sessionId,
        contentPreview: trimmed.slice(0, 120),
      },
    });
    return { allowed: false };
  }

  return { allowed: true };
}

export function _resetMemoryWriteGuardForTests(): void {
  inMemoryCounts.clear();
}
