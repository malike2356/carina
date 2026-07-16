import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from './db.js';

export interface OpsUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'superadmin' | 'admin' | 'viewer';
  is_active: boolean;
  force_password_change: boolean;
  reset_token: string | null;
  reset_token_expires_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export async function findUserByEmail(email: string): Promise<OpsUser | null> {
  const r = await query<OpsUser>(
    'SELECT * FROM ops_users WHERE lower(email) = lower($1) AND is_active = true',
    [email],
  );
  return r.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<OpsUser | null> {
  const r = await query<OpsUser>('SELECT * FROM ops_users WHERE id = $1', [id]);
  return r.rows[0] ?? null;
}

export async function listUsers(): Promise<OpsUser[]> {
  const r = await query<OpsUser>(
    'SELECT * FROM ops_users ORDER BY created_at ASC',
  );
  return r.rows;
}

export async function countUsers(): Promise<number> {
  const r = await query<{ count: string }>('SELECT COUNT(*) AS count FROM ops_users');
  return parseInt(r.rows[0]?.count ?? '0', 10);
}

export async function createUser(
  name: string,
  email: string,
  password: string,
  role: OpsUser['role'] = 'admin',
  forcePasswordChange = false,
): Promise<OpsUser> {
  const hash = await bcrypt.hash(password, 12);
  const r = await query<OpsUser>(
    `INSERT INTO ops_users (name, email, password_hash, role, force_password_change)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, email.toLowerCase().trim(), hash, role, forcePasswordChange],
  );
  return r.rows[0];
}

export async function updateUser(
  id: string,
  fields: { name?: string; email?: string; role?: OpsUser['role']; is_active?: boolean },
): Promise<OpsUser | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (fields.name !== undefined) { sets.push(`name = $${i++}`); vals.push(fields.name); }
  if (fields.email !== undefined) { sets.push(`email = $${i++}`); vals.push(fields.email.toLowerCase().trim()); }
  if (fields.role !== undefined) { sets.push(`role = $${i++}`); vals.push(fields.role); }
  if (fields.is_active !== undefined) { sets.push(`is_active = $${i++}`); vals.push(fields.is_active); }
  if (sets.length === 0) return findUserById(id);
  sets.push(`updated_at = NOW()`);
  vals.push(id);
  const r = await query<OpsUser>(
    `UPDATE ops_users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals,
  );
  return r.rows[0] ?? null;
}

export async function updatePassword(id: string, newPassword: string): Promise<void> {
  const hash = await bcrypt.hash(newPassword, 12);
  await query(
    `UPDATE ops_users
     SET password_hash = $1, force_password_change = false,
         reset_token = NULL, reset_token_expires_at = NULL, updated_at = NOW()
     WHERE id = $2`,
    [hash, id],
  );
}

export async function recordLogin(id: string): Promise<void> {
  await query('UPDATE ops_users SET last_login_at = NOW() WHERE id = $1', [id]);
}

export async function generateResetToken(id: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await query(
    'UPDATE ops_users SET reset_token = $1, reset_token_expires_at = $2, updated_at = NOW() WHERE id = $3',
    [token, expires, id],
  );
  return token;
}

export async function findUserByResetToken(token: string): Promise<OpsUser | null> {
  const r = await query<OpsUser>(
    `SELECT * FROM ops_users
     WHERE reset_token = $1 AND reset_token_expires_at > NOW() AND is_active = true`,
    [token],
  );
  return r.rows[0] ?? null;
}

export async function verifyPassword(user: OpsUser, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash);
}

export async function deleteUser(id: string): Promise<void> {
  await query('DELETE FROM ops_users WHERE id = $1', [id]);
}
