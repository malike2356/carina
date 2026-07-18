import { and, eq, gte, isNotNull, lte } from 'drizzle-orm';
import { db } from '@/db';
import { calendarConnections, calendarEvents } from '@/db/schema';
import { fetchCalDavEventsInRange } from '@/lib/caldav-client';
import {
  getWorkspaceCalendarConnection,
  resolveConnectionCredentials,
  resolveEnvCalDavCredentials,
  resolveGoogleConnectionCredentials,
} from '@/lib/calendar-connection';
import { fetchGoogleCalendarEventsInRange } from '@/lib/google-calendar-client';
import { resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';

type RemoteEvent = {
  uid: string;
  summary: string;
  description?: string;
  dtStart: Date;
  dtEnd?: Date;
  allDay: boolean;
  aivaManaged?: boolean;
};

export async function syncWorkspaceCalendar(workspaceId: string): Promise<{
  imported: number;
  error?: string;
}> {
  const connection = await getWorkspaceCalendarConnection(workspaceId);
  if (!connection?.enabled) {
    return { imported: 0, error: 'No calendar connection configured.' };
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 4, 0, 23, 59, 59, 999);

  try {
    const remote = await fetchRemoteEvents(connection, workspaceId, start, end);
    let imported = 0;
    const providerSource = connection.provider === 'google' ? 'google' : 'caldav';

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

      // Aiva-created Google events carry private extendedProperty aivaManaged=true.
      const source = event.aivaManaged ? 'aiva' : providerSource;

      const values = {
        workspaceId,
        externalUid,
        title: event.summary || 'Event',
        description: event.description ?? null,
        startsAt: event.dtStart,
        endsAt: event.dtEnd ?? null,
        allDay: event.allDay,
        source,
        updatedAt: new Date(),
      };

      if (existing) {
        await db.update(calendarEvents).set(values).where(eq(calendarEvents.id, existing.id));
      } else {
        await db.insert(calendarEvents).values(values);
      }
      imported += 1;
    }

    await db
      .update(calendarConnections)
      .set({ lastSyncAt: new Date(), lastSyncError: null, updatedAt: new Date() })
      .where(eq(calendarConnections.id, connection.id));

    return { imported };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(calendarConnections)
      .set({ lastSyncError: message, updatedAt: new Date() })
      .where(eq(calendarConnections.id, connection.id));
    return { imported: 0, error: message };
  }
}

async function fetchRemoteEvents(
  connection: typeof calendarConnections.$inferSelect,
  workspaceId: string,
  start: Date,
  end: Date,
): Promise<{ events: RemoteEvent[] }> {
  if (connection.provider === 'google') {
    const creds = resolveGoogleConnectionCredentials(connection, workspaceId);
    if (!creds) throw new Error('Google Calendar credentials are incomplete.');
    const result = await fetchGoogleCalendarEventsInRange(creds, start, end);
    return { events: result.events };
  }

  const creds =
    resolveConnectionCredentials(connection, workspaceId) ?? resolveEnvCalDavCredentials();
  if (!creds) throw new Error('No CalDAV connection configured.');

  const coreResult = await syncViaCoreIfAvailable(creds, start, end);
  const remote = coreResult ?? (await fetchCalDavEventsInRange(creds, start, end));
  return { events: remote.events };
}

async function syncViaCoreIfAvailable(
  creds: { url: string; username: string; password: string },
  start: Date,
  end: Date,
): Promise<{ events: RemoteEvent[] } | null> {
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
