/**
 * Explicit cross-channel contact identity for Aiva workers.
 *
 * Owners and contacts stay on separate channel peer ids until they run
 * `/link code` on one channel and `/link claim <code>` on another.
 * After linking, all peers share one canonical contact id and one episodic session.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { isDatabaseConfigured } from '../../config/database-url.js';
import { pool } from '../db.js';
import type { AivaChannelName } from '../../channels/types.js';

export type AivaContactIdentity = {
  id: string;
  workspaceId: string;
  workerId: string;
  canonicalContactId: string;
  channel: string;
  channelContactId: string;
  displayName: string | null;
  linkedAt: number;
  lastSeenAt: number;
  isPrimary: boolean;
  metadata: Record<string, unknown>;
};

type Row = {
  id: string;
  workspace_id: string;
  worker_id: string;
  canonical_contact_id: string;
  channel: string;
  channel_contact_id: string;
  display_name: string | null;
  linked_at: string;
  last_seen_at: string;
  is_primary: boolean;
  metadata: Record<string, unknown> | null;
};

type LinkCode = {
  code: string;
  workspaceId: string;
  workerId: string;
  canonicalContactId: string;
  channel: string;
  channelContactId: string;
  displayName?: string;
  expiresAt: number;
};

const CODE_TTL_MS = 5 * 60 * 1000;
const linkCodes = new Map<string, LinkCode>();
let schemaReady: Promise<void> | null = null;

function rowToIdentity(row: Row): AivaContactIdentity {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    workerId: row.worker_id,
    canonicalContactId: row.canonical_contact_id,
    channel: row.channel,
    channelContactId: row.channel_contact_id,
    displayName: row.display_name,
    linkedAt: Number(row.linked_at),
    lastSeenAt: Number(row.last_seen_at),
    isPrimary: row.is_primary,
    metadata: row.metadata ?? {},
  };
}

export function aivaContactIdentityEnabled(): boolean {
  if (process.env.AIVA_CONTACT_IDENTITY_ENABLED === 'false') return false;
  return isDatabaseConfigured();
}

export async function ensureAivaContactIdentitySchema(): Promise<void> {
  if (!aivaContactIdentityEnabled()) return;
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_contact_identities (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          workspace_id TEXT NOT NULL,
          worker_id TEXT NOT NULL,
          canonical_contact_id TEXT NOT NULL,
          channel TEXT NOT NULL,
          channel_contact_id TEXT NOT NULL,
          display_name TEXT,
          linked_at BIGINT NOT NULL,
          last_seen_at BIGINT NOT NULL,
          is_primary BOOLEAN NOT NULL DEFAULT false,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          UNIQUE (workspace_id, worker_id, channel, channel_contact_id),
          UNIQUE (workspace_id, worker_id, canonical_contact_id, channel)
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_aiva_ci_canonical
          ON aiva_contact_identities (workspace_id, worker_id, canonical_contact_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_aiva_ci_channel_peer
          ON aiva_contact_identities (workspace_id, worker_id, channel, channel_contact_id)
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

/** Channel-agnostic episodic session key for one person talking to one worker. */
export function aivaCanonicalSessionId(workerId: string, canonicalContactId: string): string {
  return `aiva-${workerId}-contact-${canonicalContactId}`;
}

/** Legacy per-channel session key (kept for hydration / migration). */
export function aivaLegacyChannelSessionId(
  workerId: string,
  channel: string,
  channelContactId: string,
): string {
  return `aiva-${workerId}-${channel}-${channelContactId}`;
}

/**
 * Resolve the canonical contact for this channel peer.
 * Unlinked peers keep their channel contact id as the canonical id (no auto-merge).
 */
