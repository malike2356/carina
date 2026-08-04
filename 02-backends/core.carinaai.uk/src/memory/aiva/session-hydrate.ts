/**
 * Copy legacy per-channel episodic turns into the canonical shared session.
 *
 * Unlinked contacts only migrate the current channel's legacy session.
 * Linked / owner-auto contacts merge missing turns from every linked peer
 * even when the canonical session already has some history.
 */
import { getSessionHistory, saveMemory } from '../store.js';
import {
  aivaCanonicalSessionId,
  aivaLegacyChannelSessionId,
  listLinkedChannelContactIds,
} from './contact-identity.js';
import type { AivaChannelName } from '../../channels/types.js';

const ALL_CHANNELS: AivaChannelName[] = [
  'web', 'telegram', 'whatsapp', 'email', 'slack', 'discord',
  'sms', 'voice', 'teams', 'linkedin', 'instagram', 'messenger', 'twitter', 'tiktok',
];

export async function hydrateCanonicalSessionFromLinkedChannels(opts: {
  workspaceId: string;
  workerId: string;
  canonicalContactId: string;
  sessionId: string;
  /** Current inbound channel; unlinked hydrate only migrates this channel's legacy id. */
  channel?: string;
  /** When false/undefined, do not pull history from other channels. */
  linked?: boolean;
  channelContactIds?: string[];
  limit?: number;
}): Promise<{ hydrated: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 40, 1), 80);

  const contactIds = opts.channelContactIds
    ?? (
      opts.linked
        ? await listLinkedChannelContactIds({
          workspaceId: opts.workspaceId,
          workerId: opts.workerId,
          canonicalContactId: opts.canonicalContactId,
        }).catch(() => [opts.canonicalContactId])
        : [opts.canonicalContactId]
    );

  const channels = opts.linked
    ? ALL_CHANNELS
    : [((opts.channel ?? 'web') as AivaChannelName)];

  const seen = new Set<string>();
  const existingTurns: Array<{ role: 'user' | 'assistant'; content: string; at: number }> = [];
  try {
    const existing = await getSessionHistory(opts.sessionId, limit);
    for (const row of existing) {
      if (row.role !== 'user' && row.role !== 'assistant') continue;
      const content = String(row.content ?? '').trim();
      if (!content) continue;
      const key = `${row.role}:${content}`;
      seen.add(key);
      existingTurns.push({
        role: row.role,
        content,
        at: row.createdAt ? new Date(row.createdAt).getTime() : 0,
      });
    }
  } catch {
    /* empty canonical session */
  }

  // Unlinked: only seed when the canonical session is empty.
  if (!opts.linked && existingTurns.length > 0) {
    return { hydrated: 0 };
  }

  const incoming: Array<{ role: 'user' | 'assistant'; content: string; at: number }> = [];

  const collectFromSession = async (sourceSessionId: string) => {
    if (!sourceSessionId || sourceSessionId === opts.sessionId) return;
    try {
      const history = await getSessionHistory(sourceSessionId, limit);
      for (const row of history) {
        if (row.role !== 'user' && row.role !== 'assistant') continue;
        const content = String(row.content ?? '').trim();
        if (!content) continue;
        const key = `${row.role}:${content}`;
        if (seen.has(key)) continue;
        seen.add(key);
        incoming.push({
          role: row.role,
          content,
          at: row.createdAt ? new Date(row.createdAt).getTime() : 0,
        });
      }
    } catch {
      /* ignore missing sessions */
    }
  };

  for (const contactId of contactIds) {
    await collectFromSession(aivaCanonicalSessionId(opts.workerId, contactId));
    for (const channel of channels) {
      await collectFromSession(aivaLegacyChannelSessionId(opts.workerId, channel, contactId));
    }
  }

  if (incoming.length === 0) return { hydrated: 0 };

  incoming.sort((a, b) => a.at - b.at);
  // Prefer the newest missing turns so recent Telegram history lands in the shared session.
  const slice = incoming.slice(-limit);
  let hydrated = 0;
  for (const turn of slice) {
    await saveMemory(opts.sessionId, turn.role, turn.content);
    hydrated += 1;
  }
  return { hydrated };
}
