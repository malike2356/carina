/**
 * Upfront contactId normalization for Aiva multi-channel sessions.
 *
 * Collapses web guest/auth variants (app, app:{uuid}, auto:{uuid}, contact-auto-*)
 * and linked channel peers onto one canonical contact id before session resolution.
 */
import { createHash } from 'node:crypto';
import { isDatabaseConfigured } from '../../config/database-url.js';
import { pool } from '../db.js';
import {
  aivaContactIdentityEnabled,
  ensureAivaContactIdentitySchema,
  listLinkedChannelContactIds,
} from './contact-identity.js';
import {
  isOwnerChannelPeer,
  isWebOwnerContactId,
  OWNER_CANONICAL_CONTACT_ID,
  ownerAutoSyncEnabled,
} from './owner-auto-sync.js';

export type ContactNormalizationConfidence = 'exact' | 'high' | 'medium' | 'low';

export type ContactResolutionMethod =
  | 'workspace_owner'
  | 'auth_token'
  | 'channel_identity'
  | 'heuristic'
  | 'passthrough';

export interface ContactNormalizationResult {
  canonicalContactId: string;
  aliases: string[];
  confidence: ContactNormalizationConfidence;
  resolutionMethod: ContactResolutionMethod;
}

let schemaReady: Promise<void> | null = null;

