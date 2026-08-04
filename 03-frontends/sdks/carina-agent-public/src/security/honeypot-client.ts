import { config } from '../config/index.js';

function isEnabled(): boolean {
  return (
    process.env.LABYRINTH_ENABLED === 'true' &&
    config.labyrinth.url !== '' &&
    config.labyrinth.apiKey !== ''
  );
}

async function postCheck(
  path: string,
  body: Record<string, unknown>,
): Promise<boolean> {
  if (!isEnabled()) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${config.labyrinth.url}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Scout-Key': config.labyrinth.apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { matched?: boolean };
    return data.matched === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkHoneypotApiKey(
  key: string,
  meta?: Record<string, unknown>,
): Promise<boolean> {
  return postCheck('/api/honeypots/check/key', { key, meta: meta ?? {} });
}

export async function checkHoneypotFilePath(
  filePath: string,
  meta?: Record<string, unknown>,
): Promise<boolean> {
  return postCheck('/api/honeypots/check/path', { path: filePath, meta: meta ?? {} });
}

export async function scanForHoneypotLeak(
  text: string,
  meta?: Record<string, unknown>,
): Promise<boolean> {
  if (!isEnabled() || !text) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${config.labyrinth.url}/api/honeypots/scan/leak`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Scout-Key': config.labyrinth.apiKey,
      },
      body: JSON.stringify({
        text,
        instance_id: config.labyrinth.instanceId,
        meta: meta ?? {},
      }),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { leaked?: boolean };
    return data.leaked === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
