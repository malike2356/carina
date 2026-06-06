const SCOUT_URL = process.env.SCOUT_URL ?? 'http://localhost:4444';
const SCOUT_KEY = process.env.SCOUT_API_KEY ?? '';

export const SCOUT_BASE = SCOUT_URL;

export function scoutHeaders(): Record<string, string> {
  return {
    'X-Scout-Key': SCOUT_KEY,
    'Content-Type': 'application/json',
  };
}

export async function scoutGet(path: string): Promise<unknown> {
  try {
    const r = await fetch(`${SCOUT_URL}${path}`, {
      headers: scoutHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) {
      console.warn(`[scout] GET ${path} returned ${r.status}`);
      return null;
    }
    return r.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout] offline:', msg);
    return null;
  }
}

export async function scoutPost(path: string, body: unknown): Promise<unknown> {
  try {
    const r = await fetch(`${SCOUT_URL}${path}`, {
      method: 'POST',
      headers: scoutHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) {
      console.warn(`[scout] POST ${path} returned ${r.status}`);
      return null;
    }
    return r.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout] offline:', msg);
    return null;
  }
}

export function scoutStreamUrl(path: string): string {
  return `${SCOUT_URL}${path}`;
}
