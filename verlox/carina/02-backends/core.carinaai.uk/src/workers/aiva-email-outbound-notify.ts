/**
 * Fire-and-forget: mirror successful Gmail sends into the Aiva Email page
 * (app.carinaai.uk / admin.hireaiva.co.uk email_messages store).
 */

export type AivaEmailOutboundNotifyInput = {
  workspaceId: string;
  workerId?: string;
  to: string;
  subject: string;
  body: string;
  fromAddress?: string;
  gmailMessageId?: string | null;
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

export async function notifyAivaEmailOutbound(
  input: AivaEmailOutboundNotifyInput,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const key = process.env.CARINA_INTERNAL_KEY?.trim();
  if (!key) {
    return { ok: false, skipped: true, error: 'CARINA_INTERNAL_KEY not set' };
  }

  const to = input.to.trim();
  const subject = input.subject.trim();
  if (!input.workspaceId.trim() || !to || !subject) {
    return { ok: false, error: 'workspaceId, to, and subject required' };
  }

  const url = `${resolveAppBaseUrl()}/api/internal/email/outbound`;
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
        to,
        subject,
        body: input.body,
        fromAddress: input.fromAddress ?? 'Aiva via Gmail',
        externalId: input.gmailMessageId ?? null,
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

/** Non-blocking wrapper so tool execute never waits on the Email page write. */
export function notifyAivaEmailOutboundBackground(
  input: AivaEmailOutboundNotifyInput,
): void {
  void notifyAivaEmailOutbound(input).catch(() => undefined);
}
