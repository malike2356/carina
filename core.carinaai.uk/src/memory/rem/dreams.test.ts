import { describe, expect, it } from 'vitest';
import { renderDreamsMarkdown } from './dreams.js';
import type { PromotionQueueRow } from './rem-promotion.js';

describe('DREAMS.md renderer', () => {
  it('renders pending promotions with approve hints', () => {
    const pending: PromotionQueueRow[] = [{
      id: '11111111-1111-1111-1111-111111111111',
      episodeId: '22222222-2222-2222-2222-222222222222',
      proposedContent: 'User prefers Telegram delivery for alerts.',
      proposedTarget: 'memory',
      score: 0.81,
      rationale: 'score=0.81; fact-like phrasing',
      status: 'pending',
      createdAt: new Date('2026-06-10T12:00:00Z'),
    }];

    const md = renderDreamsMarkdown(pending);
    expect(md).toContain('# DREAMS.md');
    expect(md).toContain('User prefers Telegram delivery');
    expect(md).toContain('promote approve 11111111');
  });

  it('renders empty queue guidance', () => {
    const md = renderDreamsMarkdown([]);
    expect(md).toContain('No pending promotions');
  });
});
