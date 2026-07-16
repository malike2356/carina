import { pool } from '../../memory/db.js';
import { encryptCredentials, decryptCredentials } from '../../channels/credential-store.js';
import type { EmailDigest } from '../../bridges/propreneur-bridge.types.js';

export interface EmailConnection {
  id: string;
  workerId: string;
  imapHost: string;
  imapPort: number;
  imapTls: boolean;
  oauthProvider: string | null;
  oauthRefreshToken: string | null;
  lastPollAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailSender {
  id: string;
  connectionId: string;
  emailAddress: string;
  roleTag: string;
  createdAt: Date;
}

function rowToConnection(row: Record<string, unknown>): EmailConnection {
  return {
    id: String(row.id),
    workerId: String(row.worker_id),
    imapHost: String(row.imap_host),
    imapPort: Number(row.imap_port ?? 993),
    imapTls: Boolean(row.imap_tls ?? true),
    oauthProvider: row.oauth_provider ? String(row.oauth_provider) : null,
    oauthRefreshToken: row.oauth_refresh_token ? String(row.oauth_refresh_token) : null,
    lastPollAt: row.last_poll_at ? new Date(String(row.last_poll_at)) : null,
    status: String(row.status),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

function rowToSender(row: Record<string, unknown>): EmailSender {
  return {
    id: String(row.id),
    connectionId: String(row.connection_id),
    emailAddress: String(row.email_address),
    roleTag: String(row.role_tag ?? 'other'),
    createdAt: new Date(String(row.created_at)),
  };
}

export async function upsertEmailConnection(
  workerId: string,
  params: {
    imapHost: string;
    imapPort: number;
    imapTls: boolean;
    username: string;
    password?: string;
    oauthProvider?: string | null;
    oauthRefreshToken?: string | null;
    status?: string;
  },
): Promise<EmailConnection> {
  const encrypted = encryptCredentials({
    username: params.username,
    password: params.password ?? '',
  });
  const encryptedRefreshToken = params.oauthRefreshToken
    ? encryptCredentials({ refreshToken: params.oauthRefreshToken })
    : null;

  const existing = await pool.query(
    'SELECT id FROM worker_email_connections WHERE worker_id = $1',
    [workerId],
  );

  if (existing.rows.length > 0) {
    const result = await pool.query(
      `UPDATE worker_email_connections
       SET imap_host = $2, imap_port = $3, imap_tls = $4, encrypted_credentials = $5,
           status = $6, oauth_provider = $7, oauth_refresh_token = $8, updated_at = NOW()
       WHERE worker_id = $1
       RETURNING *`,
      [
        workerId,
        params.imapHost,
        params.imapPort,
        params.imapTls,
        encrypted,
        params.status ?? 'connected',
        params.oauthProvider ?? null,
        encryptedRefreshToken,
      ],
    );
    return rowToConnection(result.rows[0]);
  }

  const result = await pool.query(
    `INSERT INTO worker_email_connections
       (worker_id, imap_host, imap_port, imap_tls, encrypted_credentials, status, oauth_provider, oauth_refresh_token)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      workerId,
      params.imapHost,
      params.imapPort,
      params.imapTls,
      encrypted,
      params.status ?? 'connected',
      params.oauthProvider ?? null,
      encryptedRefreshToken,
    ],
  );
  return rowToConnection(result.rows[0]);
}

export async function getEmailConnection(workerId: string): Promise<EmailConnection | null> {
  const result = await pool.query(
    'SELECT * FROM worker_email_connections WHERE worker_id = $1',
    [workerId],
  );
  if (result.rows.length === 0) return null;
  return rowToConnection(result.rows[0]);
}

export async function getEmailCredentials(workerId: string): Promise<{ username: string; password: string } | null> {
  const result = await pool.query(
    'SELECT encrypted_credentials FROM worker_email_connections WHERE worker_id = $1',
    [workerId],
  );
  if (result.rows.length === 0) return null;
  const creds = decryptCredentials(String(result.rows[0].encrypted_credentials));
  const username = creds.username ?? '';
  const password = creds.password ?? '';
  if (!username || !password) return null;
  return { username, password };
}

export async function getEmailOAuthCredentials(workerId: string): Promise<{ username: string; refreshToken: string } | null> {
  const result = await pool.query(
    'SELECT encrypted_credentials, oauth_refresh_token FROM worker_email_connections WHERE worker_id = $1',
    [workerId],
  );
  if (result.rows.length === 0) return null;
  const creds = decryptCredentials(String(result.rows[0].encrypted_credentials));
  const tokenBlob = result.rows[0].oauth_refresh_token;
  if (!tokenBlob) return null;
  const token = decryptCredentials(String(tokenBlob));
  const username = creds.username ?? '';
  const refreshToken = token.refreshToken ?? '';
  if (!username || !refreshToken) return null;
  return { username, refreshToken };
}

export async function updateConnectionStatus(workerId: string, status: string): Promise<void> {
  await pool.query(
    `UPDATE worker_email_connections SET status = $2, updated_at = NOW() WHERE worker_id = $1`,
    [workerId, status],
  );
}

export async function deleteEmailConnection(workerId: string): Promise<void> {
  await pool.query('DELETE FROM worker_email_connections WHERE worker_id = $1', [workerId]);
}

export async function listSenders(connectionId: string): Promise<EmailSender[]> {
  const result = await pool.query(
    'SELECT * FROM worker_email_senders WHERE connection_id = $1 ORDER BY email_address',
    [connectionId],
  );
  return result.rows.map(rowToSender);
}

export async function addSender(
  connectionId: string,
  emailAddress: string,
  roleTag: string,
): Promise<EmailSender> {
  const result = await pool.query(
    `INSERT INTO worker_email_senders (connection_id, email_address, role_tag)
     VALUES ($1, $2, $3)
     ON CONFLICT (connection_id, email_address)
     DO UPDATE SET role_tag = EXCLUDED.role_tag
     RETURNING *`,
    [connectionId, emailAddress.trim().toLowerCase(), roleTag],
  );
  return rowToSender(result.rows[0]);
}

export async function removeSender(connectionId: string, senderId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM worker_email_senders WHERE id = $1 AND connection_id = $2',
    [senderId, connectionId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function saveDigest(
  workerId: string,
  messageId: string,
  fromAddress: string,
  roleTag: string | null,
  parsed: EmailDigest,
  category?: string,
): Promise<string> {
  const result = await pool.query(
    `INSERT INTO worker_email_digests
       (worker_id, message_id, from_address, role_tag, parsed_data, category)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (worker_id, message_id) DO UPDATE
       SET parsed_data = EXCLUDED.parsed_data,
           category = EXCLUDED.category,
           processed_at = NOW()
     RETURNING id`,
    [workerId, messageId, fromAddress, roleTag, JSON.stringify(parsed), category ?? null],
  );
  return String(result.rows[0]?.id ?? '');
}

export async function countDigestsSince(workerId: string, since: Date): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM worker_email_digests
     WHERE worker_id = $1 AND processed_at >= $2`,
    [workerId, since.toISOString()],
  );
  return Number(result.rows[0]?.n ?? 0);
}

export async function listRecentDigests(workerId: string, limit = 20): Promise<EmailDigest[]> {
  const result = await pool.query(
    `SELECT parsed_data FROM worker_email_digests
     WHERE worker_id = $1
     ORDER BY processed_at DESC
     LIMIT $2`,
    [workerId, limit],
  );
  return result.rows.map((row: Record<string, unknown>) => row.parsed_data as EmailDigest);
}

export async function listPollableConnections(): Promise<EmailConnection[]> {
  const result = await pool.query(
    `SELECT c.*
     FROM worker_email_connections c
     INNER JOIN ai_workers w ON w.id = c.worker_id
     WHERE c.status IN ('connected', 'polling')
       AND w.propreneur_tenant_slug IS NULL
     ORDER BY c.last_poll_at ASC NULLS FIRST`,
  );
  return result.rows.map(rowToConnection);
}

export async function updateLastPollAt(workerId: string, status: string): Promise<void> {
  await pool.query(
    `UPDATE worker_email_connections
     SET last_poll_at = NOW(), status = $2, updated_at = NOW()
     WHERE worker_id = $1`,
    [workerId, status],
  );
}

export async function digestExists(workerId: string, messageId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM worker_email_digests WHERE worker_id = $1 AND message_id = $2 LIMIT 1`,
    [workerId, messageId],
  );
  return result.rows.length > 0;
}

export async function countDigestsForWorker(workerId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM worker_email_digests WHERE worker_id = $1`,
    [workerId],
  );
  return Number(result.rows[0]?.n ?? 0);
}
