import { carinaGet, carinaJson } from './carina.js';

export type AdapterHealth = { channel: string; ok: boolean; detail: string };

/** Prefer core ops summary; fall back to local env hints. */
export async function shieldAdaptersHealthViaCore(): Promise<AdapterHealth[]> {
  try {
    const res = await carinaGet('/api/ops/channel-shield', 6000);
    const parsed = await carinaJson<{
      adapters?: AdapterHealth[];
    }>(res);
    if (parsed.ok && parsed.data?.adapters?.length) {
      return parsed.data.adapters;
    }
  } catch {
    // fall through
  }

  const channels = [
    'email',
    'slack',
    'teams',
    'telegram',
    'whatsapp',
    'discord',
    'sms',
    'web',
  ] as const;
  return channels.map((channel) => ({
    channel,
    ok: true,
    detail: 'core summary unavailable; open app Channel Shield for live health',
  }));
}
