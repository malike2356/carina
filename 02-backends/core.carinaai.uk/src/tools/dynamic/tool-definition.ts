import { executeInSandbox } from '../../sandbox/engine.js';
import { RuntimeToolStore } from './tool-store.js';
import type { RuntimeToolRecord } from './tool-store.js';
import type { Tool } from '../../types/index.js';
import { registry } from '../registry.js';

/**
 * Turn a RuntimeToolRecord into a live Tool object that can be registered
 * in the tool registry. The execute() function re-runs the stored source
 * code in the sandbox each time it is called.
 */
export function createRuntimeToolDefinition(record: RuntimeToolRecord): Tool {
  const parsedParams: Record<string, unknown> = (() => {
    try {
      return JSON.parse(record.parametersJson) as Record<string, unknown>;
    } catch {
      return {};
    }
  })();

  return {
    name: record.name,
    description: record.description,
    parameters: {
      type: 'object',
      properties: parsedParams,
      required: Object.entries(parsedParams)
        .filter(([, v]) => (v as Record<string, unknown>)?.required === true)
        .map(([k]) => k),
    },

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const start = Date.now();
      const result = await executeInSandbox(record.sourceCode, params, {
        timeout: record.sandboxTimeoutMs,
        memoryLimitMb: record.sandboxMemoryMb,
      });

      // Record usage asynchronously - do not block the result
      const durationMs = Date.now() - start;
      const store = new RuntimeToolStore();
      void store.recordUse(record.name, durationMs).catch(() => undefined);

      if (!result.success) {
        return { error: result.error };
      }

      return result.result;
    },
  };
}

export function registerRuntimeTool(record: RuntimeToolRecord): void {
  registry.register(createRuntimeToolDefinition(record), { toolset: 'generated' });
}
