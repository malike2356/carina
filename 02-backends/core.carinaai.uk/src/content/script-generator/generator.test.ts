import { describe, expect, it } from 'vitest';
import {
  CHANNEL_DOMAIN_IDS,
  CHANNEL_NICHE_IDS,
  PROPERTY_NICHE_IDS,
  listDomains,
  listNiches,
  nicheBelongsToDomain,
  getNiche,
} from './niches.js';
import {
  assertUniqueCalendar,
  generateScript,
  generateYearCalendar,
  generateYearCalendarBatch,
} from './generator.js';

describe('script generator: niches', () => {
  it('mirrors Aiva personas with at least 40 domains and five niches each (property keeps rich pack)', () => {
    expect(CHANNEL_DOMAIN_IDS.length).toBeGreaterThanOrEqual(40);
    expect(PROPERTY_NICHE_IDS.length).toBe(9);
    expect(listNiches('property').length).toBe(9);
    expect(listDomains().map((d) => d.id)).toEqual([...CHANNEL_DOMAIN_IDS]);
    for (const domainId of CHANNEL_DOMAIN_IDS) {
      if (domainId === 'property') continue;
      expect(listNiches(domainId).length).toBe(5);
    }
    expect(CHANNEL_NICHE_IDS.length).toBeGreaterThanOrEqual(200);
    expect(nicheBelongsToDomain('buy-to-let-investment', 'property')).toBe(true);
    expect(nicheBelongsToDomain('language-learning-daily-practice', 'language-learning')).toBe(true);
  });

  it.each([
    ...PROPERTY_NICHE_IDS.slice(0, 3),
    'customer-support-ticket-triage',
    'personal-coach-habit-systems',
    'language-learning-daily-practice',
    'sales-assistant-discovery-calls',
  ] as const)('generates a valid script for niche %s', (niche) => {
    const item = generateScript({
      niche,
      location: 'Manchester',
      dayIndex: 0,
      date: '2026-01-01',
      theme: 'Test theme',
    });

    expect(getNiche(niche).id).toBe(niche);
    expect(item.title.length).toBeGreaterThan(0);
    expect(item.title.length).toBeLessThanOrEqual(100);
    expect(item.description.split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(150);
    expect(item.tags.length).toBeGreaterThanOrEqual(10);
    expect(item.tags.length).toBeLessThanOrEqual(20);
    expect(item.thumbnailPrompt.length).toBeGreaterThan(0);
    expect(item.script.sections.map((s) => s.label)).toEqual(['hook', 'body', 'cta']);
    expect(item.script.estimatedDurationSeconds).toBeGreaterThanOrEqual(180);
    expect(item.script.estimatedDurationSeconds).toBeLessThanOrEqual(300);
  });
});

describe('script generator: year calendar batches', () => {
  it('generates a batch without generating other days', () => {
    const batch = generateYearCalendarBatch(
      { niche: 'buy-to-let-investment', location: 'Leeds', startDate: '2026-01-01' },
      0,
      10,
    );
    expect(batch.length).toBe(10);
    expect(batch[0]!.dayIndex).toBe(0);
    expect(batch[9]!.dayIndex).toBe(9);
  });

  it('generates 365 unique videos with no near-identical content', () => {
    const items = generateYearCalendar(
      { niche: 'buy-to-let-investment', location: 'Leeds', startDate: '2026-01-01' },
      30,
    );
    expect(items.length).toBe(365);
    expect(() => assertUniqueCalendar(items)).not.toThrow();

    const fullTexts = new Set(items.map((i) => i.script.fullText));
    expect(fullTexts.size).toBe(365);
  });
});
