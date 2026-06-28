export interface WidgetConfig {
  workerName: string;
  workerRole: string;
  welcomeMessage: string;
  accentColor: string;
  poweredByLabel: string;
  logoUrl?: string | null;
  companyName?: string | null;
  hideAttribution?: boolean;
}

function normalizeConfig(raw: Record<string, unknown>): WidgetConfig {
  const hideAttribution = Boolean(raw.hideAttribution);
  return {
    workerName: String(raw.companyName ?? raw.workerName ?? raw.name ?? 'Aiva'),
    workerRole: String(raw.workerRole ?? raw.role ?? 'Assistant'),
    welcomeMessage: String(raw.welcomeMessage ?? raw.greeting ?? 'Hi! How can I help you today?'),
    accentColor: String(raw.accentColor ?? '#1a5f7a'),
    poweredByLabel: hideAttribution ? '' : String(raw.poweredByLabel ?? 'Powered by VERLOX'),
    logoUrl: raw.logoUrl ? String(raw.logoUrl) : null,
    companyName: raw.companyName ? String(raw.companyName) : null,
    hideAttribution,
  };
}

export async function fetchConfig(apiBase: string, workerId: string): Promise<WidgetConfig | null> {
  try {
    const res = await fetch(`${apiBase}/api/widget/${workerId}/config`);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return normalizeConfig(data);
  } catch {
    return null;
  }
}

export async function createSession(
  apiBase: string,
  workerId: string,
  existingToken: string | null,
): Promise<string | null> {
  try {
    const body = existingToken ? { sessionToken: existingToken } : {};
    const res = await fetch(`${apiBase}/api/widget/${workerId}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { sessionToken?: string };
    return data.sessionToken ?? null;
  } catch {
    return null;
  }
}

export type StreamEvent =
  | { type: 'token'; content: string }
  | { type: 'replace'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export async function* streamMessage(
  apiBase: string,
  workerId: string,
  sessionToken: string,
  message: string,
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${apiBase}/api/widget/${workerId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken, message }),
  });

  if (!res.ok) {
    yield { type: 'error', message: 'Request failed.' };
    return;
  }

  if (!res.body) {
    yield { type: 'error', message: 'No response body.' };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        yield JSON.parse(line.slice(6)) as StreamEvent;
      } catch {
        // malformed SSE line
      }
    }
  }
}
