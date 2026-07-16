export async function connectWorkerChannel(
  workerId: string,
  channel: string,
  credentials: Record<string, string> = {},
  identifier?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const body: Record<string, unknown> = { workerId, channel, credentials };
  if (identifier?.trim()) body.identifier = identifier.trim();

  try {
    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error ?? 'Could not connect channel' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not connect channel' };
  }
}

export function webChatEmbedSnippet(workerId: string): string {
  return `<script src="https://core.carinaai.uk/widget.js" data-aiva-id="${workerId}"></script>`;
}
