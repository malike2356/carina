import { resolveAdapter } from './adapter-registry.js';
import { inspectRequest } from './security-pipeline.js';

export interface ScoutWrapOptions {
  provider: string;
  apiKey?: string;
}

function wrapFunction<T extends (...args: unknown[]) => unknown>(fn: T, adapter = resolveAdapter('generic')): T {
  return (async (...args: Parameters<T>) => {
    const request = adapter.parseRequest(args[0]);
    const decision = await inspectRequest(request);
    if (decision.blocked) {
      throw new Error(`Request blocked by Labyrinth Scout: ${decision.reason ?? 'prompt injection detected'}`);
    }
    return fn(...args);
  }) as T;
}

function wrapObject<T extends object>(target: T, provider: string): T {
  const adapter = resolveAdapter(provider);
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver) as unknown;
      if (typeof value === 'function') {
        return wrapFunction(value as (...args: unknown[]) => unknown, adapter);
      }
      if (value && typeof value === 'object') {
        return wrapObject(value, provider);
      }
      return value;
    },
  });
}

export function scoutWrap<T extends object>(client: T, options: ScoutWrapOptions): T {
  void options.apiKey;
  return wrapObject(client, options.provider);
}
