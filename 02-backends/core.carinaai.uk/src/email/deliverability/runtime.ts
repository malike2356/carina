/**
 * Carina runtime glue for shared deliverability helpers.
 */
import {
  configureMarketingDomain,
  configureTransactionalDomain,
  createDeliveryStore,
  enforceDomainSeparation,
  trackDelivery,
  type DeliveryEventKind,
  type DeliveryStore,
  type DomainPlan,
} from './index.js';

const globalStore = createDeliveryStore();

export function getDeliveryStore(): DeliveryStore {
  return globalStore;
}

export function resolveAppDomain(): string {
  const fromEnv =
    process.env.EMAIL_APP_DOMAIN
    ?? process.env.CARINA_EMAIL_APP_DOMAIN
    ?? '';
  if (fromEnv.trim()) return fromEnv.trim().toLowerCase();

  const from =
    process.env.EMAIL_FROM
    ?? process.env.SYSTEM_EMAIL_FROM
    ?? '';
  const host = from.includes('@') ? from.split('@')[1]! : '';
  if (!host) return 'carinaai.uk';
  // Strip mail./updates. prefixes to get app root for planning.
  return host.replace(/^(mail|receipts|noreply|updates|news|hello)\./i, '');
}

export function resolveDomainPlans(appDomain = resolveAppDomain()): {
  transactional: DomainPlan;
  marketing: DomainPlan;
} {
  return {
    transactional: configureTransactionalDomain(appDomain),
    marketing: configureMarketingDomain(appDomain),
  };
}

function extractAddress(fromHeader: string): string {
  const m = fromHeader.match(/<([^>]+)>/);
  return (m?.[1] ?? fromHeader).trim().toLowerCase();
}

export function resolveFromForRole(
  role: 'transactional' | 'marketing',
  nameOverride?: string,
): string {
  const name =
    nameOverride
    ?? process.env.EMAIL_FROM_NAME
    ?? process.env.SYSTEM_EMAIL_FROM_NAME
    ?? 'Carina';
  const plans = resolveDomainPlans();
  const txAddress =
    process.env.EMAIL_FROM
    ?? process.env.SYSTEM_EMAIL_FROM
    ?? plans.transactional.suggestedFrom;
  const txHost = extractAddress(
    txAddress.includes('<') ? txAddress : `${name} <${txAddress}>`,
  ).split('@')[1]
    ?? '';

  if (role === 'transactional') {
    return `${name} <${extractAddress(txAddress.includes('<') ? txAddress : `${name} <${txAddress}>`)}>`;
  }

  const marketingExplicit =
    process.env.EMAIL_MARKETING_FROM
    ?? process.env.MARKETING_EMAIL_FROM
    ?? '';
  if (marketingExplicit.trim()) {
    const address = marketingExplicit.trim();
    return `${name} <${extractAddress(address.includes('<') ? address : `${name} <${address}>`)}>`;
  }

  // Prefer dedicated marketing subdomain when configured; otherwise reuse apex
  // only if it is not the transactional mail.* identity (migration-safe).
  if (txHost && txHost !== plans.transactional.sendingDomain) {
    return `${name} <${extractAddress(txAddress.includes('<') ? txAddress : `${name} <${txAddress}>`)}>`;
  }
  return `${name} <${extractAddress(plans.marketing.suggestedFrom)}>`;
}

export function assertSendDomainAllowed(
  role: 'transactional' | 'marketing',
  fromHeader: string,
): void {
  if (process.env.EMAIL_DELIVERABILITY_ENFORCE === 'false') return;
  enforceDomainSeparation(role, fromHeader, resolveAppDomain());
}

export function recordProviderDeliveryEvent(input: {
  emailId: string;
  domain?: string;
  kind: string;
  reason?: string;
}): void {
  const map: Record<string, DeliveryEventKind | undefined> = {
    delivered: 'delivered',
    soft_bounce: 'bounced',
    hard_bounce: 'bounced',
    bounce: 'bounced',
    complaint: 'complained',
    spam: 'spam',
    open: 'opened',
    opened: 'opened',
    click: 'clicked',
    clicked: 'clicked',
    deferred: 'deferred',
    failed: 'blocked',
  };
  const kind = map[input.kind];
  if (!kind) return;
  const domain = (input.domain ?? resolveDomainPlans().transactional.sendingDomain).toLowerCase();
  trackDelivery(getDeliveryStore(), {
    emailId: input.emailId,
    domain,
    kind,
    meta: input.reason ? { reason: input.reason } : undefined,
    bounceClass:
      input.kind === 'hard_bounce'
        ? 'hard'
        : input.kind === 'soft_bounce'
          ? 'soft'
          : input.kind === 'failed'
            ? 'block'
            : undefined,
  });
}