export async function resolveAivaCanonicalContact(opts: {
  workspaceId: string;
  workerId: string;
  channel: string;
  channelContactId: string;
  displayName?: string;
}): Promise<{
  canonicalContactId: string;
  sessionId: string;
  linked: boolean;
  identities: AivaContactIdentity[];
}> {
  const channelContactId = opts.channelContactId.trim();
  if (!channelContactId) {
    throw new Error('channelContactId is required');
  }

  if (!aivaContactIdentityEnabled()) {
    return {
      canonicalContactId: channelContactId,
      sessionId: aivaCanonicalSessionId(opts.workerId, channelContactId),
      linked: false,
      identities: [],
    };
  }

  await ensureAivaContactIdentitySchema();
  const now = Date.now();
  const existing = await pool.query<Row>(
    `SELECT * FROM aiva_contact_identities
     WHERE workspace_id = $1 AND worker_id = $2 AND channel = $3 AND channel_contact_id = $4`,
    [opts.workspaceId, opts.workerId, opts.channel, channelContactId],
  );

  let canonicalContactId: string;
  if (existing.rows[0]) {
    canonicalContactId = existing.rows[0].canonical_contact_id;
    await pool.query(
      `UPDATE aiva_contact_identities
       SET last_seen_at = $5, display_name = COALESCE($6, display_name)
       WHERE workspace_id = $1 AND worker_id = $2 AND channel = $3 AND channel_contact_id = $4`,
      [
        opts.workspaceId,
        opts.workerId,
        opts.channel,
        channelContactId,
        now,
        opts.displayName ?? null,
      ],
    );
  } else {
    // If this id is already the canonical for a peer on this channel (e.g. owner
    // normalizer passed workspace-owner while telegram is linked as 7028...),
    // reuse that row instead of inserting a conflicting (canonical, channel) pair.
    const existingCanonical = await pool.query<Row>(
      `SELECT * FROM aiva_contact_identities
       WHERE workspace_id = $1 AND worker_id = $2
         AND canonical_contact_id = $3 AND channel = $4
       LIMIT 1`,
      [opts.workspaceId, opts.workerId, channelContactId, opts.channel],
    );
    if (existingCanonical.rows[0]) {
      canonicalContactId = existingCanonical.rows[0].canonical_contact_id;
      await pool.query(
        `UPDATE aiva_contact_identities
         SET last_seen_at = $5, display_name = COALESCE($6, display_name)
         WHERE workspace_id = $1 AND worker_id = $2
           AND canonical_contact_id = $3 AND channel = $4`,
        [
          opts.workspaceId,
          opts.workerId,
          canonicalContactId,
          opts.channel,
          now,
          opts.displayName ?? null,
        ],
      );
    } else {
      // First sighting: register as its own primary identity (explicit link required to merge).
      canonicalContactId = channelContactId;
      await pool.query(
        `INSERT INTO aiva_contact_identities
           (id, workspace_id, worker_id, canonical_contact_id, channel, channel_contact_id,
            display_name, linked_at, last_seen_at, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, true)
         ON CONFLICT (workspace_id, worker_id, channel, channel_contact_id) DO UPDATE
           SET last_seen_at = EXCLUDED.last_seen_at,
               display_name = COALESCE(EXCLUDED.display_name, aiva_contact_identities.display_name)`,
        [
          randomUUID(),
          opts.workspaceId,
          opts.workerId,
          canonicalContactId,
          opts.channel,
          channelContactId,
          opts.displayName ?? null,
          now,
        ],
      );
    }
  }

  const identities = await listAivaContactIdentities({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    canonicalContactId,
  });

  return {
    canonicalContactId,
    sessionId: aivaCanonicalSessionId(opts.workerId, canonicalContactId),
    linked: identities.length > 1,
    identities,
  };
}

export async function listAivaContactIdentities(opts: {
  workspaceId: string;
  workerId: string;
  canonicalContactId: string;
}): Promise<AivaContactIdentity[]> {
  if (!aivaContactIdentityEnabled()) return [];
  await ensureAivaContactIdentitySchema();
  const { rows } = await pool.query<Row>(
    `SELECT * FROM aiva_contact_identities
     WHERE workspace_id = $1 AND worker_id = $2 AND canonical_contact_id = $3
     ORDER BY is_primary DESC, last_seen_at DESC`,
    [opts.workspaceId, opts.workerId, opts.canonicalContactId],
  );
  return rows.map(rowToIdentity);
}

export async function listLinkedChannelContactIds(opts: {
  workspaceId: string;
  workerId: string;
  canonicalContactId: string;
}): Promise<string[]> {
  const identities = await listAivaContactIdentities(opts);
  const ids = new Set<string>([opts.canonicalContactId]);
  for (const identity of identities) {
    ids.add(identity.channelContactId);
    ids.add(identity.canonicalContactId);
  }
  return [...ids];
}

export async function linkAivaChannelContact(opts: {
  workspaceId: string;
  workerId: string;
  canonicalContactId: string;
  channel: string;
  channelContactId: string;
  displayName?: string;
}): Promise<AivaContactIdentity[]> {
  if (!aivaContactIdentityEnabled()) {
    throw new Error('Aiva contact identity is disabled (AIVA_CONTACT_IDENTITY_ENABLED=false).');
  }
  await ensureAivaContactIdentitySchema();
  const now = Date.now();
  const channelContactId = opts.channelContactId.trim();

  // Free UNIQUE(canonical, channel) before attaching this peer.
  await pool.query(
    `DELETE FROM aiva_contact_identities
     WHERE workspace_id = $1 AND worker_id = $2
       AND canonical_contact_id = $3 AND channel = $4
       AND channel_contact_id <> $5`,
    [
      opts.workspaceId,
      opts.workerId,
      opts.canonicalContactId,
      opts.channel,
      channelContactId,
    ],
  );

  await pool.query(
    `INSERT INTO aiva_contact_identities
       (id, workspace_id, worker_id, canonical_contact_id, channel, channel_contact_id,
        display_name, linked_at, last_seen_at, is_primary)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, false)
     ON CONFLICT (workspace_id, worker_id, channel, channel_contact_id) DO UPDATE
       SET canonical_contact_id = EXCLUDED.canonical_contact_id,
           display_name = COALESCE(EXCLUDED.display_name, aiva_contact_identities.display_name),
           last_seen_at = EXCLUDED.last_seen_at,
           is_primary = false`,
    [
      randomUUID(),
      opts.workspaceId,
      opts.workerId,
      opts.canonicalContactId,
      opts.channel,
      channelContactId,
      opts.displayName ?? null,
      now,
    ],
  );

  return listAivaContactIdentities({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    canonicalContactId: opts.canonicalContactId,
  });
}

