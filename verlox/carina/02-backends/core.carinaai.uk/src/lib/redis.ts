import { Redis, type RedisOptions } from 'ioredis';
import { config } from '../config/index.js';

export function redisClientOptions(overrides: RedisOptions = {}): RedisOptions {
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

function redisUrlWithPassword(url: string): string {
  const password = process.env.REDIS_PASSWORD?.trim();
  if (!password) return url;
  try {
    const parsed = new URL(url);
    if (parsed.password) return url;
    parsed.password = password;
    return parsed.toString();
  } catch {
    return url;
  }
}

export function createRedisClient(overrides: RedisOptions = {}): Redis {
  const client = new Redis(redisUrlWithPassword(config.redis.url), redisClientOptions(overrides));
  client.on('error', (err) => {
    console.error('[redis] connection error:', err.message);
  });
  return client;
}

/** Dedicated pub/sub client (cannot share with regular commands). */
export function createRedisSubscriber(overrides: RedisOptions = {}): Redis {
  return createRedisClient({
    lazyConnect: false,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...overrides,
  });
}
