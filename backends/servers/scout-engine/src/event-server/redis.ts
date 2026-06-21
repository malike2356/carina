// scout-engine/src/event-server/redis.ts
// Redis pub/sub client for the event ingestion server.
import { Redis } from 'ioredis';
import { serverConfig } from './config.js';

let client: Redis | null = null;

export function initRedis(): Promise<void> {
  return new Promise((resolve) => {
    const r = new Redis(serverConfig.redis.url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    r.on('error', (err: Error) => {
      console.warn('[scout:redis] Connection error:', err.message);
    });

    r.connect()
      .then(() => {
        client = r;
        console.log('[scout:redis] Connected');
        resolve();
      })
      .catch(() => {
        console.warn('[scout:redis] Redis unavailable; event fan-out degraded');
        r.disconnect();
        resolve(); // resolve (not reject) so server still starts without Redis
      });
  });
}

export function getRedis(): Redis | null {
  return client;
}

// Create a dedicated subscriber client (separate from the command client).
// ioredis subscriber clients cannot issue regular commands.
export function createSubscriber(): Redis {
  return new Redis(serverConfig.redis.url, {
    maxRetriesPerRequest: 1,
  });
}
