import { AsyncLocalStorage } from 'node:async_hooks';

export interface ScoutRuntimeContext {
  apiKey: string;
  instanceId: string;
  instanceName: string;
}

export const scoutContext = new AsyncLocalStorage<ScoutRuntimeContext>();

export function runWithScoutContext<T>(ctx: ScoutRuntimeContext, fn: () => T): T {
  return scoutContext.run(ctx, fn);
}

export function runWithScoutContextAsync<T>(ctx: ScoutRuntimeContext, fn: () => Promise<T>): Promise<T> {
  return scoutContext.run(ctx, fn);
}
