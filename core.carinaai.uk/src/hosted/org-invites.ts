import crypto from 'crypto';
import { pool } from '../memory/db.js';
import { writeProductAudit } from './product-audit.js';
import { buildInviteUrl, sendInviteEmail } from './invite-email.js';
import type { OrgInviteRow, OrgRole } from './org-types.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_INVITES_PER_DAY = 20;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function hashEmailForAudit(email: string): { emailHash: string; emailDomain: string } {
  const domain = email.includes('@') ? email.split('@')[1] ?? 'unknown' : 'unknown';
  return {
    emailHash: crypto.createHash('sha256').update(email).digest('hex').slice(0, 16),
    emailDomain: domain,
  };
}

export class InviteRateLimitError extends Error {
  readonly statusCode = 429;

  constructor() {
    super('Invite rate limit reached (20 per day)');
  }
}

async function countInvitesToday(orgId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count
     FROM org_invites
     WHERE org_id = $1 AND created_at >= CURRENT_DATE`,
    [orgId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function getOrgName(orgId: string): Promise<string> {
  const result = await pool.query<{ name: string }>(
    'SELECT name FROM organizations WHERE id = $1',
    [orgId],
  );
  return String(result.rows[0]?.name ?? 'your organization');
}

async function getInviterEmail(userId: string): Promise<string | undefined> {
  const result = await pool.query<{ email: string }>(
    'SELECT email FROM hosted_users WHERE id = $1',
    [userId],
  );
  return result.rows[0]?.email ? String(result.rows[0].email) : undefined;
}

export async function createInvite(
  orgId: string,
  email: string,
  role: Exclude<OrgRole, 'owner'>,
  invitedBy: string,
): Promise<{ inviteId: string; token: string; emailSent: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();
  const sentToday = await countInvitesToday(orgId);
  if (sentToday >= MAX_INVITES_PER_DAY) {
    throw new InviteRateLimitError();
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const result = await pool.query(
    `INSERT INTO org_invites (org_id, email, role, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [orgId, normalizedEmail, role, tokenHash, expiresAt],
  );

  const inviteId = String(result.rows[0].id);
  const orgName = await getOrgName(orgId);
  const inviterEmail = await getInviterEmail(invitedBy);
  const inviteUrl = buildInviteUrl(rawToken);
  const emailSent = await sendInviteEmail({
    to: normalizedEmail,
    orgName,
    role,
    inviteUrl,
    inviterEmail,
  });

  const emailAudit = hashEmailForAudit(normalizedEmail);
  await writeProductAudit({
    orgId,
    actorUserId: invitedBy,
    action: 'org.member_invited',
    resourceType: 'org_invite',
    resourceId: inviteId,
    details: { ...emailAudit, role, emailSent },
  });

  return { inviteId, token: rawToken, emailSent };
}

export async function acceptInvite(
  token: string,
  userId: string,
): Promise<{ orgId: string; role: OrgRole }> {
  const tokenHash = hashToken(token);
  const result = await pool.query(
    `SELECT id, org_id, email, role
     FROM org_invites
     WHERE token_hash = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
    [tokenHash],
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new Error('Invalid or expired invite');
  }

  const row = result.rows[0];
  const orgId = String(row.org_id);
  const role = row.role as OrgRole;
  const inviteEmail = String(row.email).toLowerCase();

  const userResult = await pool.query('SELECT email FROM hosted_users WHERE id = $1', [userId]);
  if ((userResult.rowCount ?? 0) === 0) {
    throw new Error('User not found');
  }
  const userEmail = String(userResult.rows[0].email).toLowerCase();
  if (userEmail !== inviteEmail) {
    throw new Error('Invite email does not match signed-in account');
  }

  const existing = await pool.query(
    'SELECT 1 FROM org_memberships WHERE org_id = $1 AND user_id = $2',
    [orgId, userId],
  );
  if ((existing.rowCount ?? 0) > 0) {
    throw new Error('Already a member of this organization');
  }

  await pool.query(
    `INSERT INTO org_memberships (org_id, user_id, role)
     VALUES ($1, $2, $3)`,
    [orgId, userId, role],
  );

  await pool.query('UPDATE org_invites SET accepted_at = NOW() WHERE id = $1', [row.id]);

  const emailAudit = hashEmailForAudit(inviteEmail);
  await writeProductAudit({
    orgId,
    actorUserId: userId,
    action: 'org.member_joined',
    resourceType: 'org_membership',
    details: { ...emailAudit, role },
  });

  return { orgId, role };
}

export async function listPendingInvites(orgId: string): Promise<OrgInviteRow[]> {
  const result = await pool.query(
    `SELECT id, org_id, email, role, expires_at, accepted_at
     FROM org_invites
     WHERE org_id = $1 AND accepted_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [orgId],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    orgId: String(row.org_id),
    email: String(row.email),
    role: row.role as OrgInviteRow['role'],
    expiresAt: row.expires_at as Date,
    acceptedAt: row.accepted_at as Date | null,
  }));
}

export async function revokeInvite(orgId: string, inviteId: string): Promise<void> {
  await pool.query(
    `DELETE FROM org_invites
     WHERE id = $1 AND org_id = $2 AND accepted_at IS NULL`,
    [inviteId, orgId],
  );
}
