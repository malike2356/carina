/**
 * Social proof collect → curate → publish tests.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TestimonialStore,
  approve,
  collectFromPrimaryPlatforms,
  collectFromTwitter,
  curateTop,
  manualEntry,
  renderProofPageHtml,
  resetScheduleForTests,
  runWeeklyCollection,
} from './index.js';

const fixturesPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/sample-collect.json');

describe('social proof library', () => {
  beforeEach(() => {
    resetScheduleForTests();
  });

  it('collects from three platforms via fixtures, curates, and renders /proof html', async () => {
    const store = new TestimonialStore();
    const results = await collectFromPrimaryPlatforms(store, {
      fixturesPath,
      product: 'keprix',
    });
    expect(results).toHaveLength(3);
    expect(results.reduce((n, r) => n + r.added, 0)).toBeGreaterThanOrEqual(3);

    // duplicate collect should not double
    const again = await collectFromTwitter('ops_lead_demo', store, { fixturesPath });
    expect(again.duplicates).toBeGreaterThanOrEqual(1);

    const pending = store.list({ status: 'pending' });
    expect(pending.length).toBeGreaterThanOrEqual(3);
    const firstThree = pending.slice(0, 3);
    for (const row of firstThree) {
      approve(store, row.id);
      expect(store.get(row.id)?.status).toBe('approved');
    }

    const approved = store.list({ status: 'approved' });
    expect(approved).toHaveLength(3);
    const top = curateTop(approved, 'all', 10);
    expect(top.length).toBe(3);

    const html = renderProofPageHtml(
      { testimonials: approved, logos: [{ name: 'Acme' }], metrics: [{ label: 'teams', value: '12' }], press: [], videos: [] },
      { brand: 'Keprix', canonicalUrl: 'https://keprixai.com/proof' },
    );
    expect(html).toContain('/proof');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"Review"');
    expect(html).not.toMatch(/\b(carousel|swiper|slider)\b/i);
    for (const row of approved) {
      expect(html).toContain(row.text);
      expect(html).toContain(row.url);
    }
  });

  it('manual entry requires source url and weekly schedule runs once', async () => {
    const store = new TestimonialStore();
    expect(() =>
      manualEntry(store, {
        text: 'Great',
        author: 'A',
        link: '',
      }),
    ).toThrow(/source URL/i);

    const item = manualEntry(store, {
      text: 'Exact quote for support quality.',
      author: 'Sam',
      link: 'https://example.com/thread/1',
      product: 'carina',
    });
    expect(item.status).toBe('pending');
    expect(item.url).toContain('https://');

    const first = await runWeeklyCollection(store, { fixturesPath, force: true });
    expect(first.ran).toBe(true);
    const second = await runWeeklyCollection(store, { fixturesPath, force: false });
    expect(second.ran).toBe(false);
  });
});
