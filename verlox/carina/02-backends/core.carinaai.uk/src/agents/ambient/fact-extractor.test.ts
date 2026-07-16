import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config/index.js';
import { extractChannelFacts } from './fact-extractor.js';
import {
  isDuplicateFact,
  persistChannelFacts,
  queryChannelFacts,
  resetChannelMemoryStoreForTests,
  seedChannelFactForTests,
} from './channel-memory-store.js';
import type { AmbientChannelMessage } from './types.js';

describe('FactExtractor', () => {
  beforeEach(() => {
    config.ambient.signalThreshold = 15;
  });

  afterEach(() => {
    resetChannelMemoryStoreForTests();
    config.ambient.llmExtraction = false;
    vi.restoreAllMocks();
  });

  it('extracts decisions from message batch', async () => {
    const facts = await extractChannelFacts('C1', '#engineering', [
      msg("Let's go with option B and ship Friday."),
    ]);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0]?.type).toBe('decision');
  });

  it('extracts deadlines with dates', async () => {
    const facts = await extractChannelFacts('C1', '#engineering', [
      msg('The deadline is next Friday for the launch.'),
    ]);
    expect(facts.some((f) => f.type === 'deadline')).toBe(true);
  });

  it('extracts person assignments', async () => {
    const facts = await extractChannelFacts('C1', '#engineering', [
      msg('@alex is working on the deployment pipeline this week.'),
    ]);
    expect(facts.some((f) => f.type === 'person_working_on')).toBe(true);
  });

  it('returns empty array for noise messages', async () => {
    const facts = await extractChannelFacts('C1', '#engineering', [msg('lol'), msg('thanks')]);
    expect(facts).toEqual([]);
  });

  it('detects duplicate summaries with jaccard similarity', () => {
    const duplicate = isDuplicateFact(
      {
        type: 'decision',
        summary: 'We decided to launch the feature next week.',
        detail: 'detail',
        confidence: 0.8,
        sourceMessages: [],
        entities: {},
      },
      [{
        id: '1',
        scope: 'channel:C1',
        scopeName: '#eng',
        summary: 'We decided to launch the feature next week.',
        content: 'detail',
        factType: 'decision',
        confidence: 0.9,
        metadata: {},
        extractedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }],
    );
    expect(duplicate).toBe(true);
  });

  it('persists facts to memory with channel scope', async () => {
    await seedChannelFactForTests({
      channelId: 'C-persist-test',
      channelName: '#engineering',
      factType: 'decision',
      summary: 'Ship Friday',
    });
    const stored = await queryChannelFacts({ scope: 'channel:C-persist-test' });
    expect(stored.length).toBeGreaterThan(0);
    expect(stored[0]?.scope).toBe('channel:C-persist-test');
    expect(stored[0]?.scopeName).toBe('#engineering');
  });
});

function highSignalBatch(text: string): AmbientChannelMessage[] {
  return [
    msg(text),
    { ...msg('We agreed and confirmed the plan.'), userId: 'U2', userName: 'Sam' },
    { ...msg('Project sprint release milestone update.'), userId: 'U3', userName: 'Jo' },
  ];
}

function msg(text: string): AmbientChannelMessage {
  return {
    channelId: 'C1',
    channelName: '#engineering',
    userId: 'U1',
    userName: 'Alex',
    text,
    timestamp: new Date().toISOString(),
    isPinned: false,
    hasFiles: false,
    reactions: [],
    permalink: 'https://slack.com/archives/C1/p1',
  };
}
