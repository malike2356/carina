import crypto from 'crypto';
import { pool } from '../memory/db.js';
import type { CustomDomain } from './partner-brand.js';
import {
  deleteCfCustomHostname,
  getCfCustomHostname,
  registerCfCustomHostname,
} from './cloudflare-saas.js';

export const CUSTOM_DOMAIN_VERIFY_PREFIX = 'carina-verify=';
export const AIVA_SAAS_CNAME_ZONE = 'hireaiva.co.uk';

const DOMAIN_COLUMNS = `id, hostname, partner_id, org_id, verified_at, tls_status, created_at,
            verification_token, is_canonical, cf_hostname_id, cf_ownership_verification_name,
            cf_ownership_verification_value, cf_ssl_status`;

export function normaliseCustomDomainHostname(hostname: string): string {
  return hostname.split(':')[0].trim().toLowerCase().replace(/\.$/, '');
}

export function dnsVerificationRecordName(hostname: string): string {
  const host = normaliseCustomDomainHostname(hostname);
  return `_carina-verify.${host}`;
}

export function buildVerificationToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function verificationTxtValue(token: string): string {
  return `${CUSTOM_DOMAIN_VERIFY_PREFIX}${token}`;
}

export function buildCnameTarget(cfHostnameId: string): string {
  return `${cfHostnameId}.${AIVA_SAAS_CNAME_ZONE}`;
}

export function customDomainOnboardingInstructions(cnameTarget: string): string {
  return `Point a CNAME record from your subdomain to ${cnameTarget}. SSL is provisioned automatically by Cloudflare after the CNAME resolves.`;
}

export type CustomDomainRow = CustomDomain & {
  verificationToken: string;
  isCanonical: boolean;
  orgId: string;
  cfHostnameId: string | null;
  cfOwnershipVerificationName: string | null;
  cfOwnershipVerificationValue: string | null;
  cfSslStatus: string | null;
  cnameTarget: string | null;
};

function mapCustomDomainRow(row: Record<string, unknown>): CustomDomainRow {
  const cfHostnameId = row.cf_hostname_id ? String(row.cf_hostname_id) : null;
  return {
    id: String(row.id),
    hostname: String(row.hostname),
    partnerId: row.partner_id ? String(row.partner_id) : null,
    orgId: String(row.org_id),
    verifiedAt: row.verified_at ? new Date(row.verified_at as string).toISOString() : null,
    tlsStatus: String(row.tls_status ?? 'pending') as CustomDomainRow['tlsStatus'],
    createdAt: new Date(row.created_at as string).toISOString(),
    verificationToken: String(row.verification_token ?? ''),
    isCanonical: Boolean(row.is_canonical),
    cfHostnameId,
    cfOwnershipVerificationName: row.cf_ownership_verification_name
      ? String(row.cf_ownership_verification_name)
      : null,
    cfOwnershipVerificationValue: row.cf_ownership_verification_value
      ? String(row.cf_ownership_verification_value)
      : null,
    cfSslStatus: row.cf_ssl_status ? String(row.cf_ssl_status) : null,
    cnameTarget: cfHostnameId ? buildCnameTarget(cfHostnameId) : null,
  };
}

export async function listCustomDomainsForOrg(orgId: string): Promise<CustomDomainRow[]> {
  const result = await pool.query(
    `SELECT ${DOMAIN_COLUMNS}
     FROM custom_domains
     WHERE org_id = $1
     ORDER BY created_at DESC`,
    [orgId],
  );
  return result.rows.map((row) => mapCustomDomainRow(row as Record<string, unknown>));
}

export async function createCustomDomainForOrg(
  orgId: string,
  hostname: string,
  partnerId?: string | null,
): Promise<CustomDomainRow> {
  const normalised = normaliseCustomDomainHostname(hostname);
  if (!normalised || normalised.includes('/')) {
    throw new Error('Invalid hostname');
  }
  const token = buildVerificationToken();
  const result = await pool.query(
    `INSERT INTO custom_domains (hostname, org_id, partner_id, verification_token)
     VALUES ($1, $2, $3, $4)
     RETURNING ${DOMAIN_COLUMNS}`,
    [normalised, orgId, partnerId ?? null, token],
  );
  const inserted = mapCustomDomainRow(result.rows[0] as Record<string, unknown>);

  try {
    const cfHostname = await registerCfCustomHostname(normalised);
    const updated = await pool.query(
      `UPDATE custom_domains
       SET cf_hostname_id = $1,
           cf_ownership_verification_name = $2,
           cf_ownership_verification_value = $3,
           cf_ssl_status = $4
       WHERE id = $5
       RETURNING ${DOMAIN_COLUMNS}`,
      [
        cfHostname.id,
        cfHostname.ownershipVerification?.name ?? null,
        cfHostname.ownershipVerification?.value ?? null,
        cfHostname.sslStatus,
        inserted.id,
      ],
    );
    return mapCustomDomainRow(updated.rows[0] as Record<string, unknown>);
  } catch (err) {
    await pool.query('DELETE FROM custom_domains WHERE id = $1', [inserted.id]);
    throw err;
  }
}

