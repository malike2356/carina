export const WHITE_LABEL_DOCS_BASE =
  process.env.NEXT_PUBLIC_CARINA_DOCS_URL?.trim() || 'https://docs.carinaai.uk';

export function whiteLabelDocPath(slug: string): string {
  const base = WHITE_LABEL_DOCS_BASE.replace(/\/$/, '');
  const path = slug.startsWith('/') ? slug : `/docs/user/white-label/${slug}`;
  return `${base}${path}`;
}