export async function ensureContactNormalizationSchema(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_contact_resolution_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id TEXT NOT NULL,
          worker_id TEXT NOT NULL,
          raw_contact_id TEXT NOT NULL,
          channel TEXT NOT NULL,
          resolution_method TEXT NOT NULL,
          canonical_contact_id TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_contact_resolution_workspace_worker
          ON aiva_contact_resolution_log (workspace_id, worker_id, created_at DESC)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_contact_resolution_raw
          ON aiva_contact_resolution_log (workspace_id, worker_id, raw_contact_id, created_at DESC)
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

/** Owner / guest web peer ids that should collapse to workspace-owner. */
export function isOwnerLikeContactId(raw: string): boolean {
  const id = raw.trim();
  if (!id) return true;
  if (isWebOwnerContactId(id)) return true;
  if (id === OWNER_CANONICAL_CONTACT_ID) return true;
  if (id === '1' || id === '0' || id === 'null' || id === 'undefined') return true;
  if (id === 'contact-1' || id === 'contact-workspace-owner') return true;
  if (id.startsWith('auto:')) return true;
  if (id.startsWith('contact-auto-')) return true;
  if (id.startsWith('contact-app')) return true;
  return false;
}

function stableGuestFingerprint(seed: string): string {
  const hash = createHash('sha256').update(seed).digest('hex').slice(0, 16);
  return `app:${hash}`;
}

/**
 * Normalize inbound web contact ids before session resolution.
 * Authenticated callers should pass profile/user UUID via metadata.
 */
export function normalizeWebContactIdInput(opts: {
  rawContactId: string;
  sessionToken?: string;
  authenticatedUserId?: string;
}): string {
  const raw = opts.rawContactId.trim();
  if (opts.authenticatedUserId?.trim()) {
    return opts.authenticatedUserId.trim();
  }
  if (isOwnerLikeContactId(raw) || raw === 'app' || raw.startsWith('app:')) {
    if (raw.startsWith('app:') && raw.length > 4) return raw;
    const seed = opts.sessionToken?.trim() || raw || 'guest';
    if (raw === 'app' || isOwnerLikeContactId(raw)) {
      // Keep explicit app:{fingerprint} when already stable; otherwise derive one.
      if (raw.startsWith('app:') && raw.length > 4) return raw;
      return stableGuestFingerprint(seed);
    }
  }
  return raw || stableGuestFingerprint(opts.sessionToken?.trim() || 'guest');
}

async function loadAliases(opts: {
  workspaceId: string;
  workerId: string;
  canonicalContactId: string;
  rawContactId: string;
}): Promise<string[]> {
  const aliases = new Set<string>([opts.rawContactId, opts.canonicalContactId]);
  if (!aivaContactIdentityEnabled()) return Array.from(aliases);
  try {
    const linked = await listLinkedChannelContactIds({
      workspaceId: opts.workspaceId,
      workerId: opts.workerId,
      canonicalContactId: opts.canonicalContactId,
    });
    for (const id of linked) aliases.add(id);
  } catch {
    /* optional */
  }
  return Array.from(aliases);
}

export async function normalizeContact(params: {
  workspaceId: string;
  workerId: string;
  channel: string;
  rawContactId: string;
  metadata?: {
    telegramUserId?: string;
    sessionToken?: string;
    email?: string;
    authenticatedUserId?: string;
  };
}): Promise<ContactNormalizationResult> {
  const raw = String(params.rawContactId ?? '').trim();
  const channel = String(params.channel ?? '').trim().toLowerCase();

  // 1. Workspace owner check (web guest variants + sticky owner peers)
  if (ownerAutoSyncEnabled()) {
    const ownerCandidate =
      channel === 'web' && isOwnerLikeContactId(raw)
        ? true
        : await isOwnerChannelPeer({
          workspaceId: params.workspaceId,
          workerId: params.workerId,
          channel,
          contactId: raw || 'app',
        }).catch(() => false);

    if (ownerCandidate || (channel === 'web' && isOwnerLikeContactId(raw))) {
      const canonical = OWNER_CANONICAL_CONTACT_ID;
      const aliases = await loadAliases({
        workspaceId: params.workspaceId,
        workerId: params.workerId,
        canonicalContactId: canonical,
        rawContactId: raw || 'app',
      });
      return {
        canonicalContactId: canonical,
        aliases,
        confidence: 'exact',
        resolutionMethod: 'workspace_owner',
      };
    }

    // Telegram from.id may match a linked owner peer even when chat.id differs in groups.
    const telegramUserId = params.metadata?.telegramUserId?.trim();
    if (channel === 'telegram' && telegramUserId && telegramUserId !== raw) {
      const fromIsOwner = await isOwnerChannelPeer({
        workspaceId: params.workspaceId,
        workerId: params.workerId,
        channel: 'telegram',
        contactId: telegramUserId,
      }).catch(() => false);
      if (fromIsOwner) {
        const aliases = await loadAliases({
          workspaceId: params.workspaceId,
          workerId: params.workerId,
          canonicalContactId: OWNER_CANONICAL_CONTACT_ID,
          rawContactId: raw,
        });
        aliases.push(telegramUserId);
        return {
          canonicalContactId: OWNER_CANONICAL_CONTACT_ID,
          aliases: Array.from(new Set(aliases)),
          confidence: 'exact',
          resolutionMethod: 'workspace_owner',
        };
      }
    }
  }

  // 2. Channel identity lookup (explicit /link bindings); read-only, no insert
  if (aivaContactIdentityEnabled() && raw) {
    await ensureAivaContactIdentitySchema().catch(() => undefined);
    const existing = await pool.query<{ canonical_contact_id: string }>(
      `SELECT canonical_contact_id FROM aiva_contact_identities
       WHERE workspace_id = $1 AND worker_id = $2
         AND ((channel = $3 AND channel_contact_id = $4) OR channel_contact_id = $4)
       LIMIT 1`,
      [params.workspaceId, params.workerId, channel, raw],
    ).catch(() => ({ rows: [] as Array<{ canonical_contact_id: string }> }));
    const found = existing.rows[0]?.canonical_contact_id?.trim();
    if (found) {
      const aliases = await loadAliases({
        workspaceId: params.workspaceId,
        workerId: params.workerId,
        canonicalContactId: found,
        rawContactId: raw,
      });
      return {
        canonicalContactId: found,
        aliases,
        confidence: found === raw ? 'high' : 'exact',
        resolutionMethod: 'channel_identity',
      };
    }
  }

  // 3. Auth token / authenticated user resolution
  const authUser = params.metadata?.authenticatedUserId?.trim();
  if (authUser) {
    return {
      canonicalContactId: authUser,
      aliases: [raw, authUser].filter(Boolean),
      confidence: 'high',
      resolutionMethod: 'auth_token',
    };
  }

  // 4. Telegram: numeric chat ids are stable; keep as canonical for non-owner peers
  if (channel === 'telegram' && /^\d{6,}$/.test(raw)) {
    return {
      canonicalContactId: raw,
      aliases: [raw, params.metadata?.telegramUserId].filter(Boolean) as string[],
      confidence: 'high',
      resolutionMethod: 'passthrough',
    };
  }

  // 5. Passthrough with ops log for unresolved / unstable ids
  const canonical = raw || 'unknown';
  const result: ContactNormalizationResult = {
    canonicalContactId: canonical,
    aliases: [canonical],
    confidence: 'low',
    resolutionMethod: 'passthrough',
  };
  void logUnresolvedContact({
    workspaceId: params.workspaceId,
    workerId: params.workerId,
    rawContactId: canonical,
    channel,
    resolutionMethod: result.resolutionMethod,
    canonicalContactId: result.canonicalContactId,
  }).catch(() => undefined);
  console.warn(
    `[contact-normalizer] low-confidence passthrough workspace=${params.workspaceId} worker=${params.workerId} channel=${channel} raw=${canonical}`,
  );
  return result;
}

export async function logUnresolvedContact(params: {
  workspaceId: string;
  workerId: string;
  rawContactId: string;
  channel: string;
  resolutionMethod?: string;
  canonicalContactId?: string;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await ensureContactNormalizationSchema();
  const recent = await pool.query<{ id: string }>(
    `SELECT id FROM aiva_contact_resolution_log
     WHERE workspace_id = $1 AND worker_id = $2
       AND raw_contact_id = $3
       AND created_at > NOW() - INTERVAL '1 hour'
     LIMIT 1`,
    [params.workspaceId, params.workerId, params.rawContactId],
  ).catch(() => ({ rows: [] as Array<{ id: string }> }));
  if (recent.rows.length > 0) return;

  await pool.query(
    `INSERT INTO aiva_contact_resolution_log
       (workspace_id, worker_id, raw_contact_id, channel, resolution_method, canonical_contact_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.workspaceId,
      params.workerId,
      params.rawContactId,
      params.channel,
      params.resolutionMethod ?? 'passthrough',
      params.canonicalContactId ?? params.rawContactId,
    ],
  ).catch((err) => {
    console.warn(
      '[contact-normalizer] resolution log insert failed:',
      err instanceof Error ? err.message : String(err),
    );
  });
}

export async function listUnresolvedContacts(opts: {
  workerId: string;
  workspaceId?: string;
  hours?: number;
}): Promise<Array<{
  rawContactId: string;
  channel: string;
  resolutionMethod: string;
  canonicalContactId: string;
  count: number;
  lastSeenAt: string;
}>> {
  if (!isDatabaseConfigured()) return [];
  await ensureContactNormalizationSchema();
  const hours = Math.min(168, Math.max(1, opts.hours ?? 24));
  const result = await pool.query<{
    raw_contact_id: string;
    channel: string;
    resolution_method: string;
    canonical_contact_id: string;
    count: string;
    last_seen_at: string;
  }>(
    `SELECT raw_contact_id, channel, resolution_method, canonical_contact_id,
            COUNT(*)::text AS count,
            MAX(created_at)::text AS last_seen_at
     FROM aiva_contact_resolution_log
     WHERE worker_id = $1
       AND ($2::text IS NULL OR workspace_id = $2)
       AND created_at > NOW() - ($3::text || ' hours')::interval
       AND resolution_method IN ('passthrough', 'heuristic')
     GROUP BY raw_contact_id, channel, resolution_method, canonical_contact_id
     ORDER BY MAX(created_at) DESC
     LIMIT 200`,
    [opts.workerId, opts.workspaceId ?? null, String(hours)],
  );
  return result.rows.map((row) => ({
    rawContactId: String(row.raw_contact_id),
    channel: String(row.channel),
    resolutionMethod: String(row.resolution_method),
    canonicalContactId: String(row.canonical_contact_id),
    count: Number(row.count) || 0,
    lastSeenAt: String(row.last_seen_at),
  }));
}
