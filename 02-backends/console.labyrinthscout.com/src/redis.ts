import { Redis, type RedisOptions } from 'ioredis';
import { config } from './config/index.js';

function redisClientOptions(overrides: RedisOptions = {}): RedisOptions {
  return {
    retryStrategy: (times: number) => Math.min(times * 100, 30_000),
    enableReadyCheck: true,
    ...(process.env.REDIS_TLS === 'true'
      ? {
          tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production',
          },
        }
      : {}),
    ...overrides,
  };
}

function attachErrorLogging(client: Redis, label: string): Redis {
  client.on('error', (err) => {
    console.warn(`[scout:redis:${label}] Connection error:`, err.message);
  });
  return client;
}

let client: Redis | null = null;

export function initRedis(): Promise<void> {
  return new Promise((resolve) => {
    const r = attachErrorLogging(
      new Redis(config.redis.url, redisClientOptions({
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      })),
      'command',
    );

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
  return attachErrorLogging(
    new Redis(config.redis.url, redisClientOptions({
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })),
    'subscriber',
  );
}
