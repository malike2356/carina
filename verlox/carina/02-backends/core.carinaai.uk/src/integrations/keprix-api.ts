export type KeprixConfig = {
  apiBaseUrl: string;
  studioBaseUrl: string;
  serviceToken: string;
  handoffSecret: string;
};

export class KeprixApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'KeprixApiError';
    this.status = status;
  }
}

function trimUrl(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/$/, '');
}

export function readKeprixConfig(): KeprixConfig {
  const studioBaseUrl = trimUrl(process.env.KEPRIX_STUDIO_BASE_URL);
  const apiBaseUrl = trimUrl(process.env.KEPRIX_API_BASE_URL) || studioBaseUrl;
  return {
    apiBaseUrl,
    studioBaseUrl: studioBaseUrl || apiBaseUrl,
    serviceToken: (process.env.KEPRIX_SERVICE_TOKEN ?? '').trim(),
    handoffSecret: (process.env.KEPRIX_HANDOFF_SECRET ?? '').trim(),
  };
}

export function isKeprixApiConfigured(config: KeprixConfig = readKeprixConfig()): boolean {
  return Boolean(config.apiBaseUrl && config.serviceToken);
}

export async function keprixApiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const config = readKeprixConfig();
  if (!isKeprixApiConfigured(config)) {
    throw new KeprixApiError('Keprix API is not configured', 503);
  }
  const url = `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    return await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${config.serviceToken}`,
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new KeprixApiError(`Keprix request failed: ${message}`, 502);
  }
}

export async function keprixApiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await keprixApiFetch(path, init);
  if (!response.ok) {
    throw new KeprixApiError(`Keprix returned ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}
