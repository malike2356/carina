import { describe, expect, it } from 'vitest';
import type { AgentsConfig } from './types.js';
import { resolveAgentRoute } from './agent-routing.js';

const config: AgentsConfig = {
  version: 1,
  agents: [
    { id: 'main', name: 'Main', default: true, workspace: '/tmp/ws-main' },
    { id: 'work', name: 'Work', workspace: '/tmp/ws-work' },
    { id: 'family', name: 'Family', workspace: '/tmp/ws-family' },
  ],
  bindings: [
    {
      agentId: 'family',
      match: { channel: 'whatsapp', peer: { kind: 'group', id: '120363@g.us' } },
    },
    { agentId: 'work', match: { channel: 'whatsapp', accountId: 'biz' } },
    { agentId: 'main', match: { channel: 'whatsapp', accountId: '*' } },
    { agentId: 'work', match: { channel: 'telegram' } },
  ],
};

describe('agent-routing', () => {
  it('prefers peer match over account match', () => {
    const result = resolveAgentRoute({
      channel: 'whatsapp',
      accountId: 'biz',
      peerKind: 'group',
      peerId: '120363@g.us',
    }, config);
    expect(result.agent.id).toBe('family');
    expect(result.tier).toBe('peer');
  });

  it('routes by account when no peer match', () => {
    const result = resolveAgentRoute({
      channel: 'whatsapp',
      accountId: 'biz',
      peerKind: 'direct',
      peerId: '+15551230001',
    }, config);
    expect(result.agent.id).toBe('work');
  });

  it('falls back to channel wildcard', () => {
    const result = resolveAgentRoute({
      channel: 'whatsapp',
      accountId: 'personal',
      peerKind: 'direct',
      peerId: '+15551239999',
    }, config);
    expect(result.agent.id).toBe('main');
  });

  it('routes telegram to work agent', () => {
    const result = resolveAgentRoute({ channel: 'telegram', accountId: 'default' }, config);
    expect(result.agent.id).toBe('work');
  });
});
