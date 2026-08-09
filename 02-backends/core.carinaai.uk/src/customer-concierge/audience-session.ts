/**
 * Audience session principal store (Prompt 701).
 * Public visitors are never workspace members.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { pool } from '../memory/db.js';

export type AudienceSessionMode = 'public' | 'preview';
export type AudienceConsentState = 'unknown' | 'granted' | 'denied' | 'withdrawn';
export type AudienceRiskState = 'normal' | 'elevated' | 'blocked';
export type AudienceSessionStatus = 'active' | 'handed_off' | 'closed';

export interface AudienceIdentityRecord {
  id: string;
  workspaceId: string;
  channel: string;
  externalKey: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  crmContactId: string | null;
}

export interface AudienceSessionRecord {
  id: string;
  workspaceId: string;
  workerId: string;
  conciergeProfileId: string | null;
  identityId: string;
  channel: string;
  sessionMode: AudienceSessionMode;
  widgetSessionToken: string | null;
  origin: string | null;
  locale: string | null;
  consentState: AudienceConsentState;
  riskState: AudienceRiskState;
  status: AudienceSessionStatus;
  expiresAt: string;
  lastActiveAt: string;
  createdAt: string;
}

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function mapIdentity(row: Record<string, unknown>): AudienceIdentityRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    channel: String(row.channel),
    externalKey: String(row.external_key),
    displayName: row.display_name != null ? String(row.display_name) : null,
    email: row.email != null ? String(row.email) : null,
    phone: row.phone != null ? String(row.phone) : null,
    crmContactId: row.crm_contact_id != null ? String(row.crm_contact_id) : null,
  };
}

function mapSession(row: Record<string, unknown>): AudienceSessionRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    workerId: String(row.worker_id),
    conciergeProfileId: row.concierge_profile_id != null ? String(row.concierge_profile_id) : null,
    identityId: String(row.identity_id),
    channel: String(row.channel),
    sessionMode: String(row.session_mode) as AudienceSessionMode,
    widgetSessionToken: row.widget_session_token != null ? String(row.widget_session_token) : null,
    origin: row.origin != null ? String(row.origin) : null,
    locale: row.locale != null ? String(row.locale) : null,
    consentState: String(row.consent_state) as AudienceConsentState,
    riskState: String(row.risk_state) as AudienceRiskState,
    status: String(row.status) as AudienceSessionStatus,
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    lastActiveAt: new Date(String(row.last_active_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function upsertAudienceIdentity(input: {
  workspaceId: string;
  channel: string;
  externalKey: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  crmContactId?: string | null;
}): Promise<AudienceIdentityRecord> {
  const result = await pool.query(
    `INSERT INTO audience_identities (
       workspace_id, channel, external_key, display_name, email, phone, crm_contact_id, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
     ON CONFLICT (workspace_id, channel, external_key) DO UPDATE SET
       display_name = COALESCE(EXCLUDED.display_name, audience_identities.display_name),
       email = COALESCE(EXCLUDED.email, audience_identities.email),
       phone = COALESCE(EXCLUDED.phone, audience_identities.phone),
       crm_contact_id = COALESCE(EXCLUDED.crm_contact_id, audience_identities.crm_contact_id),
       updated_at = NOW()
     RETURNING *`,
    [
      input.workspaceId,
      input.channel,
      input.externalKey,
      input.displayName ?? null,
      input.email ?? null,
      input.phone ?? null,
      input.crmContactId ?? null,
    ],
  );
  return mapIdentity(result.rows[0] as Record<string, unknown>);
}

export async function createAudienceSession(input: {
  workspaceId: string;
  workerId: string;
  conciergeProfileId?: string | null;
  identityId: string;
  channel?: string;
  sessionMode: AudienceSessionMode;
  widgetSessionToken?: string | null;
  origin?: string | null;
  locale?: string | null;
  ttlMs?: number;
}): Promise<AudienceSessionRecord> {
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS));
  const result = await pool.query(
    `INSERT INTO audience_sessions (
       workspace_id, worker_id, concierge_profile_id, identity_id, channel, session_mode,
       widget_session_token, origin, locale, expires_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      input.workspaceId,
      input.workerId,
      input.conciergeProfileId ?? null,
      input.identityId,
      input.channel ?? 'web',
      input.sessionMode,
      input.widgetSessionToken ?? null,
      input.origin ?? null,
      input.locale ?? null,
      expiresAt.toISOString(),
    ],
  );
  return mapSession(result.rows[0] as Record<string, unknown>);
}

export async function getAudienceSessionByWidgetToken(
  widgetSessionToken: string,
): Promise<AudienceSessionRecord | null> {
  const result = await pool.query(
    `SELECT * FROM audience_sessions
     WHERE widget_session_token = $1
     LIMIT 1`,
    [widgetSessionToken],
  );
  if (!result.rows[0]) return null;
  return mapSession(result.rows[0] as Record<string, unknown>);
}

export async function touchAudienceSession(sessionId: string): Promise<void> {
  await pool.query(
    `UPDATE audience_sessions SET last_active_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [sessionId],
  );
}

export async function convertAudienceIdentityToKnown(input: {
  workspaceId: string;
  identityId: string;
  email: string;
  displayName?: string | null;
}): Promise<AudienceIdentityRecord> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) {
    throw Object.assign(new Error('Valid email is required'), { status: 400 });
  }
  const result = await pool.query(
    `UPDATE audience_identities SET
       email = $3,
       display_name = COALESCE($4, display_name),
       updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2
     RETURNING *`,
    [input.identityId, input.workspaceId, email, input.displayName ?? null],
  );
  if (!result.rows[0]) {
    throw Object.assign(new Error('Audience identity not found'), { status: 404 });
  }
  return mapIdentity(result.rows[0] as Record<string, unknown>);
}

export function isAudienceSessionUsable(session: AudienceSessionRecord): boolean {
  if (session.status !== 'active') return false;
  if (session.riskState === 'blocked') return false;
  if (Date.parse(session.expiresAt) <= Date.now()) return false;
  return true;
}

function embedSigningKey(): string {
  return (
    process.env.AIVA_WIDGET_EMBED_SECRET?.trim()
    || process.env.CHANNEL_CREDENTIAL_KEY?.trim()
    || 'carina-widget-embed-dev'
  );
}

export function signWidgetEmbedConfig(payload: {
  workerId: string;
  workspaceId: string;
  nonce: string;
  exp: number;
}): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', embedSigningKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyWidgetEmbedConfig(
  token: string,
  expectedWorkerId: string,
): { workerId: string; workspaceId: string; nonce: string; exp: number } | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', embedSigningKey()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      workerId?: string;
      workspaceId?: string;
      nonce?: string;
      exp?: number;
    };
    if (!parsed.workerId || !parsed.workspaceId || !parsed.nonce || typeof parsed.exp !== 'number') {
      return null;
    }
    if (parsed.workerId !== expectedWorkerId) return null;
    if (Date.now() > parsed.exp) return null;
    return {
      workerId: parsed.workerId,
      workspaceId: parsed.workspaceId,
      nonce: parsed.nonce,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function newEmbedNonce(): string {
  return randomBytes(16).toString('hex');
}

export function isOriginAllowed(
  origin: string | undefined,
  allowlist: string[] | undefined,
): boolean {
  if (!allowlist || allowlist.length === 0) return true;
  if (!origin) return false;
  const normalized = origin.trim().toLowerCase().replace(/\/$/, '');
  return allowlist.some((entry) => {
    const allowed = entry.trim().toLowerCase().replace(/\/$/, '');
    return allowed.length > 0 && allowed === normalized;
  });
}

/** DSAR / export linkage: list audience identities for a workspace (Prompt 701). */
export async function listAudienceIdentitiesForWorkspace(
  workspaceId: string,
): Promise<AudienceIdentityRecord[]> {
  const result = await pool.query(
    `SELECT * FROM audience_identities WHERE workspace_id = $1 ORDER BY created_at ASC`,
    [workspaceId],
  );
  return result.rows.map((row) => mapIdentity(row as Record<string, unknown>));
}

/** DSAR erasure: remove audience sessions + identity (conversation history stays on widget contact). */
export async function eraseAudienceIdentity(input: {
  workspaceId: string;
  identityId: string;
}): Promise<{ sessionsDeleted: number; identityDeleted: boolean }> {
  const sessions = await pool.query(
    `DELETE FROM audience_sessions WHERE workspace_id = $1 AND identity_id = $2`,
    [input.workspaceId, input.identityId],
  );
  const identity = await pool.query(
    `DELETE FROM audience_identities WHERE workspace_id = $1 AND id = $2`,
    [input.workspaceId, input.identityId],
  );
  return {
    sessionsDeleted: sessions.rowCount ?? 0,
    identityDeleted: (identity.rowCount ?? 0) > 0,
  };
}
