import { getRedis } from '../../memory/redis.js';
import { reportEvent } from '../scout-client.js';
import type { RASPSignal } from './types.js';
import {
  GLOBAL_SIGNAL_THRESHOLD,
  GLOBAL_SIGNAL_WINDOW_SECS,
  SIGNAL_PERSISTENCE_TTL_SECS,
} from './signal-weights.js';
import { resolvePatternId } from './mitre-tactics.js';

const GLOBAL_KEY_PREFIX = 'rasp:global:';
const SESSION_KEY_PREFIX = 'rasp:signals:';

function globalPatternKey(patternId: string): string {
  return `${GLOBAL_KEY_PREFIX}${patternId}`;
}

function sessionSignalsKey(sessionId: string): string {
  return `${SESSION_KEY_PREFIX}${sessionId}`;
}

export async function recordSignalGlobally(signal: RASPSignal): Promise<void> {
  const redis = getRedis();
  const patternId = resolvePatternId(signal);
  if (!redis || !patternId) return;

  const key = globalPatternKey(patternId);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, GLOBAL_SIGNAL_WINDOW_SECS);
  }

  if (count >= GLOBAL_SIGNAL_THRESHOLD) {
    await reportEvent({
      severity: 'critical',
      source: 'rasp-engine',
      event_type: 'rasp_coordinated_attack',
      description: `Coordinated attack: ${count} sessions hit pattern ${patternId} within ${GLOBAL_SIGNAL_WINDOW_SECS}s`,
      session_id: signal.context.sessionId,
      metadata: {
        patternId,
        count,
        windowSeconds: GLOBAL_SIGNAL_WINDOW_SECS,
      },
    });
  }
}

export async function restoreSessionSignals(sessionId: string): Promise<RASPSignal[]> {
  const redis = getRedis();
  if (!redis) return [];

  const raw = await redis.get(sessionSignalsKey(sessionId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as RASPSignal[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function persistSessionSignals(
  sessionId: string,
  signals: RASPSignal[],
): Promise<void> {
  const redis = getRedis();
  if (!redis || signals.length === 0) return;

  await redis.setex(
    sessionSignalsKey(sessionId),
    SIGNAL_PERSISTENCE_TTL_SECS,
    JSON.stringify(signals),
  );
}

export async function persistAllSessionSignals(
  sessionBuffers: Map<string, { snapshotForPersistence: () => RASPSignal[] }>,
): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const [sessionId, buffer] of sessionBuffers) {
    const snapshot = buffer.snapshotForPersistence();
    if (snapshot.length > 0) {
      tasks.push(persistSessionSignals(sessionId, snapshot));
    }
  }
  await Promise.all(tasks);
}

export async function _resetRaspGlobalStoreForTests(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const keys = await redis.keys(`${GLOBAL_KEY_PREFIX}*`);
  const sessionKeys = await redis.keys(`${SESSION_KEY_PREFIX}*`);
  const all = [...keys, ...sessionKeys];
  if (all.length > 0) {
    await redis.del(...all);
  }
}
