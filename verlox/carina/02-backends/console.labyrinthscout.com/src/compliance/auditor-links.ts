import { randomBytes, randomUUID } from 'node:crypto';
import { pool } from '../db.js';

export interface AuditorLink {
  id: string;
  token: string;
  url: string;
  expiresAt: string;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
}

interface AuditorLinkRow {
  id: string;
  token: string;
  created_by: string;
  expires_at: string;
  access_count: number;
  last_accessed_at: string | null;
  revoked: boolean;
  created_at: string;
}

function baseUrl(): string {
  return (
    process.env.SCOUT_BASE_URL ??
    process.env.SCOUT_DASHBOARD_URL?.replace(/\/dashboard.*$/, '') ??
    'https://console.labyrinthscout.com'
  );
}

function mapLink(row: AuditorLinkRow): AuditorLink {
  return {
    id: row.id,
    token: row.token,
    url: `${baseUrl()}/audit/${row.token}`,
    expiresAt: row.expires_at,
    accessCount: row.access_count,
    lastAccessedAt: row.last_accessed_at,
    createdAt: row.created_at,
  };
}

export async function createAuditorLink(createdBy: string): Promise<AuditorLink> {
  const token = randomBytes(16).toString('hex');
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);

  const result = await pool.query<AuditorLinkRow>(
    `INSERT INTO compliance_auditor_links (id, token, created_by, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, token, created_by, expires_at, access_count, last_accessed_at, revoked, created_at`,
    [randomUUID(), token, createdBy, expiresAt.toISOString()],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Auditor link insert returned no row');
  return mapLink(row);
}

export async function revokeAuditorLink(token: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE compliance_auditor_links
     SET revoked = TRUE, revoked_at = NOW()
     WHERE token = $1 AND revoked = FALSE`,
    [token],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listActiveAuditorLinks(): Promise<AuditorLink[]> {
  const result = await pool.query<AuditorLinkRow>(
    `SELECT id, token, created_by, expires_at, access_count, last_accessed_at, revoked, created_at
     FROM compliance_auditor_links
     WHERE revoked = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC`,
  );
  return result.rows.map(mapLink);
}

export async function validateAuditorToken(token: string): Promise<boolean> {
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM compliance_auditor_links
     WHERE token = $1 AND revoked = FALSE AND expires_at > NOW()`,
    [token],
  );
  const row = result.rows[0];
  if (!row) return false;

  await pool.query(
    `UPDATE compliance_auditor_links
     SET access_count = access_count + 1, last_accessed_at = NOW()
     WHERE id = $1`,
    [row.id],
  );
  return true;
}
