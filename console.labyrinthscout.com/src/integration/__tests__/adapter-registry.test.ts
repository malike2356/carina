import { describe, expect, it } from 'vitest';
import { registerAdapter, resetAdapters, resolveAdapter } from '../adapter-registry.js';
import type { IAgentAdapter, NormalizedRequest, NormalizedResponse } from '../agent-adapter.interface.js';

describe('adapter registry', () => {
  it('resolves built-in adapters and falls back to generic', () => {
    resetAdapters();
    expect(resolveAdapter('openai').agentType).toBe('openai');
    expect(resolveAdapter('missing').agentType).toBe('generic');
  });

  it('registers custom adapters by agentType', () => {
    const adapter: IAgentAdapter = {
      agentType: 'custom',
      parseRequest: (raw): NormalizedRequest => ({ agentType: 'custom', prompt: 'x', messages: [], toolCalls: [], raw }),
      parseResponse: (raw): NormalizedResponse => ({ agentType: 'custom', content: 'x', toolCalls: [], raw }),
      formatResponse: (response) => response.raw,
      extractToolCalls: () => [],
    };
    registerAdapter(adapter);
    expect(resolveAdapter('custom')).toBe(adapter);
  });
});
