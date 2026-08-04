import { describe, expect, it, vi } from 'vitest';

vi.mock('../agents/kanban-service.js', () => ({
  addComment: vi.fn(),
  createBoardCard: vi.fn(),
  patchCard: vi.fn(),
  transitionCard: vi.fn(),
}));

describe('Jakstar outreach smoke', () => {
  it('walks the outreach loop end to end on local state', async () => {
    const { runJakstarOutreachSmoke } = await import('./jakstar-smoke.js');
    const report = runJakstarOutreachSmoke('ws-smoke', new Date('2026-08-04T10:00:00.000Z'));
    expect(report.steps.every((step) => step.ok)).toBe(true);
    expect(report.steps.map((step) => step.name)).toEqual([
      'lead-created',
      'company-number-dedupe',
      'send-queued',
      'reply-recorded',
      'booking-created',
      'reminders-available',
      'booking-attended',
      'pause-blocks-sends',
      'unsubscribe-stops',
    ]);
  });
});