export function generateAivaLinkCode(params: {
  workspaceId: string;
  workerId: string;
  canonicalContactId: string;
  channel: string;
  channelContactId: string;
  displayName?: string;
}): string {
  const code = randomBytes(4).toString('hex').toLowerCase();
  linkCodes.set(code, {
    code,
    workspaceId: params.workspaceId,
    workerId: params.workerId,
    canonicalContactId: params.canonicalContactId,
    channel: params.channel,
    channelContactId: params.channelContactId,
    displayName: params.displayName,
    expiresAt: Date.now() + CODE_TTL_MS,
  });
  return code;
}

export function claimAivaLinkCode(
  code: string,
  target: {
    workspaceId: string;
    workerId: string;
    channel: string;
    channelContactId: string;
  },
): { canonicalContactId: string; workspaceId: string; workerId: string } | { error: string } {
  const entry = linkCodes.get(code.trim().toLowerCase());
  if (!entry) return { error: 'Invalid or expired link code.' };
  if (Date.now() > entry.expiresAt) {
    linkCodes.delete(entry.code);
    return { error: 'Link code expired. Generate a new one on the other channel.' };
  }
  if (entry.workspaceId !== target.workspaceId || entry.workerId !== target.workerId) {
    return { error: 'Link code belongs to a different Aiva worker.' };
  }
  if (
    entry.channel === target.channel
    && entry.channelContactId === target.channelContactId
  ) {
    return { error: 'Claim the code from a different channel, not the same one.' };
  }
  linkCodes.delete(entry.code);
  return {
    canonicalContactId: entry.canonicalContactId,
    workspaceId: entry.workspaceId,
    workerId: entry.workerId,
  };
}

export function clearAivaLinkCodesForTests(): void {
  linkCodes.clear();
  schemaReady = null;
}

export async function listChannelSyncConversations(opts: {
  workspaceId: string;
  workerId: string;
  canonicalContactId: string;
  limit?: number;
}): Promise<Array<{
  id: string;
  channel: string;
  contactId: string;
  lastMessageAt: string | null;
  messageCount: number;
  sessionId: string;
  isCanonicalSession: boolean;
}>> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const contactIds = await listLinkedChannelContactIds(opts);
  const sessionId = aivaCanonicalSessionId(opts.workerId, opts.canonicalContactId);

  if (!aivaContactIdentityEnabled()) {
    return [{
      id: sessionId,
      channel: 'shared',
      contactId: opts.canonicalContactId,
      lastMessageAt: null,
      messageCount: 0,
      sessionId,
      isCanonicalSession: true,
    }];
  }

  await ensureAivaContactIdentitySchema();
  const result = await pool.query(
    `SELECT id, channel, contact_id, last_message_at, message_count
     FROM channel_threads
     WHERE worker_id = $1
       AND contact_id = ANY($2::text[])
     ORDER BY last_message_at DESC NULLS LAST
     LIMIT $3`,
    [opts.workerId, contactIds, limit],
  );

  const rows = result.rows.map((row) => ({
    id: String(row.id),
    channel: String(row.channel),
    contactId: String(row.contact_id),
    lastMessageAt: row.last_message_at
      ? new Date(String(row.last_message_at)).toISOString()
      : null,
    messageCount: Number(row.message_count ?? 0),
    sessionId,
    isCanonicalSession: true,
  }));

  if (rows.length === 0) {
    rows.push({
      id: sessionId,
      channel: 'shared',
      contactId: opts.canonicalContactId,
      lastMessageAt: null,
      messageCount: 0,
      sessionId,
      isCanonicalSession: true,
    });
  }

  return rows;
}

export function formatLinkedIdentitiesForPrompt(
  identities: AivaContactIdentity[],
  currentChannel: string,
): string {
  if (identities.length <= 1) return '';
  const lines = [
    '',
    '## Linked channel identities',
    '',
    'You are talking to the same person across these channels:',
  ];
  for (const identity of identities) {
    const label = identity.displayName ?? identity.channelContactId;
    lines.push(`- ${identity.channel} (${label})`);
  }
  lines.push('');
  lines.push(`Currently replying on: ${currentChannel}`);
  lines.push('Continue the same conversation; do not re-introduce yourself.');
  lines.push('');
  return lines.join('\n');
}

export type { AivaChannelName };
