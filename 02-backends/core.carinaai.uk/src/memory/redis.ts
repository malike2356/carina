import type { Redis } from 'ioredis';
import { createRedisClient } from '../lib/redis.js';

export const SESSION_KEY = 'carina:cli:session_id';

let redis: Redis | null = null;
let warned = false;

export function initRedis(): Promise<void> {
  return new Promise((resolve) => {
    const client = createRedisClient({
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    client.on('error', () => {
      if (!warned) {
        console.warn('Redis unavailable; session persistence degraded.');
        warned = true;
      }
    });

    client.connect().then(() => {
      redis = client;
      resolve();
    }).catch(() => {
      client.disconnect();
      resolve();
    });
  });
}

export function getRedis(): Redis | null {
  return redis;
}

export async function getPersistedSessionId(): Promise<string | null> {
  if (!redis) return null;
  return redis.get(SESSION_KEY);
}

export async function persistSessionId(sessionId: string): Promise<void> {
  if (!redis) return;
  await redis.set(SESSION_KEY, sessionId);
}
