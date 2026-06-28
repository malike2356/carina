import crypto from 'crypto';
import { pool } from '../memory/db.js';
import { normalizeBrandConfig } from '../product/brand.js';
import type { PartnerAccount } from '../hosted/partner-brand.js';
import { normalizeWhiteLabelTier, type WhiteLabelCommercialTier } from '../billing/white-label-plans.js';

function slugifyPartnerName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'partner';
}

async function uniquePartnerSlug(base: string): Promise<string> {
  let slug = base;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const existing = await pool.query('SELECT 1 FROM partner_accounts WHERE slug = $1', [slug]);
    if ((existing.rowCount ?? 0) === 0) return slug;
    slug = `${base}-${attempt + 1}`;
  }
  return `${base}-${Date.now()}`;
}

function mapPartnerRow(row: Record<string, unknown>): PartnerAccount & {
  commercialTier: WhiteLabelCommercialTier;
  ownerOrgId: string | null;
  maxClientOrgs: number;
  stripeCustomerId: string | null;
} {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    brand: normalizeBrandConfig(row.brand),
    status: String(row.status) as PartnerAccount['status'],
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    commercialTier: normalizeWhiteLabelTier(row.commercial_tier),
    ownerOrgId: row.owner_org_id ? String(row.owner_org_id) : null,
    maxClientOrgs: Number(row.max_client_orgs ?? 10),
    stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
  };
}

export async function createPartnerAccount(input: {
  name: string;
  commercialTier?: WhiteLabelCommercialTier;
  ownerOrgId?: string | null;
  brand?: unknown;
}): Promise<ReturnType<typeof mapPartnerRow>> {
  const slug = await uniquePartnerSlug(slugifyPartnerName(input.name));
  const tier = normalizeWhiteLabelTier(input.commercialTier);
  const result = await pool.query(
    `INSERT INTO partner_accounts (name, slug, brand, commercial_tier, owner_org_id)
     VALUES ($1, $2, $3::jsonb, $4, $5)
     RETURNING *`,
    [input.name.trim(), slug, JSON.stringify(normalizeBrandConfig(input.brand)), tier, input.ownerOrgId ?? null],
  );
  return mapPartnerRow(result.rows[0] as Record<string, unknown>);
}

export async function getPartnerAccount(partnerId: string) {
  const result = await pool.query('SELECT * FROM partner_accounts WHERE id = $1 LIMIT 1', [partnerId]);
  if ((result.rowCount ?? 0) === 0) return null;
  return mapPartnerRow(result.rows[0] as Record<string, unknown>);
}

export async function getPartnerForOrg(orgId: string) {
  const result = await pool.query(
    `SELECT p.*
     FROM partner_accounts p
     JOIN organizations o ON o.partner_id = p.id
     WHERE o.id = $1
     LIMIT 1`,
    [orgId],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  return mapPartnerRow(result.rows[0] as Record<string, unknown>);
}

export async function getPartnerOwnedByOrg(ownerOrgId: string) {
  const result = await pool.query(
    `SELECT * FROM partner_accounts WHERE owner_org_id = $1 LIMIT 1`,
    [ownerOrgId],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  return mapPartnerRow(result.rows[0] as Record<string, unknown>);
}

export async function listClientOrganizations(partnerId: string) {
  const result = await pool.query(
    `SELECT id, name, slug, plan, status, created_at
     FROM organizations
     WHERE partner_id = $1
     ORDER BY created_at DESC`,
    [partnerId],
  );
  return result.rows.map((row) => ({
    orgId: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    plan: String(row.plan),
    status: String(row.status),
    createdAt: new Date(row.created_at as string).toISOString(),
  }));
}

export async function assignOrganizationToPartner(orgId: string, partnerId: string): Promise<void> {
  await pool.query(
    `UPDATE organizations SET partner_id = $1, updated_at = NOW() WHERE id = $2`,
    [partnerId, orgId],
  );
}

export async function createClientOrganizationForPartner(input: {
  partnerId: string;
  name: string;
  ownerUserId: string;
  email: string;
}): Promise<{ orgId: string; slug: string }> {
  const partner = await getPartnerAccount(input.partnerId);
  if (!partner) throw new Error('Partner account not found');

  const clients = await listClientOrganizations(input.partnerId);
  if (clients.length >= partner.maxClientOrgs) {
    throw new Error('Partner client workspace limit reached');
  }

  const baseSlug = slugifyPartnerName(input.name || input.email.split('@')[0] || 'client');
  let slug = baseSlug;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const existing = await pool.query('SELECT 1 FROM organizations WHERE slug = $1', [slug]);
    if ((existing.rowCount ?? 0) === 0) break;
    slug = `${baseSlug}-${attempt + 1}`;
  }

  const orgResult = await pool.query(
    `INSERT INTO organizations (name, slug, owner_user_id, plan, partner_id)
     VALUES ($1, $2, $3, 'free', $4)
     RETURNING id`,
    [input.name.trim() || `${input.email.split('@')[0]} workspace`, slug, input.ownerUserId, input.partnerId],
  );
  const orgId = String(orgResult.rows[0].id);
  await pool.query(
    `INSERT INTO org_memberships (org_id, user_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT DO NOTHING`,
    [orgId, input.ownerUserId],
  );
  return { orgId, slug };
}

export function newPartnerApiKey(): string {
  return `prt_${crypto.randomBytes(24).toString('hex')}`;
}

export async function getPartnerIdForOrg(orgId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT partner_id FROM organizations WHERE id = $1 LIMIT 1',
    [orgId],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  const row = result.rows[0] as { partner_id?: string | null };
  return row.partner_id ? String(row.partner_id) : null;
}
