import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import { emailMessages } from '@/db/schema';

export const EMAIL_STATUSES = ['inbox', 'archived', 'spam', 'draft_reply', 'sent'] as const;
export const EMAIL_URGENCIES = ['low', 'normal', 'high', 'spam'] as const;
export const EMAIL_SOURCES = ['aiva', 'google', 'local'] as const;

export type EmailStatus = (typeof EMAIL_STATUSES)[number];
export type EmailUrgency = (typeof EMAIL_URGENCIES)[number];
export type EmailSource = (typeof EMAIL_SOURCES)[number];

export type EmailListFilters = {
  workspaceId: string;
  status?: string | null;
  urgency?: string | null;
  source?: string | null;
  q?: string | null;
  from?: string | null;
  to?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
  offset?: number;
};

function parseDayStart(value: string): Date | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function buildEmailListQuery(filters: EmailListFilters): {
  where: SQL;
  limit: number;
  offset: number;
} {
  const conditions: SQL[] = [eq(emailMessages.workspaceId, filters.workspaceId)];

  const status = filters.status?.trim();
  if (status && (EMAIL_STATUSES as readonly string[]).includes(status)) {
    conditions.push(eq(emailMessages.status, status));
  }

  const urgency = filters.urgency?.trim();
  if (urgency && (EMAIL_URGENCIES as readonly string[]).includes(urgency)) {
    conditions.push(eq(emailMessages.urgency, urgency));
  }

  const source = filters.source?.trim().toLowerCase();
  if (source && (EMAIL_SOURCES as readonly string[]).includes(source)) {
    conditions.push(eq(emailMessages.source, source));
  }

  const from = filters.from?.trim();
  if (from) {
    conditions.push(ilike(emailMessages.fromAddress, `%${from}%`));
  }

  const to = filters.to?.trim();
  if (to) {
    conditions.push(ilike(emailMessages.toAddress, `%${to}%`));
  }

  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        ilike(emailMessages.subject, pattern),
        ilike(emailMessages.bodyPreview, pattern),
        ilike(emailMessages.bodyFull, pattern),
        ilike(emailMessages.fromAddress, pattern),
        ilike(emailMessages.toAddress, pattern),
      )!,
    );
  }

  if (filters.dateFrom?.trim()) {
    const fromDate = parseDayStart(filters.dateFrom.trim());
    if (fromDate) conditions.push(gte(emailMessages.receivedAt, fromDate));
  }

  if (filters.dateTo?.trim()) {
    const toDate = parseDayStart(filters.dateTo.trim());
    if (toDate) {
      // Inclusive end-of-day when date-only string (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo.trim())) {
        toDate.setHours(23, 59, 59, 999);
      }
      conditions.push(lte(emailMessages.receivedAt, toDate));
    }
  }

  const limit = Math.min(100, Math.max(1, Number(filters.limit ?? 50) || 50));
  const offset = Math.max(0, Number(filters.offset ?? 0) || 0);

  return {
    where: and(...conditions)!,
    limit,
    offset,
  };
}

export { desc, emailMessages, sql };
