import { describe, expect, it } from 'vitest';
import type { AgentsConfig } from './types.js';
import { buildRouteExplanation } from './routing-explain.js';

const config: AgentsConfig = {
  version: 1,
  agents: [
    { id: 'main', name: 'Main', default: true, workspace: '/tmp/ws-main' },
    { id: 'work', name: 'Work', workspace: '/tmp/ws-work' },
  ],
  bindings: [
    { agentId: 'work', match: { channel: 'telegram' }, label: 'work telegram' },
    { agentId: 'main', match: { channel: '*' }, label: 'default fallback' },
  ],
};

describe('routing-explain', () => {
  it('builds structured route explanation', () => {
    const details = buildRouteExplanation({ channel: 'telegram' }, config);
    expect(details.result.agent.id).toBe('work');
    expect(details.result.tier).toBe('channel');
    expect(details.description).toContain('agent=work');
    expect(details.precedence.length).toBeGreaterThan(0);
  });
});
