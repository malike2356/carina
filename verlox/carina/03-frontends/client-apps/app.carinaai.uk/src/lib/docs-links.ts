export const WHITE_LABEL_DOCS_BASE =
  process.env.NEXT_PUBLIC_CARINA_DOCS_URL?.trim() || 'https://docs.carinaai.uk';

export function whiteLabelDocPath(slug: string): string {
  const base = WHITE_LABEL_DOCS_BASE.replace(/\/$/, '');
  const path = slug.startsWith('/') ? slug : `/docs/user/white-label/${slug}`;
  return `${base}${path}`;
}

export const AIVA_QUICKSTART_DOC = 'https://docs.carinaai.uk/aiva/quickstart';
export const AIVA_SUPPORT_EMAIL = 'support@carinaai.uk';

export function supportMailto(subject: string): string {
  return `mailto:${AIVA_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
