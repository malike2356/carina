import { pool } from '../memory/db.js';

export interface WorkspaceContact {
  workspaceId: string;
  ownerEmail: string;
  ownerName: string;
  ownerPhone: string;
  preferredName: string;
  workFunction: string;
  personalPreferences: string;
  unsubscribeToken: string;
  marketingOptOut: boolean;
}

export type WorkspaceProfilePatch = {
  ownerName?: string;
  ownerPhone?: string;
  preferredName?: string;
  workFunction?: string;
  personalPreferences?: string;
  marketingOptOut?: boolean;
};

function rowToContact(row: Record<string, unknown>): WorkspaceContact {
  return {
    workspaceId: String(row.workspace_id),
    ownerEmail: String(row.owner_email),
    ownerName: String(row.owner_name ?? ''),
    ownerPhone: String(row.owner_phone ?? ''),
    preferredName: String(row.preferred_name ?? ''),
    workFunction: String(row.work_function ?? ''),
    personalPreferences: String(row.personal_preferences ?? ''),
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

export async function updateWorkspaceOwnerProfile(
  workspaceId: string,
  patch: WorkspaceProfilePatch,
): Promise<WorkspaceContact | null> {
  const existing = await getWorkspaceContact(workspaceId);
  if (!existing) return null;

  const result = await pool.query(
    `UPDATE aiva_workspace_contacts SET
       owner_name = COALESCE(NULLIF($2, ''), owner_name),
       owner_phone = COALESCE(NULLIF($3, ''), owner_phone),
       preferred_name = COALESCE(NULLIF($4, ''), preferred_name),
       work_function = COALESCE(NULLIF($5, ''), work_function),
       personal_preferences = COALESCE(NULLIF($6, ''), personal_preferences),
       email_marketing_opt_out = COALESCE($7, email_marketing_opt_out),
       updated_at = NOW()
     WHERE workspace_id = $1
     RETURNING *`,
    [
      workspaceId,
      patch.ownerName?.trim() ?? null,
      patch.ownerPhone?.trim() ?? null,
      patch.preferredName?.trim() ?? null,
      patch.workFunction?.trim() ?? null,
      patch.personalPreferences?.trim() ?? null,
      patch.marketingOptOut ?? null,
    ],
  );
  if (result.rows.length === 0) return null;
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

export function serializeWorkspaceProfile(contact: WorkspaceContact) {
  return {
    ownerEmail: contact.ownerEmail,
    ownerName: contact.ownerName,
    ownerPhone: contact.ownerPhone,
    preferredName: contact.preferredName,
    workFunction: contact.workFunction,
    personalPreferences: contact.personalPreferences,
    marketingOptOut: contact.marketingOptOut,
  };
}
