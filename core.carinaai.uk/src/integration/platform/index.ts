import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type PlatformIntegration =
  | 'onepassword'
  | 'apple-notes'
  | 'apple-reminders'
  | 'bear'
  | 'bluebubbles'
  | 'eight-sleep'
  | 'camera';

const ENV_FLAGS: Record<PlatformIntegration, string> = {
  'onepassword': 'CARINA_1PASSWORD_ENABLED',
  'apple-notes': 'CARINA_APPLE_NOTES_ENABLED',
  'apple-reminders': 'CARINA_APPLE_REMINDERS_ENABLED',
  bear: 'CARINA_BEAR_ENABLED',
  bluebubbles: 'CARINA_BLUEBUBBLES_ENABLED',
  'eight-sleep': 'CARINA_EIGHT_SLEEP_ENABLED',
  camera: 'CARINA_CAMERA_ENABLED',
};

export function platformToolsEnabled(): boolean {
  return process.env.CARINA_PLATFORM_TOOLS === 'true';
}

export function isPlatformIntegrationEnabled(name: PlatformIntegration): boolean {
  if (!platformToolsEnabled()) return false;
  if (process.env[ENV_FLAGS[name]] !== 'true') return false;
  if (name.startsWith('apple') || name === 'bear') {
    return process.platform === 'darwin';
  }
  return true;
}

export function listEnabledPlatformIntegrations(): PlatformIntegration[] {
  return (Object.keys(ENV_FLAGS) as PlatformIntegration[]).filter(isPlatformIntegrationEnabled);
}

async function runCommand(cmd: string, args: string[], timeoutMs = 15_000): Promise<string> {
  const { stdout } = await execFileAsync(cmd, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 });
  return stdout.trim();
}

export async function onePasswordRead(reference: string): Promise<string> {
  return runCommand('op', ['read', reference]);
}

export async function appleNotesSearch(query: string): Promise<string> {
  const script = `tell application "Notes" to get name of every note whose plaintext contains "${query.replace(/"/g, '\\"')}"`;
  return runCommand('osascript', ['-e', script]);
}

export async function appleRemindersList(listName = 'Reminders'): Promise<string> {
  const script = `tell application "Reminders" to get name of every reminder in list "${listName.replace(/"/g, '\\"')}"`;
  return runCommand('osascript', ['-e', script]);
}

export async function bearCreate(title: string, text: string): Promise<string> {
  const encoded = encodeURIComponent(`${title}\n${text}`);
  return runCommand('open', [`bear://x-callback-url/create?text=${encoded}`]);
}

export async function blueBubblesSend(text: string, chatGuid: string): Promise<unknown> {
  const base = process.env.BLUEBUBBLES_URL ?? '';
  const password = process.env.BLUEBUBBLES_PASSWORD ?? '';
  if (!base || !password) return { error: 'BLUEBUBBLES_URL and BLUEBUBBLES_PASSWORD required' };
  const url = `${base.replace(/\/$/, '')}/api/v1/message/text?password=${encodeURIComponent(password)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chatGuid, message: text }),
    signal: AbortSignal.timeout(15_000),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

export async function eightSleepStatus(): Promise<unknown> {
  const token = process.env.EIGHT_SLEEP_TOKEN ?? '';
  if (!token) return { error: 'EIGHT_SLEEP_TOKEN required' };
  const res = await fetch('https://client-api.8slp.net/v1/users/me', {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

export async function cameraSnapshot(rtspUrl?: string): Promise<{ path?: string; error?: string }> {
  const url = rtspUrl ?? process.env.RTSP_URL ?? process.env.ONVIF_STREAM_URL ?? '';
  if (!url) return { error: 'RTSP_URL or ONVIF_STREAM_URL required' };
  const out = `/tmp/carina-capture-${Date.now()}.jpg`;
  try {
    await runCommand('ffmpeg', ['-y', '-rtsp_transport', 'tcp', '-i', url, '-frames:v', '1', out], 30_000);
    return { path: out };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
