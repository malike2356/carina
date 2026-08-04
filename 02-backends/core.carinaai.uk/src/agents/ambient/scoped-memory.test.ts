import { afterEach, describe, expect, it } from 'vitest';
import { buildChannelContextSection } from './channel-context-prompt.js';
import {
  persistChannelFacts,
  purgeChannelMemory,
  queryChannelFacts,
  resetChannelMemoryStoreForTests,
} from './channel-memory-store.js';
import { config } from '../../config/index.js';

describe('Scoped Memory', () => {
  afterEach(() => {
    resetChannelMemoryStoreForTests();
    config.ambient.crossChannel = false;
  });

  it('stores facts with channel scope', async () => {
    await persistChannelFacts('C1', '#eng', [{
      type: 'decision',
      summary: 'Ship Friday',
      detail: 'Ship Friday',
      confidence: 0.9,
      sourceMessages: [],
      entities: {},
    }]);
    const facts = await queryChannelFacts({ scope: 'channel:C1' });
    expect(facts[0]?.scope).toBe('channel:C1');
  });

  it('queries facts by exact scope', async () => {
    await persistChannelFacts('C1', '#eng', [{
      type: 'decision', summary: 'A', detail: 'A', confidence: 0.9, sourceMessages: [], entities: {},
    }]);
    await persistChannelFacts('C2', '#sales', [{
      type: 'decision', summary: 'B', detail: 'B', confidence: 0.9, sourceMessages: [], entities: {},
    }]);
    const facts = await queryChannelFacts({ scope: 'channel:C1' });
    expect(facts.every((f) => f.scope === 'channel:C1')).toBe(true);
  });

  it('excludes scope with scopeNot', async () => {
    await persistChannelFacts('C1', '#eng', [{
      type: 'decision', summary: 'A', detail: 'A', confidence: 0.9, sourceMessages: [], entities: {},
    }]);
    await persistChannelFacts('C2', '#sales', [{
      type: 'decision', summary: 'B', detail: 'B', confidence: 0.9, sourceMessages: [], entities: {},
    }]);
    const facts = await queryChannelFacts({ scopeNot: 'channel:C1', scopePrefix: 'channel:' });
    expect(facts.every((f) => f.scope !== 'channel:C1')).toBe(true);
  });

  it('builds channel context section for system prompt', async () => {
    await persistChannelFacts('C1', '#eng', [{
      type: 'deadline',
      summary: 'Launch Friday',
      detail: 'Launch Friday',
      confidence: 0.9,
      sourceMessages: [],
      entities: { dates: ['2026-06-27'] },
    }]);
    const section = await buildChannelContextSection('C1', '#eng');
    expect(section).toContain('Channel Context');
    expect(section).toContain('Launch Friday');
  });

  it('purges channel memory on GDPR request', async () => {
    await persistChannelFacts('C1', '#eng', [{
      type: 'decision', summary: 'A', detail: 'A', confidence: 0.9, sourceMessages: [], entities: {},
    }]);
    const removed = await purgeChannelMemory('C1');
    expect(removed).toBeGreaterThan(0);
    expect(await queryChannelFacts({ scope: 'channel:C1' })).toEqual([]);
  });
});
