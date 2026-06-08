import { Redis } from 'ioredis';
import { config } from './config/index.js';

let client: Redis | null = null;

export function initRedis(): Promise<void> {
  return new Promise((resolve) => {
    const r = new Redis(config.redis.url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    r.on('error', (err) => {
      console.warn('[scout:redis] Connection error:', err.message);
    });

    r.connect()
      .then(() => {
        client = r;
        console.log('[scout:redis] Connected');
        resolve();
      })
      .catch(() => {
        console.warn('[scout:redis] Redis unavailable; kill switch and SSE fan-out degraded');
        r.disconnect();
        resolve();
      });
  });
}

export function getRedis(): Redis | null {
  return client;
}

export function createSubscriber(): Redis {
  return new Redis(config.redis.url, {
    maxRetriesPerRequest: 1,
  });
}
