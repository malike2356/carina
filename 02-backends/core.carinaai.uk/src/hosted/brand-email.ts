import { config } from '../config/index.js';
import { normalizeBrandConfig, resolveBrand } from '../product/brand.js';
import { pool } from '../memory/db.js';
import { getCanonicalHostForOrg } from './custom-domain-service.js';

export interface TenantEmailIdentity {
  from: string;
  productName: string;
  replyTo: string | null;
  footer: string | null;
  appHost: string;
}

export function formatResendFrom(senderName: string, senderEmail: string): string {
  const name = senderName.trim() || 'Carina';
  const fallbackEmail = config.resend.from.match(/<([^>]+)>/)?.[1] ?? config.resend.from;
  const email = senderEmail.trim() || fallbackEmail;
  return `${name} <${email}>`;
}

function parseDefaultSenderEmail(): string {
  const match = config.resend.from.match(/<([^>]+)>/);
  return match?.[1] ?? config.resend.from;
}

export async function loadOrganizationBrandContext(orgId: string): Promise<{
  orgName: string;
  orgBrand: ReturnType<typeof normalizeBrandConfig>;
  partnerBrand: ReturnType<typeof normalizeBrandConfig> | null;
}> {
  const result = await pool.query<{
    name: string;
    brand: unknown;
    partner_brand: unknown;
  }>(
    `SELECT o.name, o.brand,
            p.brand AS partner_brand
     FROM organizations o
     LEFT JOIN partner_accounts p ON p.id = o.partner_id
     WHERE o.id = $1
     LIMIT 1`,
    [orgId],
  );
  if ((result.rowCount ?? 0) === 0) {
    return { orgName: 'your workspace', orgBrand: {}, partnerBrand: null };
  }
  const row = result.rows[0];
  return {
    orgName: String(row.name),
    orgBrand: normalizeBrandConfig(row.brand),
    partnerBrand: row.partner_brand ? normalizeBrandConfig(row.partner_brand) : null,
  };
}

export async function resolveEmailIdentityForOrg(orgId: string): Promise<TenantEmailIdentity> {
  const brandContext = await loadOrganizationBrandContext(orgId);
  const resolved = resolveBrand({
    mode: 'hosted',
    reseller: brandContext.partnerBrand,
    workspace: brandContext.orgBrand,
  });
  const senderEmail = resolved.senderEmail ?? parseDefaultSenderEmail();
  const senderName = resolved.senderName ?? resolved.productName;
  const appHost = await getCanonicalHostForOrg(orgId, config.hosted.appHost);
  return {
    from: formatResendFrom(senderName, senderEmail),
    productName: resolved.productName,
    replyTo: resolved.supportEmail,
    footer: resolved.emailFooter,
    appHost,
  };
}

export function appendEmailFooter(body: string, footer: string | null | undefined): string {
  if (!footer?.trim()) return body;
  return `${body}\n\n${footer.trim()}`;
}
