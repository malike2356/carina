import type { BlogIncident, IncidentCategory } from './types.js';

export const INCIDENTS_PER_PAGE = 8;

const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  financial: 'Financial',
  security: 'Security',
  brand: 'Brand',
  legal: 'Legal',
};

export function categoryLabel(category: IncidentCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function sortPublishedIncidents(incidents: BlogIncident[]): BlogIncident[] {
  return [...incidents].sort((a, b) => {
    const aTime = (a.publishedAt ?? a.createdAt).getTime();
    const bTime = (b.publishedAt ?? b.createdAt).getTime();
    return bTime - aTime;
  });
}

export function paginateIncidents(incidents: BlogIncident[], pageSize = INCIDENTS_PER_PAGE): BlogIncident[][] {
  const pages: BlogIncident[][] = [];
  for (let i = 0; i < incidents.length; i += pageSize) {
    pages.push(incidents.slice(i, i + pageSize));
  }
  return pages.length ? pages : [[]];
}

export function incidentYear(incident: BlogIncident): string {
  const fromPublished = incident.publishedAt?.getFullYear();
  if (fromPublished) return String(fromPublished);
  const match = incident.dateOccurred.match(/20\d{2}/);
  if (match) return match[0];
  return String(incident.createdAt.getFullYear());
}

export function groupIncidentsByYear(incidents: BlogIncident[]): Map<string, BlogIncident[]> {
  const grouped = new Map<string, BlogIncident[]>();
  for (const incident of sortPublishedIncidents(incidents)) {
    const year = incidentYear(incident);
    const bucket = grouped.get(year) ?? [];
    bucket.push(incident);
    grouped.set(year, bucket);
  }
  return grouped;
}

export function excerptFromHtml(html: string, maxLen = 180): string {
  const plain = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen - 1).trim()}…`;
}

export function listPageHref(page: number): string {
  if (page <= 1) return '/incidents/';
  return `/incidents/page/${page}/`;
}

export function archiveYearHref(year: string): string {
  return `/incidents/archive/${year}/`;
}

export function incidentHref(slug: string): string {
  return `/incidents/${slug}/`;
}
