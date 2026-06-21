import { randomUUID } from 'node:crypto';
import { pool } from '../memory/db.js';
import type { IdentityLink } from './identity-links-types.js';

export { IDENTITY_LINKS_MIGRATION } from './identity-links-types.js';

type Row = {
  id: string;
  user_id: string;
  channel: string;
  channel_user_id: string;
  display_name: string | null;
  linked_at: string;
  last_seen_at: string;
  is_primary: boolean;
  metadata: Record<string, unknown> | null;
};

function rowToLink(row: Row): IdentityLink {
  return {
    id: row.id,
    userId: row.user_id,
    channel: row.channel,
    channelUserId: row.channel_user_id,
    displayName: row.display_name,
    linkedAt: Number(row.linked_at),
    lastSeenAt: Number(row.last_seen_at),
    isPrimary: row.is_primary,
    metadata: row.metadata ?? {},
  };
}

export function identityLinksEnabled(): boolean {
  return process.env.CARINA_IDENTITY_LINKS_ENABLED !== 'false';
}

export class IdentityResolver {
  async resolve(
    channel: string,
    channelUserId: string,
    displayName?: string,
  ): Promise<string> {
    const now = Date.now();
    const { rows } = await pool.query<Row>(
      `SELECT user_id FROM identity_links WHERE channel = $1 AND channel_user_id = $2`,
      [channel, channelUserId],
    );
    if (rows[0]) {
      await pool.query(
        `UPDATE identity_links SET last_seen_at = $3, display_name = COALESCE($4, display_name)
         WHERE channel = $1 AND channel_user_id = $2`,
        [channel, channelUserId, now, displayName ?? null],
      );
      return rows[0].user_id;
    }

    const userId = `usr_${randomUUID()}`;
    await pool.query(
      `INSERT INTO identity_links
         (user_id, channel, channel_user_id, display_name, linked_at, last_seen_at, is_primary)
       VALUES ($1, $2, $3, $4, $5, $5, true)
       ON CONFLICT (channel, channel_user_id) DO UPDATE
         SET last_seen_at = EXCLUDED.last_seen_at,
             display_name = COALESCE(EXCLUDED.display_name, identity_links.display_name)`,
      [userId, channel, channelUserId, displayName ?? null, now],
    );
    const { rows: after } = await pool.query<Row>(
      `SELECT user_id FROM identity_links WHERE channel = $1 AND channel_user_id = $2`,
      [channel, channelUserId],
    );
    return after[0]?.user_id ?? userId;
  }

  async link(
    userId: string,
    channel: string,
    channelUserId: string,
    displayName?: string,
  ): Promise<void> {
    const now = Date.now();
    await pool.query(
      `INSERT INTO identity_links
         (user_id, channel, channel_user_id, display_name, linked_at, last_seen_at, is_primary)
       VALUES ($1, $2, $3, $4, $5, $5, false)
       ON CONFLICT (channel, channel_user_id) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             display_name = COALESCE(EXCLUDED.display_name, identity_links.display_name),
             last_seen_at = EXCLUDED.last_seen_at`,
      [userId, channel, channelUserId, displayName ?? null, now],
    );
  }

  async getIdentities(userId: string): Promise<IdentityLink[]> {
    const { rows } = await pool.query<Row>(
      `SELECT * FROM identity_links WHERE user_id = $1
       ORDER BY is_primary DESC, last_seen_at DESC`,
      [userId],
    );
    return rows.map(rowToLink);
  }

  async resolveToChannel(userId: string, channel: string): Promise<IdentityLink | null> {
    const { rows } = await pool.query<Row>(
      `SELECT * FROM identity_links WHERE user_id = $1 AND channel = $2`,
      [userId, channel],
    );
    return rows[0] ? rowToLink(rows[0]) : null;
  }
}

let resolver: IdentityResolver | null = null;

export function getIdentityResolver(): IdentityResolver {
  resolver ??= new IdentityResolver();
  return resolver;
}

/** Backfill identity rows for distinct channel peers seen in session map keys (best-effort). */
export async function bootstrapIdentityLinksFromPeers(
  peers: Array<{ channel: string; channelUserId: string }>,
): Promise<number> {
  if (!identityLinksEnabled()) return 0;
  const resolverInstance = getIdentityResolver();
  let created = 0;
  for (const peer of peers) {
    const before = await resolverInstance.resolveToChannel(
      (await pool.query<{ user_id: string }>(
        `SELECT user_id FROM identity_links WHERE channel = $1 AND channel_user_id = $2`,
        [peer.channel, peer.channelUserId],
      )).rows[0]?.user_id ?? '',
      peer.channel,
    );
    if (!before) {
      await resolverInstance.resolve(peer.channel, peer.channelUserId);
      created += 1;
    }
  }
  return created;
}
