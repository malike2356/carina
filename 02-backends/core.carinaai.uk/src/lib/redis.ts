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

export function createRedisClient(overrides: RedisOptions = {}): Redis {
  const client = new Redis(config.redis.url, redisClientOptions(overrides));
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
