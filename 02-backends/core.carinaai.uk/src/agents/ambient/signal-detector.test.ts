import { describe, expect, it } from 'vitest';
import { heuristicFactsFromBatch, scoreChannelBatch } from './signal-detector.js';
import type { AmbientChannelMessage } from './types.js';

describe('SignalDetector', () => {
  it('scores decision messages highly', () => {
    const score = scoreChannelBatch('C1', [msg("Let's go with option B and ship Friday.")]);
    expect(score.score).toBeGreaterThanOrEqual(20);
    expect(score.triggers).toContain('decision');
  });

  it('scores deadline messages highly', () => {
    const score = scoreChannelBatch('C1', [msg('The deadline is next Friday for the launch.')]);
    expect(score.score).toBeGreaterThanOrEqual(25);
    expect(score.triggers).toContain('deadline');
  });

  it('scores small talk low', () => {
    const score = scoreChannelBatch('C1', [msg('lol'), msg('thanks')]);
    expect(score.score).toBeLessThan(20);
  });

  it('adds bonus for pinned messages', () => {
    const plain = scoreChannelBatch('C1', [msg('Status update on rollout')]);
    const pinned = scoreChannelBatch('C1', [{ ...msg('Status update on rollout'), isPinned: true }]);
    expect(pinned.score).toBeGreaterThan(plain.score);
  });

  it('adds penalty for very short messages', () => {
    const long = scoreChannelBatch('C1', [msg('We decided to launch the feature next week with full QA.')]);
    const short = scoreChannelBatch('C1', [msg('ok'), msg('yes')]);
    expect(long.score).toBeGreaterThan(short.score);
  });

  it('scores multi-user conversations higher', () => {
    const solo = scoreChannelBatch('C1', [msg('We decided to ship Friday.')]);
    const group = scoreChannelBatch('C1', [
      { ...msg('We decided to ship Friday.'), userId: 'U1' },
      { ...msg('I will handle QA.'), userId: 'U2' },
      { ...msg('I will update docs.'), userId: 'U3' },
    ]);
    expect(group.score).toBeGreaterThanOrEqual(solo.score);
  });
});

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
