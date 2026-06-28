import { pool } from '../memory/db.js';

export interface WorkspaceContact {
  workspaceId: string;
  ownerEmail: string;
  ownerName: string;
  unsubscribeToken: string;
  marketingOptOut: boolean;
}

function rowToContact(row: Record<string, unknown>): WorkspaceContact {
  return {
    workspaceId: String(row.workspace_id),
    ownerEmail: String(row.owner_email),
    ownerName: String(row.owner_name ?? ''),
    unsubscribeToken: String(row.email_unsubscribe_token),
    marketingOptOut: Boolean(row.email_marketing_opt_out),
  };
}

export async function upsertWorkspaceContact(
  workspaceId: string,
  ownerEmail: string,
  ownerName = '',
): Promise<WorkspaceContact> {
  const result = await pool.query(
    `INSERT INTO aiva_workspace_contacts (workspace_id, owner_email, owner_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (workspace_id) DO UPDATE SET
       owner_email = EXCLUDED.owner_email,
       owner_name = COALESCE(NULLIF(EXCLUDED.owner_name, ''), aiva_workspace_contacts.owner_name),
       updated_at = NOW()
     RETURNING *`,
    [workspaceId, ownerEmail.trim().toLowerCase(), ownerName.trim()],
  );
  return rowToContact(result.rows[0]);
}

export async function getWorkspaceContact(workspaceId: string): Promise<WorkspaceContact | null> {
  const result = await pool.query(
    'SELECT * FROM aiva_workspace_contacts WHERE workspace_id = $1 LIMIT 1',
    [workspaceId],
  );
  if (result.rows.length === 0) return null;
  return rowToContact(result.rows[0]);
}

export async function isMarketingOptedOut(workspaceId: string): Promise<boolean> {
  const contact = await getWorkspaceContact(workspaceId);
  return contact?.marketingOptOut ?? false;
}

export async function getContactByUnsubscribeToken(token: string): Promise<WorkspaceContact | null> {
  const result = await pool.query(
    'SELECT * FROM aiva_workspace_contacts WHERE email_unsubscribe_token = $1 LIMIT 1',
    [token],
  );
  if (result.rows.length === 0) return null;
  return rowToContact(result.rows[0]);
}

export async function setMarketingOptOutByToken(token: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE aiva_workspace_contacts
     SET email_marketing_opt_out = TRUE, updated_at = NOW()
     WHERE email_unsubscribe_token = $1
     RETURNING workspace_id`,
    [token],
  );
  return (result.rowCount ?? 0) > 0;
}

export function firstName(fullName: string, fallbackEmail?: string): string {
  const trimmed = fullName.trim();
  if (trimmed) return trimmed.split(/\s+/)[0] ?? trimmed;
  if (fallbackEmail) return fallbackEmail.split('@')[0] ?? 'there';
  return 'there';
}

export function aivaAppUrl(path = ''): string {
  const base =
    process.env.AIVA_APP_URL ??
    process.env.APP_URL ??
    `https://${process.env.AIVA_PRODUCT_HOST ?? 'admin.hireaiva.co.uk'}`;
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export function unsubscribeUrl(token: string): string {
  return `${aivaAppUrl('/api/auth/unsubscribe')}?token=${encodeURIComponent(token)}`;
}