export async function deleteCustomDomainForOrg(orgId: string, domainId: string): Promise<boolean> {
  const domain = await getCustomDomainForOrg(orgId, domainId);
  if (!domain) return false;

  if (domain.cfHostnameId) {
    try {
      await deleteCfCustomHostname(domain.cfHostnameId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('404')) throw err;
    }
  }

  const result = await pool.query(
    `DELETE FROM custom_domains WHERE id = $1 AND org_id = $2`,
    [domainId, orgId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getCustomDomainForOrg(orgId: string, domainId: string): Promise<CustomDomainRow | null> {
  const result = await pool.query(
    `SELECT ${DOMAIN_COLUMNS}
     FROM custom_domains
     WHERE id = $1 AND org_id = $2
     LIMIT 1`,
    [domainId, orgId],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  return mapCustomDomainRow(result.rows[0] as Record<string, unknown>);
}

export async function lookupVerifiedCustomDomain(hostname: string): Promise<CustomDomainRow | null> {
  const normalised = normaliseCustomDomainHostname(hostname);
  const result = await pool.query(
    `SELECT ${DOMAIN_COLUMNS}
     FROM custom_domains
     WHERE hostname = $1 AND verified_at IS NOT NULL
     LIMIT 1`,
    [normalised],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  return mapCustomDomainRow(result.rows[0] as Record<string, unknown>);
}

export async function getCanonicalHostForOrg(orgId: string, fallbackHost: string): Promise<string> {
  const result = await pool.query<{ hostname: string }>(
    `SELECT hostname
     FROM custom_domains
     WHERE org_id = $1 AND verified_at IS NOT NULL AND is_canonical = TRUE
     ORDER BY verified_at DESC
     LIMIT 1`,
    [orgId],
  );
  return result.rows[0]?.hostname ? normaliseCustomDomainHostname(result.rows[0].hostname) : fallbackHost;
}

export async function markCustomDomainVerified(domainId: string, orgId: string): Promise<CustomDomainRow | null> {
  const result = await pool.query(
    `UPDATE custom_domains
     SET verified_at = COALESCE(verified_at, NOW()), tls_status = 'active'
     WHERE id = $1 AND org_id = $2
     RETURNING ${DOMAIN_COLUMNS}`,
    [domainId, orgId],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  return mapCustomDomainRow(result.rows[0] as Record<string, unknown>);
}

export async function setCanonicalCustomDomain(orgId: string, domainId: string): Promise<CustomDomainRow | null> {
  await pool.query(
    `UPDATE custom_domains SET is_canonical = FALSE WHERE org_id = $1`,
    [orgId],
  );
  const result = await pool.query(
    `UPDATE custom_domains
     SET is_canonical = TRUE
     WHERE id = $1 AND org_id = $2 AND verified_at IS NOT NULL
     RETURNING ${DOMAIN_COLUMNS}`,
    [domainId, orgId],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  return mapCustomDomainRow(result.rows[0] as Record<string, unknown>);
}

export async function refreshCfSslStatus(domainId: string, orgId: string): Promise<CustomDomainRow | null> {
  const domain = await getCustomDomainForOrg(orgId, domainId);
  if (!domain?.cfHostnameId) return domain;

  const cfHostname = await getCfCustomHostname(domain.cfHostnameId);
  if (!cfHostname) return domain;

  await pool.query(
    `UPDATE custom_domains SET cf_ssl_status = $1 WHERE id = $2 AND org_id = $3`,
    [cfHostname.sslStatus, domainId, orgId],
  );
  return getCustomDomainForOrg(orgId, domainId);
}

export async function verifyCustomDomainDns(domainId: string, orgId: string): Promise<CustomDomainRow> {
  const domain = await getCustomDomainForOrg(orgId, domainId);
  if (!domain) throw new Error('Custom domain not found');

  const dns = await import('node:dns/promises');
  const recordName = dnsVerificationRecordName(domain.hostname);
  const expected = verificationTxtValue(domain.verificationToken);
  let records: string[][] = [];
  try {
    records = await dns.resolveTxt(recordName);
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
    if (code !== 'ENOTFOUND' && code !== 'ENODATA') {
      throw new Error(`DNS lookup failed for ${recordName}`);
    }
  }

  const flat = records.flat().map((value) => value.trim());
  if (!flat.includes(expected)) {
    throw new Error(`Missing verification TXT record ${recordName} = ${expected}`);
  }

  const verified = await markCustomDomainVerified(domainId, orgId);
  if (!verified) throw new Error('Custom domain not found');
  return verified;
}
