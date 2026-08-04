import { describe, expect, it } from 'vitest';
import { detectExtensionConflicts, formatExtensionConflicts } from './conflicts.js';
import { registry } from '../tools/registry.js';

describe('extension conflicts', () => {
  it('detects tool name collisions with core registry', () => {
    registry.register({
      name: 'collision-tool',
      description: 'core',
      parameters: { type: 'object', properties: {} },
      execute: async () => ({}),
    });
    const conflicts = detectExtensionConflicts('demo-ext', {
      toolNames: ['collision-tool'],
    });
    expect(conflicts.length).toBeGreaterThan(0);
    expect(formatExtensionConflicts(conflicts)).toContain('collision-tool');
    registry.unregister('collision-tool');
  });

  it('allows prefixed extension tool names', () => {
    const conflicts = detectExtensionConflicts('demo-ext', {
      toolNames: ['ext_demo_ext_active_memory'],
    });
    expect(conflicts).toHaveLength(0);
  });
});
