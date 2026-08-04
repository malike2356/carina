/**
 * Automatic cross-channel continuity for the workspace owner.
 *
 * Web dashboard chats and the owner's messenger peers share one canonical
 * contact (`workspace-owner`) and one episodic session, with no /link step.
 * Other contacts (customers) stay channel-isolated unless explicitly linked.
 */
import { getWorkspaceContact } from '../../email/workspace-contact.js';
import { pool } from '../db.js';
import {
  aivaCanonicalSessionId,
  ensureAivaContactIdentitySchema,
  aivaContactIdentityEnabled,
  linkAivaChannelContact,
  listAivaContactIdentities,
  listLinkedChannelContactIds,
  resolveAivaCanonicalContact,
  type AivaContactIdentity,
} from './contact-identity.js';

export const OWNER_CANONICAL_CONTACT_ID = 'workspace-owner';

export function ownerAutoSyncEnabled(): boolean {
  return process.env.AIVA_OWNER_AUTO_SYNC !== 'false';
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

function phonesMatch(a: string, b: string): boolean {
  const left = normalizePhone(a);
  const right = normalizePhone(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const leftDigits = left.replace(/\D/g, '');
  const rightDigits = right.replace(/\D/g, '');
  if (leftDigits.length < 8 || rightDigits.length < 8) return false;
  return leftDigits.endsWith(rightDigits) || rightDigits.endsWith(leftDigits);
}

function looksLikeRealMessengerPeer(channel: string, contactId: string): boolean {
  const id = contactId.trim();
  if (!id || id === '1' || id === '0' || id === 'null' || id === 'undefined') return false;
  if (channel === 'telegram') {
    // Real Telegram user ids are large integers; skip stubs like "1".
    return /^\d{6,}$/.test(id);
  }
  if (channel === 'whatsapp' || channel === 'sms') {
    return normalizePhone(id).replace(/\D/g, '').length >= 8;
  }
  return id.length >= 3;
}

export function isWebOwnerContactId(contactId: string): boolean {
  const id = contactId.trim();
  return id === 'app'
    || id === 'realtime-owner'
    || id === 'workspace-owner'
    || id === 'contact-workspace-owner'
    || id === 'contact-1'
    || id === '1'
    || id.startsWith('app:')
    || id.startsWith('auto:')
    || id.startsWith('contact-auto-')
    || id.startsWith('contact-app');
}

export async function isOwnerChannelPeer(opts: {
  workspaceId: string;
  workerId: string;
  channel: string;
  contactId: string;
}): Promise<boolean> {
  if (!ownerAutoSyncEnabled()) return false;
  const contactId = opts.contactId.trim();
  if (!contactId) return false;

  if (opts.channel === 'web' && isWebOwnerContactId(contactId)) return true;
  if (contactId === OWNER_CANONICAL_CONTACT_ID) return true;

  if (aivaContactIdentityEnabled()) {
    await ensureAivaContactIdentitySchema();
    const existing = await pool.query<{ canonical_contact_id: string }>(
      `SELECT canonical_contact_id FROM aiva_contact_identities
       WHERE workspace_id = $1 AND worker_id = $2 AND channel = $3 AND channel_contact_id = $4
       LIMIT 1`,
      [opts.workspaceId, opts.workerId, opts.channel, contactId],
    );
    if (existing.rows[0]?.canonical_contact_id === OWNER_CANONICAL_CONTACT_ID) {
      return true;
    }
  }

  const contact = await getWorkspaceContact(opts.workspaceId).catch(() => null);
  if (contact?.ownerEmail && opts.channel === 'email') {
    if (contactId.toLowerCase() === contact.ownerEmail.toLowerCase()) return true;
  }
  if (contact?.ownerPhone && (opts.channel === 'whatsapp' || opts.channel === 'sms')) {
    if (phonesMatch(contactId, contact.ownerPhone)) return true;
  }

  // Sticky messenger owner for personal Aiva:
  // - already bound owner peer on this channel
  // - sole real peer (ignore stubs like telegram "1")
  // - clear dominant peer when web owner sync already exists and peer count is small
  if (opts.channel !== 'web' && aivaContactIdentityEnabled()) {
    const ownerOnChannel = await pool.query<{ channel_contact_id: string }>(
      `SELECT channel_contact_id FROM aiva_contact_identities
       WHERE workspace_id = $1 AND worker_id = $2
         AND canonical_contact_id = $3 AND channel = $4
       LIMIT 1`,
      [opts.workspaceId, opts.workerId, OWNER_CANONICAL_CONTACT_ID, opts.channel],
    );
    if (ownerOnChannel.rows[0]) {
      return ownerOnChannel.rows[0].channel_contact_id === contactId;
    }

    const threadPeers = await pool.query<{ contact_id: string; message_count: string }>(
      `SELECT contact_id, COALESCE(message_count, 0)::text AS message_count
       FROM channel_threads
       WHERE worker_id = $1 AND channel = $2
       ORDER BY message_count DESC NULLS LAST, last_message_at DESC NULLS LAST`,
      [opts.workerId, opts.channel],
    ).catch(() => ({ rows: [] as Array<{ contact_id: string; message_count: string }> }));

    const realPeers = threadPeers.rows
      .map((row) => ({
        contactId: String(row.contact_id),
        messageCount: Number(row.message_count ?? 0),
      }))
      .filter((row) => looksLikeRealMessengerPeer(opts.channel, row.contactId));

    if (realPeers.length === 0) {
      // No real peers yet: allow first inbound to become owner.
      return threadPeers.rows.length <= 1;
    }
    if (realPeers.length === 1) {
      return realPeers[0].contactId === contactId;
    }

    const webOwner = await pool.query<{ channel_contact_id: string }>(
      `SELECT channel_contact_id FROM aiva_contact_identities
       WHERE workspace_id = $1 AND worker_id = $2
         AND canonical_contact_id = $3 AND channel = 'web'
       LIMIT 1`,
      [opts.workspaceId, opts.workerId, OWNER_CANONICAL_CONTACT_ID],
    ).catch(() => ({ rows: [] as Array<{ channel_contact_id: string }> }));

    // Personal Aiva with a few peers: claim the clearly dominant real peer once web
    // owner sync exists. Skip wide CS inboxes (many peers).
    if (webOwner.rows[0] && realPeers.length <= 3) {
      const top = realPeers[0];
      const second = realPeers[1];
      const clearlyDominant = top.messageCount >= Math.max(10, (second?.messageCount ?? 0) * 5);
      if (clearlyDominant && top.contactId === contactId) return true;
    }
  }

  return false;
}

/**
 * Ensure this peer is bound to workspace-owner and return the shared session.
 * Also attaches the latest non-web thread peers so switching channels just works.
 */
export async function resolveOwnerAutoSession(opts: {
  workspaceId: string;
  workerId: string;
  channel: string;
  contactId: string;
  displayName?: string;
}): Promise<{
  canonicalContactId: string;
  sessionId: string;
  linked: boolean;
  identities: AivaContactIdentity[];
  ownerAuto: true;
} | null> {
  if (!ownerAutoSyncEnabled()) return null;
  const isOwner = await isOwnerChannelPeer(opts);
  if (!isOwner) return null;

  if (!aivaContactIdentityEnabled()) {
    return {
      canonicalContactId: OWNER_CANONICAL_CONTACT_ID,
      sessionId: aivaCanonicalSessionId(opts.workerId, OWNER_CANONICAL_CONTACT_ID),
      linked: true,
      identities: [],
      ownerAuto: true,
    };
  }

  await ensureAivaContactIdentitySchema();

  // Bind current peer to workspace-owner.
  await linkAivaChannelContact({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    canonicalContactId: OWNER_CANONICAL_CONTACT_ID,
    channel: opts.channel,
    channelContactId: opts.contactId,
    displayName: opts.displayName,
  });

  // Mark web primary when present.
  if (opts.channel === 'web') {
    await pool.query(
      `UPDATE aiva_contact_identities
       SET is_primary = (channel = 'web' AND channel_contact_id = $4)
       WHERE workspace_id = $1 AND worker_id = $2 AND canonical_contact_id = $3`,
      [opts.workspaceId, opts.workerId, OWNER_CANONICAL_CONTACT_ID, opts.contactId],
    ).catch(() => undefined);
  }

  // Auto-attach real sole / dominant peers on other channels once owner sync is active.
  const otherChannels = await pool.query<{
    channel: string;
    contact_id: string;
    message_count: string;
    peer_rank: string;
    peer_count: string;
  }>(
    `SELECT channel, contact_id, COALESCE(message_count, 0)::text AS message_count,
            ROW_NUMBER() OVER (
              PARTITION BY channel
              ORDER BY message_count DESC NULLS LAST, last_message_at DESC NULLS LAST
            )::text AS peer_rank,
            COUNT(*) OVER (PARTITION BY channel)::text AS peer_count
     FROM channel_threads
     WHERE worker_id = $1 AND channel <> $2`,
    [opts.workerId, opts.channel],
  ).catch(() => ({
    rows: [] as Array<{
      channel: string;
      contact_id: string;
      message_count: string;
      peer_rank: string;
      peer_count: string;
    }>,
  }));

  const byChannel = new Map<string, Array<{
    contactId: string;
    messageCount: number;
    rank: number;
    peerCount: number;
  }>>();
  for (const row of otherChannels.rows) {
    const channel = String(row.channel);
    const contactId = String(row.contact_id);
    if (!looksLikeRealMessengerPeer(channel, contactId)) continue;
    const list = byChannel.get(channel) ?? [];
    list.push({
      contactId,
      messageCount: Number(row.message_count ?? 0),
      rank: Number(row.peer_rank ?? 99),
      peerCount: Number(row.peer_count ?? 0),
    });
    byChannel.set(channel, list);
  }

  for (const [channel, peers] of byChannel) {
    const existingOwner = await pool.query<{ channel_contact_id: string }>(
      `SELECT channel_contact_id FROM aiva_contact_identities
       WHERE workspace_id = $1 AND worker_id = $2
         AND canonical_contact_id = $3 AND channel = $4
       LIMIT 1`,
      [opts.workspaceId, opts.workerId, OWNER_CANONICAL_CONTACT_ID, channel],
    );
    if (existingOwner.rows[0]) continue;

    peers.sort((a, b) => a.rank - b.rank || b.messageCount - a.messageCount);
    const top = peers[0];
    if (!top) continue;
    const second = peers[1];
    const attach = peers.length === 1
      || (
        peers.length <= 3
        && top.messageCount >= Math.max(10, (second?.messageCount ?? 0) * 5)
      );
    if (!attach) continue;

    await linkAivaChannelContact({
      workspaceId: opts.workspaceId,
      workerId: opts.workerId,
      canonicalContactId: OWNER_CANONICAL_CONTACT_ID,
      channel,
      channelContactId: top.contactId,
    }).catch(() => undefined);
  }

  // Pull prior owner aliases that were mistakenly linked under a stub canonical
  // (e.g. telegram peer bound to canonical "1" from an old link).
  const stubLinked = await pool.query<{ channel: string; channel_contact_id: string }>(
    `SELECT channel, channel_contact_id
     FROM aiva_contact_identities
     WHERE workspace_id = $1 AND worker_id = $2
       AND canonical_contact_id IN ('1', 'app')`,
    [opts.workspaceId, opts.workerId],
  ).catch(() => ({ rows: [] as Array<{ channel: string; channel_contact_id: string }> }));

  for (const row of stubLinked.rows) {
    const channel = String(row.channel);
    const peer = String(row.channel_contact_id);
    const take = channel === 'web'
      ? isWebOwnerContactId(peer)
      : looksLikeRealMessengerPeer(channel, peer);
    if (!take) continue;
    await linkAivaChannelContact({
      workspaceId: opts.workspaceId,
      workerId: opts.workerId,
      canonicalContactId: OWNER_CANONICAL_CONTACT_ID,
      channel,
      channelContactId: peer,
    }).catch(() => undefined);
  }

  // Also bind common web owner aliases so app / app:uuid / realtime share one session.
  if (opts.channel === 'web') {
    for (const alias of ['app', 'realtime-owner']) {
      if (alias === opts.contactId) continue;
      await linkAivaChannelContact({
        workspaceId: opts.workspaceId,
        workerId: opts.workerId,
        canonicalContactId: OWNER_CANONICAL_CONTACT_ID,
        channel: 'web',
        channelContactId: alias,
      }).catch(() => undefined);
    }
  }

  const identities = await listAivaContactIdentities({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    canonicalContactId: OWNER_CANONICAL_CONTACT_ID,
  });

  return {
    canonicalContactId: OWNER_CANONICAL_CONTACT_ID,
    sessionId: aivaCanonicalSessionId(opts.workerId, OWNER_CANONICAL_CONTACT_ID),
    linked: identities.length > 1 || opts.channel !== 'web',
    identities,
    ownerAuto: true,
  };
}

export async function resolveAivaSessionWithOwnerAuto(opts: {
  workspaceId: string;
  workerId: string;
  channel: string;
  contactId: string;
  displayName?: string;
}): Promise<{
  sessionId: string;
  canonicalContactId: string;
  linked: boolean;
  ownerAuto: boolean;
  identities: AivaContactIdentity[];
}> {
  const owner = await resolveOwnerAutoSession(opts);
  if (owner) {
    return {
      sessionId: owner.sessionId,
      canonicalContactId: owner.canonicalContactId,
      linked: true,
      ownerAuto: true,
      identities: owner.identities,
    };
  }

  const resolved = await resolveAivaCanonicalContact({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    channel: opts.channel,
    channelContactId: opts.contactId,
    displayName: opts.displayName,
  });
  return {
    sessionId: resolved.sessionId,
    canonicalContactId: resolved.canonicalContactId,
    linked: resolved.linked,
    ownerAuto: false,
    identities: resolved.identities,
  };
}

export async function listOwnerLinkedContactIds(opts: {
  workspaceId: string;
  workerId: string;
}): Promise<string[]> {
  const ids = await listLinkedChannelContactIds({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    canonicalContactId: OWNER_CANONICAL_CONTACT_ID,
  }).catch(() => [OWNER_CANONICAL_CONTACT_ID]);
  return [...new Set([...ids, 'app', 'realtime-owner', OWNER_CANONICAL_CONTACT_ID])];
}
