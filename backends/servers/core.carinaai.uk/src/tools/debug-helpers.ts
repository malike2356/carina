import type { Tool } from '../types/index.js';
import { registry } from './registry.js';
import { listConnections } from '../mcp/registry.js';
import { getRegistrySize, listProcesses } from './process-registry.js';
import { llm } from '../brain/llm.js';

export const debugHelpersTool: Tool = {
  name: 'debug-helpers',
  description:
    'Introspection for debugging. Actions: tools (list registered tools), env (safe env summary), processes, mcp, provider.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['tools', 'env', 'processes', 'mcp', 'provider'],
      },
    },
    required: ['action'],
  },
  execute: async (params) => {
    const action = String(params.action ?? '');

    if (action === 'tools') {
      return {
        count: registry.list().length,
        tools: registry.list().map((t) => ({
          name: t.name,
          dangerous: Boolean(t.dangerous),
        })),
      };
    }

    if (action === 'env') {
      return {
        node_version: process.version,
        platform: process.platform,
        labyrinth_enabled: process.env.LABYRINTH_ENABLED === 'true',
        active_packs: process.env.ACTIVE_SKILL_PACKS ?? '',
        memory_db: Boolean(process.env.DATABASE_URL),
        redis: Boolean(process.env.REDIS_URL),
      };
    }

    if (action === 'processes') {
      return {
        registry_size: getRegistrySize(),
        processes: listProcesses(),
      };
    }

    if (action === 'mcp') {
      const servers = listConnections();
      return { servers };
    }

    if (action === 'provider') {
      return {
        active: llm.current().name,
        available: llm.list(),
      };
    }

    return { error: `unknown action: ${action}` };
  },
};
