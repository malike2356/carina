/**
 * Fire-and-forget: mirror successful Google Calendar creates into the Aiva
 * Calendar page (admin.hireaiva.co.uk calendar_events store).
 */

export type AivaCalendarOutboundNotifyInput = {
  workspaceId: string;
  workerId?: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  allDay?: boolean;
  googleEventId?: string | null;
};

function resolveAppBaseUrl(): string {
  return (
    process.env.AIVA_APP_PUBLIC_URL
    ?? process.env.AIVA_APP_URL
    ?? process.env.CARINA_HOSTED_APP_URL
    ?? 'https://admin.hireaiva.co.uk'
  )
    .trim()
    .replace(/\/$/, '');
}

export async function notifyAivaCalendarOutbound(
  input: AivaCalendarOutboundNotifyInput,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const key = process.env.CARINA_INTERNAL_KEY?.trim();
  if (!key) {
    return { ok: false, skipped: true, error: 'CARINA_INTERNAL_KEY not set' };
  }

  const title = input.title.trim();
  const startsAt = input.startsAt.trim();
  if (!input.workspaceId.trim() || !title || !startsAt) {
    return { ok: false, error: 'workspaceId, title, and startsAt required' };
  }

  const url = `${resolveAppBaseUrl()}/api/internal/calendar/outbound`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': key,
      },
      body: JSON.stringify({
        workspaceId: input.workspaceId,
        workerId: input.workerId,
        title,
        description: input.description ?? null,
        startsAt,
        endsAt: input.endsAt ?? null,
        allDay: Boolean(input.allDay),
        externalUid: input.googleEventId ?? null,
        source: 'aiva',
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Non-blocking wrapper so tool execute never waits on the Calendar page write. */
export function notifyAivaCalendarOutboundBackground(
  input: AivaCalendarOutboundNotifyInput,
): void {
  void notifyAivaCalendarOutbound(input).catch(() => undefined);
}
