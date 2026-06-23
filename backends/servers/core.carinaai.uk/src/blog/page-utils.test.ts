import { describe, expect, it } from 'vitest';
import type { BlogIncident } from './types.js';
import {
  groupIncidentsByYear,
  incidentHref,
  listPageHref,
  paginateIncidents,
  sortPublishedIncidents,
} from './page-utils.js';

function sample(id: string, publishedAt: Date, dateOccurred = ''): BlogIncident {
  return {
    id,
    title: `Title ${id}`,
    slug: `slug-${id}`,
    company: 'Example Co',
    damage: '$1',
    category: 'security',
    dateOccurred: dateOccurred || String(publishedAt.getFullYear()),
    bodyHtml: '<p>Body</p>',
    sources: [],
    scoutFixHtml: 'Fix',
    status: 'published',
    publishedAt,
    createdAt: publishedAt,
    updatedAt: publishedAt,
    approvedBy: null,
    approvedAt: null,
    newsletterSent: false,
    newsletterSentAt: null,
    rejectionReason: null,
  };
}

describe('page-utils', () => {
  it('sorts newest published incidents first', () => {
    const sorted = sortPublishedIncidents([
      sample('a', new Date('2024-01-01')),
      sample('b', new Date('2026-06-01')),
    ]);
    expect(sorted.map((row) => row.id)).toEqual(['b', 'a']);
  });

  it('paginates incidents', () => {
    const rows = Array.from({ length: 9 }, (_, index) => sample(String(index), new Date('2026-01-01')));
    const pages = paginateIncidents(rows, 8);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(8);
    expect(pages[1]).toHaveLength(1);
  });

  it('groups incidents by year', () => {
    const grouped = groupIncidentsByYear([
      sample('a', new Date('2024-05-01')),
      sample('b', new Date('2026-01-01')),
    ]);
    expect([...grouped.keys()]).toEqual(['2026', '2024']);
  });

  it('builds stable public paths', () => {
    expect(listPageHref(1)).toBe('/incidents/');
    expect(listPageHref(3)).toBe('/incidents/page/3/');
    expect(incidentHref('air-canada-chatbot')).toBe('/incidents/air-canada-chatbot/');
  });
});
