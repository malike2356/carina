import type { EmailDigest } from '../../bridges/propreneur-bridge.types.js';

const AMOUNT_RE = /(?:£|GBP\s?)([\d,]+(?:\.\d{2})?)/gi;
const DATE_RE = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/gi;
const PROPERTY_RE = /\b(?:flat|unit|apt|apartment|property|room)\s*[#:]?\s*(\d+[a-z]?)\b/i;

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function inferRole(fromAddress: string, roleTag?: string | null): string {
  if (roleTag && roleTag !== 'other') return roleTag;
  const lower = fromAddress.toLowerCase();
  if (lower.includes('account') || lower.includes('finance')) return 'accountant';
  if (lower.includes('manage') || lower.includes('agent')) return 'property_manager';
  return roleTag ?? 'other';
}

function firstLines(text: string, max = 3): string {
  return text.split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, max).join(' ');
}

export function parseEmailDigest(input: {
  from: string;
  subject: string;
  body: string;
  roleTag?: string | null;
}): EmailDigest {
  const rawText = stripHtml(`${input.subject}\n\n${input.body}`.trim());
  const amounts = [...rawText.matchAll(AMOUNT_RE)].map((m) => m[0].trim()).slice(0, 10);
  const dates = [...rawText.matchAll(DATE_RE)].map((m) => m[0].trim()).slice(0, 10);
  const propertyMatch = rawText.match(PROPERTY_RE);
  const propertyRef = propertyMatch?.[1] ?? null;
  const role = inferRole(input.from, input.roleTag ?? null);
  const actionRequired = /\b(urgent|action required|please confirm|overdue|asap)\b/i.test(rawText);

  return {
    from: input.from,
    role,
    propertyRef,
    amounts,
    dates,
    summary: firstLines(rawText, 3) || input.subject || 'Email received',
    actionRequired,
    rawText: rawText.slice(0, 8000),
  };
}
