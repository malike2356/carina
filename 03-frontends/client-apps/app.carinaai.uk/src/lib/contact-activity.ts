import 'server-only';

import { and, desc, eq, gte, ilike, lte, or } from 'drizzle-orm';
import { db } from '@/db';
import { calendarEvents, emailMessages } from '@/db/schema';

export type ContactActivityKind = 'email' | 'meeting';

export type ContactActivityItem = {
  id: string;
  kind: ContactActivityKind;
  at: string;
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
};

export type ContactActivityResult = {
  items: ContactActivityItem[];
  counts: { email: number; meeting: number; total: number };
  match: { email: string | null; name: string | null; phone: string | null };
};

function extractEmail(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const angle = raw.match(/<([^>]+@[^>]+)>/);
  const candidate = (angle?.[1] ?? raw).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) return null;
  return candidate;
}

function digitsOnly(value: string | null | undefined): string | null {
  const digits = String(value ?? '').replace(/\D+/g, '');
  return digits.length >= 7 ? digits : null;
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

export async function queryContactActivity(input: {
  workspaceId: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  limit?: number;
}): Promise<ContactActivityResult> {
  const limit = Math.min(80, Math.max(1, input.limit ?? 40));
  const email = extractEmail(input.email);
  const name = String(input.name ?? '').trim();
  const phone = digitsOnly(input.phone);
  const nameToken = name.length >= 3 ? name : '';

  const emailItems: ContactActivityItem[] = [];
  if (email) {
    const pattern = `%${escapeLike(email)}%`;
    const rows = await db
      .select({
        id: emailMessages.id,
        subject: emailMessages.subject,
        fromAddress: emailMessages.fromAddress,
        toAddress: emailMessages.toAddress,
        status: emailMessages.status,
        receivedAt: emailMessages.receivedAt,
      })
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.workspaceId, input.workspaceId),
          or(
            ilike(emailMessages.fromAddress, pattern),
            ilike(emailMessages.toAddress, pattern),
          ),
        ),
      )
      .orderBy(desc(emailMessages.receivedAt))
      .limit(limit);

    for (const row of rows) {
      const from = extractEmail(row.fromAddress) ?? row.fromAddress;
      const direction = email && from === email ? 'Inbound' : 'Outbound';
      emailItems.push({
        id: `email:${row.id}`,
        kind: 'email',
        at: row.receivedAt.toISOString(),
        title: row.subject?.trim() || '(No subject)',
        subtitle: `${direction} · ${row.fromAddress}${row.toAddress ? ` → ${row.toAddress}` : ''}`,
        href: `/email?focus=${encodeURIComponent(row.id)}`,
        meta: row.status,
      });
    }
  }

  const meetingItems: ContactActivityItem[] = [];
  const meetingClauses = [];
  if (email) {
    const pattern = `%${escapeLike(email)}%`;
    meetingClauses.push(ilike(calendarEvents.title, pattern), ilike(calendarEvents.description, pattern));
  }
  if (nameToken) {
    const pattern = `%${escapeLike(nameToken)}%`;
    meetingClauses.push(ilike(calendarEvents.title, pattern), ilike(calendarEvents.description, pattern));
  }
  if (phone) {
    const pattern = `%${escapeLike(phone)}%`;
    meetingClauses.push(ilike(calendarEvents.title, pattern), ilike(calendarEvents.description, pattern));
  }

  if (meetingClauses.length > 0) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 180);
    const until = new Date();
    until.setUTCDate(until.getUTCDate() + 90);

    const rows = await db
      .select({
        id: calendarEvents.id,
        title: calendarEvents.title,
        description: calendarEvents.description,
        startsAt: calendarEvents.startsAt,
        endsAt: calendarEvents.endsAt,
        allDay: calendarEvents.allDay,
        source: calendarEvents.source,
      })
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.workspaceId, input.workspaceId),
          gte(calendarEvents.startsAt, since),
          lte(calendarEvents.startsAt, until),
          or(...meetingClauses),
        ),
      )
      .orderBy(desc(calendarEvents.startsAt))
      .limit(limit);

    const now = Date.now();
    for (const row of rows) {
      const upcoming = row.startsAt.getTime() >= now;
      meetingItems.push({
        id: `meeting:${row.id}`,
        kind: 'meeting',
        at: row.startsAt.toISOString(),
        title: row.title?.trim() || 'Untitled meeting',
        subtitle: row.allDay
          ? 'All day'
          : `${upcoming ? 'Upcoming' : 'Past'} · ${row.startsAt.toLocaleString()}`,
        href: `/calendar?event=${encodeURIComponent(row.id)}`,
        meta: row.source,
      });
    }
  }

  const items = [...emailItems, ...meetingItems].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return {
    items: items.slice(0, limit),
    counts: {
      email: emailItems.length,
      meeting: meetingItems.length,
      total: items.length,
    },
    match: {
      email,
      name: nameToken || null,
      phone,
    },
  };
}
