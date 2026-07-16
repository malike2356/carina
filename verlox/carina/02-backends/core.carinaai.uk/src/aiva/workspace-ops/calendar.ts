import { resolveGoogleAccessToken } from '../../workers/product-tools/google-driver.js';

/** Best-effort Google Calendar event for next meeting. Soft-fails if calendar not connected. */
export async function maybeCreateCalendarEvent(opts: {
  workspaceId: string;
  workerId: string;
  summary: string;
  description: string;
  whenText: string;
}): Promise<{ created: boolean; eventId?: string; error?: string }> {
  let accessToken: string;
  try {
    accessToken = await resolveGoogleAccessToken({
      workspaceId: opts.workspaceId,
      workerId: opts.workerId,
      toolSlug: 'google-calendar',
    });
  } catch (err) {
    return {
      created: false,
      error: err instanceof Error ? err.message : 'Calendar not connected',
    };
  }

  const start = parseLooseWhen(opts.whenText);
  if (!start) {
    return { created: false, error: 'Could not parse meeting time for Calendar' };
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      summary: opts.summary,
      description: opts.description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json()) as { id?: string; error?: unknown };
  if (!res.ok) {
    return { created: false, error: JSON.stringify(data) };
  }
  return { created: true, eventId: data.id };
}

function parseLooseWhen(whenText: string): Date | null {
  const trimmed = whenText.trim();
  if (!trimmed) return null;
  const asDate = Date.parse(trimmed);
  if (!Number.isNaN(asDate)) return new Date(asDate);
  // Fallback: tomorrow 16:30 local when text is informal
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(16, 30, 0, 0);
  return tomorrow;
}
