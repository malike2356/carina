import { describe, expect, it, vi } from 'vitest';

vi.mock('../../brain/llm.js', () => ({
  llm: {
    chatCheap: vi.fn(async () => ({
      content: JSON.stringify({
        hook: 'Manchester buy to let is shifting this year.',
        body: [
          'First, look at yields against mortgage rates.',
          'Next, stress test void periods.',
          'Then, check EPC upgrade costs.',
          'Finally, map agent demand in your postcode.',
        ],
        cta: 'Subscribe for daily UK property breakdowns.',
        estimatedDurationSeconds: 210,
      }),
      model: 'mock-llm',
    })),
  },
}));

describe('llm-scripts', () => {
  it('template mode is deterministic', async () => {
    process.env.PROPERTY_CHANNEL_SCRIPT_MODE = 'template';
    const { generateScriptItem, resolveScriptMode } = await import('./llm-scripts.js');
    expect(resolveScriptMode()).toBe('template');
    const a = await generateScriptItem({
      niche: 'buy-to-let-investment',
      location: 'Manchester',
      dayIndex: 3,
      date: '2026-08-04',
      theme: 'Yields',
    }, 'template');
    const b = await generateScriptItem({
      niche: 'buy-to-let-investment',
      location: 'Manchester',
      dayIndex: 3,
      date: '2026-08-04',
      theme: 'Yields',
    }, 'template');
    expect(a.title).toBe(b.title);
    expect(a.script.fullText).toBe(b.script.fullText);
    expect(a.script.sections).toHaveLength(3);
    expect(a.scriptMode).toBe('template');
  });

  it('llm mode validates schema when mocked', async () => {
    process.env.PROPERTY_CHANNEL_SCRIPT_MODE = 'llm';
    const { generateScriptItem } = await import('./llm-scripts.js');
    const item = await generateScriptItem({
      niche: 'buy-to-let-investment',
      location: 'Manchester',
      dayIndex: 1,
      date: '2026-08-04',
      theme: 'Cash flow',
    }, 'llm');
    expect(item.script.sections[0]?.label).toBe('hook');
    expect(item.script.sections[1]?.label).toBe('body');
    expect(item.script.sections[2]?.label).toBe('cta');
    expect(item.script.estimatedDurationSeconds).toBeGreaterThanOrEqual(150);
    expect(item.title.length).toBeLessThanOrEqual(100);
    expect(item.tags.length).toBeGreaterThanOrEqual(5);
    expect(item.model).toBeTruthy();
    expect(item.promptVersion).toBeTruthy();
  });
});
