import { config } from '../config/index.js';

export interface MemorySessionRow {
  session_id: string;
  turn_count: number;
  last_active: string;
}

export function carinaMemoryConfigured(): boolean {
  const apiUrl = config.carina?.apiUrl ?? '';
  const opsToken = config.carina?.opsToken ?? '';
  return Boolean(apiUrl && opsToken);
}

export async function fetchCarinaMemorySessions(): Promise<MemorySessionRow[] | null> {
  if (!carinaMemoryConfigured()) return null;

  const apiUrl = config.carina?.apiUrl ?? '';
  const opsToken = config.carina?.opsToken ?? '';
  const url = `${apiUrl.replace(/\/$/, '')}/api/memory/sessions`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${opsToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[scout:carina] GET /api/memory/sessions returned ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { sessions?: MemorySessionRow[] };
    return Array.isArray(data.sessions) ? data.sessions : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout:carina] memory sessions fetch failed:', msg);
    return null;
  }
}
