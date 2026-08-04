import { pool } from '../../memory/db.js';
import { config } from '../../config/index.js';

export type ChannelResponseMode = 'thread' | 'channel' | 'ephemeral';

export interface AmbientChannelSettings {
  channelId: string;
  channelName: string;
  passiveReadingEnabled: boolean;
  ambientChecksEnabled: boolean;
  quietUntil: string | null;
  responseMode: ChannelResponseMode;
  broadcastOnComplete: boolean;
  mentionRequired: boolean;
  dismissedCheckIds: string[];
  updatedAt: string;
}

const settingsStore = new Map<string, AmbientChannelSettings>();

export function resetAmbientChannelSettingsForTests(): void {
  settingsStore.clear();
}

function defaultSettings(channelId: string, channelName = ''): AmbientChannelSettings {
  return {
    channelId,
    channelName,
    passiveReadingEnabled: true,
    ambientChecksEnabled: true,
    quietUntil: null,
    responseMode: 'thread',
    broadcastOnComplete: false,
    mentionRequired: true,
    dismissedCheckIds: [],
    updatedAt: new Date().toISOString(),
  };
}

function rowToSettings(row: Record<string, unknown>): AmbientChannelSettings {
  return {
    channelId: String(row.channel_id),
    channelName: String(row.channel_name ?? ''),
    passiveReadingEnabled: row.passive_reading_enabled !== false,
    ambientChecksEnabled: row.ambient_checks_enabled !== false,
    quietUntil: row.quiet_until ? new Date(String(row.quiet_until)).toISOString() : null,
    responseMode: String(row.response_mode ?? 'thread') as ChannelResponseMode,
    broadcastOnComplete: Boolean(row.broadcast_on_complete),
    mentionRequired: row.mention_required !== false,
    dismissedCheckIds: Array.isArray(row.dismissed_check_ids)
      ? row.dismissed_check_ids.map(String)
      : [],
    updatedAt: new Date(String(row.updated_at ?? Date.now())).toISOString(),
  };
}

export async function getAmbientChannelSettings(
  channelId: string,
  channelName = '',
): Promise<AmbientChannelSettings> {
  const cached = settingsStore.get(channelId);
  if (cached) return cached;

  try {
    const result = await pool.query(
      'SELECT * FROM ambient_channel_settings WHERE channel_id = $1 LIMIT 1',
      [channelId],
    );
    if (result.rows[0]) {
      const settings = rowToSettings(result.rows[0] as Record<string, unknown>);
      settingsStore.set(channelId, settings);
      return settings;
    }
  } catch {
    // table may be unavailable in tests
  }

  const defaults = defaultSettings(channelId, channelName);
  settingsStore.set(channelId, defaults);
  return defaults;
}

export async function saveAmbientChannelSettings(
  settings: AmbientChannelSettings,
): Promise<void> {
  settings.updatedAt = new Date().toISOString();
  settingsStore.set(settings.channelId, settings);

  try {
    await pool.query(
      `INSERT INTO ambient_channel_settings
        (channel_id, channel_name, passive_reading_enabled, ambient_checks_enabled,
         quiet_until, response_mode, broadcast_on_complete, mention_required,
         dismissed_check_ids, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())
       ON CONFLICT (channel_id) DO UPDATE SET
         channel_name = EXCLUDED.channel_name,
         passive_reading_enabled = EXCLUDED.passive_reading_enabled,
         ambient_checks_enabled = EXCLUDED.ambient_checks_enabled,
         quiet_until = EXCLUDED.quiet_until,
         response_mode = EXCLUDED.response_mode,
         broadcast_on_complete = EXCLUDED.broadcast_on_complete,
         mention_required = EXCLUDED.mention_required,
         dismissed_check_ids = EXCLUDED.dismissed_check_ids,
         updated_at = NOW()`,
      [
        settings.channelId,
        settings.channelName,
        settings.passiveReadingEnabled,
        settings.ambientChecksEnabled,
        settings.quietUntil,
        settings.responseMode,
        settings.broadcastOnComplete,
        settings.mentionRequired,
        JSON.stringify(settings.dismissedCheckIds),
      ],
    );
  } catch {
    // in-memory only when DB unavailable
  }
}

export async function isChannelQuiet(channelId: string): Promise<boolean> {
  const settings = await getAmbientChannelSettings(channelId);
  if (!settings.quietUntil) return false;
  return new Date(settings.quietUntil).getTime() > Date.now();
}

export async function isPassiveReadingEnabledForChannel(
  channelId: string,
  channelName = '',
): Promise<boolean> {
  if (!config.ambient.enabled) return false;
  const settings = await getAmbientChannelSettings(channelId, channelName);
  return settings.passiveReadingEnabled;
}

export async function isAmbientChecksEnabledForChannel(channelId: string): Promise<boolean> {
  const settings = await getAmbientChannelSettings(channelId);
  if (!settings.ambientChecksEnabled) return false;
  return !(await isChannelQuiet(channelId));
}

export function parseQuietDuration(raw: string): number | null {
  const match = raw.trim().match(/^(\d+)\s*(h|m|d)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'h') return amount * 60 * 60 * 1000;
  if (unit === 'm') return amount * 60 * 1000;
  return amount * 24 * 60 * 60 * 1000;
}
