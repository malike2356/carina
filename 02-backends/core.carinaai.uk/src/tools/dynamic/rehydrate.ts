import { RuntimeToolStore } from './tool-store.js';
import { createRuntimeToolDefinition } from './tool-definition.js';
import { registry } from '../registry.js';

/**
 * Load all active runtime-generated tools from the DB and register them
 * in the live tool registry. Called once on startup after migrations run.
 */
export async function rehydrateRuntimeTools(): Promise<number> {
  try {
    const store = new RuntimeToolStore();
    const activeTools = await store.loadActive();

    let registered = 0;
    for (const record of activeTools) {
      try {
        const tool = createRuntimeToolDefinition(record);
        registry.register(tool);
        registered++;
      } catch {
        // Skip invalid records - do not crash startup
      }
    }

    return registered;
  } catch {
    // DB may not be ready yet or table missing - not fatal
    return 0;
  }
}
