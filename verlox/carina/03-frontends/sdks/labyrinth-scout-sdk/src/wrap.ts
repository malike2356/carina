import type { ScoutClient } from './client.js';
import { resolveAdapter } from './adapters/adapter-registry.js';

export interface ScoutWrapOptions {
  scout: ScoutClient;
  provider: string;
  instanceId?: string;
  sessionId?: string;
}

function wrapFunction<T extends (...args: unknown[]) => unknown>(
  fn: T,
  scout: ScoutClient,
  provider: string,
  instanceId?: string,
  sessionId?: string,
): T {
  return (async (...args: Parameters<T>) => {
    const adapter = resolveAdapter(provider);
    const normalized = adapter.parseRequest(args[0]);
    if (normalized.prompt) {
      try {
        const result = await scout.evaluateAndWait({
          session_id: sessionId ?? normalized.sessionId ?? 'sdk-session',
          instance_id: instanceId,
          action_type: 'http',
          content: normalized.prompt,
        });
        if (!result.proceed) {
          throw new Error(`Labyrinth Scout blocked request: ${result.reason ?? result.decision.reason}`);
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('Labyrinth Scout blocked request:')) {
          throw err;
        }
        // Scout unreachable - fail open (do not block requests when Scout is down)
      }
    }
    return fn(...args);
  }) as T;
}

function wrapObject<T extends object>(target: T, options: ScoutWrapOptions): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver) as unknown;
      if (typeof value === 'function') {
        return wrapFunction(
          value as (...args: unknown[]) => unknown,
          options.scout,
          options.provider,
          options.instanceId,
          options.sessionId,
        );
      }
      if (value && typeof value === 'object') {
        return wrapObject(value, options);
      }
      return value;
    },
  });
}

export function scoutWrap<T extends object>(client: T, options: ScoutWrapOptions): T {
  return wrapObject(client, options);
}
