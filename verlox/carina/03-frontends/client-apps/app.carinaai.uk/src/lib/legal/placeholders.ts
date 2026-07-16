const DEFAULT_COMPANY_NAME = 'VERLOX LTD';
const DEFAULT_SUPPORT_EMAIL = 'hello@carinaai.uk';

export function applyLegalPlaceholders(markdown: string, effectiveDate?: string): string {
  const replacements: Record<string, string> = {
    '{{COMPANY_NAME}}': process.env.VERLOX_LEGAL_COMPANY_NAME?.trim() || DEFAULT_COMPANY_NAME,
    '{{SUPPORT_EMAIL}}': process.env.CARINA_SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL,
    '{{EFFECTIVE_DATE}}':
      effectiveDate
      ?? process.env.VERLOX_LEGAL_EFFECTIVE_DATE?.trim()
      ?? '2026-06-30',
  };
  return Object.entries(replacements).reduce(
    (content, [placeholder, value]) => content.replaceAll(placeholder, value),
    markdown,
  );
}
