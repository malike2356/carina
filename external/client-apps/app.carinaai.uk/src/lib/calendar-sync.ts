import { and, eq, gte, isNotNull, lte } from 'drizzle-orm';
import { db } from '@/db';
import { calendarConnections, calendarEvents } from '@/db/schema';
import { fetchCalDavEventsInRange } from '@/lib/caldav-client';
import {
  getWorkspaceCalendarConnection,
  resolveConnectionCredentials,
  resolveEnvCalDavCredentials,
} from '@/lib/calendar-connection';
import { resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';

export async function syncWorkspaceCalendar(workspaceId: string): Promise<{
  imported: number;
  error?: string;
}> {
  const connection = await getWorkspaceCalendarConnection(workspaceId);
  const creds =
    (connection?.enabled ? resolveConnectionCredentials(connection, workspaceId) : null) ??
    resolveEnvCalDavCredentials();

  if (!creds) {
    return { imported: 0, error: 'No CalDAV connection configured.' };
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 4, 0, 23, 59, 59, 999);

  try {
    const coreResult = await syncViaCoreIfAvailable(creds, start, end);
    const remote = coreResult ?? (await fetchCalDavEventsInRange(creds, start, end));
    let imported = 0;

    for (const event of remote.events) {
      const externalUid = event.uid;
      const [existing] = await db
        .select({ id: calendarEvents.id })
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.workspaceId, workspaceId),
            eq(calendarEvents.externalUid, externalUid),
          ),
        )
        .limit(1);

      const values = {
        workspaceId,
        externalUid,
        title: event.summary || 'Event',
        description: event.description ?? null,
        startsAt: event.dtStart,
        endsAt: event.dtEnd ?? null,
        allDay: event.allDay,
        source: 'caldav' as const,
        updatedAt: new Date(),
      };

      if (existing) {
        await db.update(calendarEvents).set(values).where(eq(calendarEvents.id, existing.id));
      } else {
        await db.insert(calendarEvents).values(values);
      }
      imported += 1;
    }

    if (connection) {
      await db
        .update(calendarConnections)
        .set({ lastSyncAt: new Date(), lastSyncError: null, updatedAt: new Date() })
        .where(eq(calendarConnections.id, connection.id));
    }

    return { imported };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (connection) {
      await db
        .update(calendarConnections)
        .set({ lastSyncError: message, updatedAt: new Date() })
        .where(eq(calendarConnections.id, connection.id));
    }
    return { imported: 0, error: message };
  }
}

async function syncViaCoreIfAvailable(
  creds: { url: string; username: string; password: string },
  start: Date,
  end: Date,
): Promise<{ events: Array<{
  uid: string;
  summary: string;
  description?: string;
  dtStart: Date;
  dtEnd?: Date;
  allDay: boolean;
}> } | null> {
  const key = resolveCoreProxyToken();
  if (!key) return null;

  const response = await fetch(`${resolveCoreUrl().replace(/\/$/, '')}/api/calendar/cloud/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': key,
    },
    body: JSON.stringify({
      url: creds.url,
      username: creds.username,
      password: creds.password,
      start: start.toISOString(),
      end: end.toISOString(),
    }),
  });

  if (!response.ok) return null;
  const json = (await response.json()) as {
    events?: Array<{
      uid: string;
      summary: string;
      description?: string;
      dtStart: string;
      dtEnd?: string;
      allDay?: boolean;
    }>;
  };

  if (!Array.isArray(json.events)) return null;
  return {
    events: json.events.map((event) => ({
      uid: event.uid,
      summary: event.summary,
      description: event.description,
      dtStart: new Date(event.dtStart),
      dtEnd: event.dtEnd ? new Date(event.dtEnd) : undefined,
      allDay: Boolean(event.allDay),
    })),
  };
}

export async function listStoredEventsInRange(
  workspaceId: string,
  start: Date,
  end: Date,
) {
  return db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.workspaceId, workspaceId),
        gte(calendarEvents.startsAt, start),
        lte(calendarEvents.startsAt, end),
        isNotNull(calendarEvents.startsAt),
      ),
    );
}
