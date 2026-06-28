export class ConnectorHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'ConnectorHttpError';
  }
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; data: T; headers: Headers }> {
  const started = Date.now();
  const response = await fetch(url, init);
  const text = await response.text();
  const latencyMs = Date.now() - started;

  if (!response.ok) {
    throw new ConnectorHttpError(
      `HTTP ${response.status} from ${url}`,
      response.status,
      text.slice(0, 500),
    );
  }

  let data = {} as T;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = text as unknown as T;
    }
  }

  return { status: response.status, data, headers: response.headers };
}

export async function probeReachable(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = Date.now();
  try {
    const response = await fetch(url, { ...init, method: init.method ?? 'GET' });
    const latencyMs = Date.now() - started;
    if (response.status >= 500) {
      return { ok: false, latencyMs, error: `HTTP ${response.status}` };
    }
    return { ok: true, latencyMs };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
