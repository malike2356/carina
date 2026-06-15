import { describe, expect, it } from 'vitest';
import { AI_PLATFORM_SCHEMA } from './ai-platform-schema.js';

describe('ai-platform-schema', () => {
  it('defines control-plane tables for org-scoped persistence', () => {
    const tables = [
      'ai_platform_assets',
      'ai_platform_agents',
      'ai_platform_sessions',
      'ai_platform_memory_stores',
      'ai_platform_usage_daily',
      'ai_platform_models',
      'ai_platform_workbench_runs',
      'ai_platform_environments',
      'ai_platform_deployments',
    ];
    for (const table of tables) {
      expect(AI_PLATFORM_SCHEMA).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });
});
