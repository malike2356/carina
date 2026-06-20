import crypto from 'crypto';
import { pool, query } from './db.js';
import { normalizePlanId, planTier, type BillingPlanId } from './billing-plans.js';
import { runHostedMigrations } from './hosted-migrations.js';
import { logAudit } from './tenant-audit.js';

async function ensureSchemaReady(): Promise<void> {
  const client = await pool.connect();
  try {
    await runHostedMigrations(client);
  } finally {
    client.release();
  }
}

export type ProvisioningType = 'saas' | 'manual' | 'trial';
export type AccessStatus = 'active' | 'suspended' | 'trial';

export interface CreateTenantInput {
  email: string;
  password: string;
  displayName?: string;
  companyName?: string;
  plan: BillingPlanId;
  provisioningType: ProvisioningType;
  accessStatus: AccessStatus;
  skillPacks: string[];
  notes?: string;
  dailyMessageLimit?: number | null;
}

export interface CreateTenantResult {
  userId: string;
  apiKey: string;
  tempPassword: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function generateTempPassword(): string {
  return crypto.randomBytes(12).toString('base64url');
}

export function generateApiKey(): string {
  return `carina_${crypto.randomBytes(24).toString('hex')}`;
}

export function generateSchemaName(): string {
  return `u_${crypto.randomBytes(8).toString('hex')}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateCreateTenantInput(input: CreateTenantInput): string | null {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes('@')) return 'A valid email address is required.';
  if (!input.password || input.password.length < 8) return 'Password must be at least 8 characters.';
  if (!input.displayName?.trim() && !input.companyName?.trim()) {
    return 'Provide a tenant name or company name.';
  }
  return null;
}

export async function emailExists(email: string): Promise<boolean> {
  const result = await query<{ id: string }>(
    'SELECT id FROM hosted_users WHERE email = $1',
    [normalizeEmail(email)],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function createTenantDirect(input: CreateTenantInput): Promise<CreateTenantResult> {
  const validationError = validateCreateTenantInput(input);
  if (validationError) throw new Error(validationError);

  await ensureSchemaReady();

  const email = normalizeEmail(input.email);
  if (await emailExists(email)) throw new Error(`Email already registered: ${email}`);

  const apiKey = generateApiKey();
  const schemaName = generateSchemaName();
  const passwordHash = hashPassword(input.password);
  const displayName = input.displayName?.trim() || input.companyName?.trim() || email;
  const plan = normalizePlanId(input.plan);
  const tier = planTier(plan);
  const subscriptionStatus = input.accessStatus === 'suspended' ? 'suspended' : 'active';
  const provisioningSource = input.provisioningType === 'saas' ? 'saas' : 'manual';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query<{ id: string }>(
      `INSERT INTO hosted_users (
         email, password_hash, api_key, schema_name, tier,
         display_name, company_name, provisioning_type, access_status,
         notes, daily_message_limit, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       RETURNING id`,
      [
        email,
        passwordHash,
        apiKey,
        schemaName,
        tier,
        displayName,
        input.companyName?.trim() || null,
        input.provisioningType,
        input.accessStatus,
        input.notes?.trim() || null,
        input.dailyMessageLimit ?? null,
      ],
    );

    const userId = String(userResult.rows[0].id);
    const safeSchema = schemaName.replace(/[^a-z0-9_]/gi, '');
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${safeSchema}"`);

    await client.query(
      `INSERT INTO subscriptions (
         tenant_id, plan, status, provisioning_source, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (tenant_id)
       DO UPDATE SET
         plan = EXCLUDED.plan,
         status = EXCLUDED.status,
         provisioning_source = EXCLUDED.provisioning_source,
         updated_at = NOW()`,
      [userId, plan, subscriptionStatus, provisioningSource],
    );

    for (const packName of input.skillPacks) {
      const trimmed = packName.trim();
      if (!trimmed) continue;
      await client.query(
        `INSERT INTO installed_packs (tenant_id, pack_name, status, installed_at)
         VALUES ($1, $2, 'installed', NOW())
         ON CONFLICT (tenant_id, pack_name) DO NOTHING`,
        [userId, trimmed],
      );
    }

    await client.query('COMMIT');

    await logAudit('tenant_created', {
      email,
      displayName,
      plan,
      provisioningType: input.provisioningType,
      accessStatus: input.accessStatus,
      skillPacks: input.skillPacks,
    }, userId);

    return { userId, apiKey, tempPassword: input.password };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateTenantAccess(
  tenantId: string,
  accessStatus: AccessStatus,
): Promise<boolean> {
  const subStatus = accessStatus === 'suspended' ? 'suspended' : 'active';
  const result = await query(
    `UPDATE hosted_users
     SET access_status = $1, updated_at = NOW()
     WHERE id = $2`,
    [accessStatus, tenantId],
  );
  if ((result.rowCount ?? 0) === 0) return false;

  await query(
    `UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE tenant_id = $2`,
    [subStatus, tenantId],
  );

  await logAudit('access_changed', { accessStatus, subscriptionStatus: subStatus }, tenantId);
  return true;
}

export async function updateTenantSubscription(
  tenantId: string,
  plan: BillingPlanId,
  provisioningSource: 'saas' | 'manual' = 'manual',
): Promise<boolean> {
  const normalized = normalizePlanId(plan);
  const tier = planTier(normalized);

  const userResult = await query(
    `UPDATE hosted_users SET tier = $1, updated_at = NOW() WHERE id = $2`,
    [tier, tenantId],
  );
  if ((userResult.rowCount ?? 0) === 0) return false;

  await query(
    `INSERT INTO subscriptions (tenant_id, plan, status, provisioning_source, created_at, updated_at)
     VALUES ($1, $2, 'active', $3, NOW(), NOW())
     ON CONFLICT (tenant_id)
     DO UPDATE SET
       plan = EXCLUDED.plan,
       provisioning_source = EXCLUDED.provisioning_source,
       updated_at = NOW()`,
    [tenantId, normalized, provisioningSource],
  );

  await logAudit('plan_changed', { plan: normalized, provisioningSource }, tenantId);
  return true;
}

export async function updateTenantNotes(tenantId: string, notes: string): Promise<boolean> {
  const result = await query(
    `UPDATE hosted_users SET notes = $1, updated_at = NOW() WHERE id = $2`,
    [notes.trim() || null, tenantId],
  );
  if ((result.rowCount ?? 0) === 0) return false;
  await logAudit('notes_updated', { notesLength: notes.length }, tenantId);
  return true;
}
