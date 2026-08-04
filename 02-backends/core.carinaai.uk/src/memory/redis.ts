import type { Redis } from 'ioredis';
import { createRedisClient } from '../lib/redis.js';

export const SESSION_KEY = 'carina:cli:session_id';

let redis: Redis | null = null;
let warned = false;
let connecting: Promise<void> | null = null;

function isUsable(client: Redis | null): client is Redis {
  if (!client) return false;
  return client.status === 'ready' || client.status === 'connect' || client.status === 'connecting';
}

function discardClient(client: Redis | null): void {
  if (!client) return;
  try {
    client.removeAllListeners();
    client.disconnect();
  } catch {
    // ignore teardown errors
  }
}

/**
 * Connect (or reconnect) the shared Redis client.
 * Safe to call repeatedly; concurrent callers share one in-flight connect.
 */
export function initRedis(): Promise<void> {
  if (isUsable(redis)) return Promise.resolve();
  if (connecting) return connecting;

  connecting = (async () => {
    discardClient(redis);
    redis = null;

    const client = createRedisClient({
      // Keep retrying commands briefly so a blip does not kill the turn.
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      enableOfflineQueue: true,
    });

    client.on('error', (err) => {
      if (!warned) {
        console.warn('Redis unavailable; session persistence degraded.', err.message);
        warned = true;
      }
    });

    client.on('end', () => {
      if (redis === client) {
        redis = null;
        warned = false;
      }
    });

    try {
      await client.connect();
      redis = client;
      warned = false;
    } catch (err) {
      discardClient(client);
      redis = null;
      if (!warned) {
        console.warn(
          'Redis unavailable; session persistence degraded.',
          err instanceof Error ? err.message : String(err),
        );
        warned = true;
      }
    }
  })().finally(() => {
    connecting = null;
  });

  return connecting;
}

/** Return a live Redis client, or null if Redis is down. Never returns a closed client. */
export function getRedis(): Redis | null {
  if (isUsable(redis)) return redis;
  if (redis) {
    discardClient(redis);
    redis = null;
  }
  // Kick reconnect for the next caller; this request falls back.
  void initRedis();
  return null;
}

export async function getPersistedSessionId(): Promise<string | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    return await client.get(SESSION_KEY);
  } catch {
    return null;
  }
}

export async function persistSessionId(sessionId: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(SESSION_KEY, sessionId);
  } catch {
    // best-effort
  }
}
