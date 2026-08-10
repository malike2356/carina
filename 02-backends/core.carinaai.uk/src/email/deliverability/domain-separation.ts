/**
 * Transactional vs marketing sending-domain separation and warm-up plan.
 */

import policy from './policy.js';

export type DomainRole = 'transactional' | 'marketing';

export type DomainPlan = {
  appDomain: string;
  role: DomainRole;
  sendingDomain: string;
  suggestedFrom: string;
  warmUp: WarmUpPlan;
};

export type WarmUpPlan = {
  startPerDay: number;
  doubleEveryDays: number;
  days: Array<{ day: number; dailyCap: number }>;
  note: string;
};

function stripWww(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

export function configureTransactionalDomain(appDomain: string): DomainPlan {
  const root = stripWww(appDomain);
  const sub = policy.domainRoles.transactionalSubdomains[0] ?? 'mail';
  const sendingDomain = `${sub}.${root}`;
  return {
    appDomain: root,
    role: 'transactional',
    sendingDomain,
    suggestedFrom: `noreply@${sendingDomain}`,
    warmUp: warmUpDomain(sendingDomain),
  };
}

export function configureMarketingDomain(appDomain: string): DomainPlan {
  const root = stripWww(appDomain);
  const sub = policy.domainRoles.marketingSubdomains[0] ?? 'updates';
  const sendingDomain = `${sub}.${root}`;
  return {
    appDomain: root,
    role: 'marketing',
    sendingDomain,
    suggestedFrom: `hello@${sendingDomain}`,
    warmUp: warmUpDomain(sendingDomain),
  };
}

export function warmUpDomain(
  domain: string,
  targetPerDay = 1600,
): WarmUpPlan {
  const start = policy.warmup.startPerDay;
  const every = policy.warmup.doubleEveryDays;
  const maxDays = policy.warmup.maxDays;
  const days: Array<{ day: number; dailyCap: number }> = [];
  let cap = start;
  for (let day = 1; day <= maxDays && cap <= targetPerDay; day += 1) {
    days.push({ day, dailyCap: Math.min(cap, targetPerDay) });
    if (day % every === 0) cap *= 2;
  }
  return {
    startPerDay: start,
    doubleEveryDays: every,
    days,
    note: `Warm-up plan for ${domain}: start ${start}/day, double every ${every} days until target ${targetPerDay}/day.`,
  };
}

/** Reputation stub: products may plug Postmaster / ESP APIs. */
export async function getDomainReputation(
  domain: string,
  provider?: () => Promise<{ score: number | null; source: string; detail: string }>,
): Promise<{ domain: string; score: number | null; source: string; detail: string }> {
  if (provider) {
    const result = await provider();
    return { domain: stripWww(domain), ...result };
  }
  return {
    domain: stripWww(domain),
    score: null,
    source: 'none',
    detail:
      'No reputation provider configured. Connect Google Postmaster Tools or ESP domain insights.',
  };
}

export function assertFromMatchesRole(
  fromAddress: string,
  role: DomainRole,
  plans: { transactional: DomainPlan; marketing: DomainPlan },
): { ok: boolean; error?: string } {
  const email = fromAddress.trim().toLowerCase();
  const host = email.includes('<')
    ? (email.match(/<([^>]+)>/)?.[1] ?? email)
    : email;
  const domain = host.split('@')[1] ?? '';
  if (!domain) return { ok: false, error: 'from address missing domain' };

  if (role === 'transactional') {
    if (domain === plans.marketing.sendingDomain) {
      return {
        ok: false,
        error: 'Transactional mail must not use the marketing sending domain',
      };
    }
    if (
      domain !== plans.transactional.sendingDomain
      && !domain.endsWith(`.${plans.transactional.appDomain}`)
      && domain !== plans.transactional.appDomain
    ) {
      // Allow legacy apex during migration but flag.
      return {
        ok: true,
        error: `WARNING: transactional from ${domain}; preferred ${plans.transactional.sendingDomain}`,
      };
    }
    return { ok: true };
  }

  if (domain === plans.transactional.sendingDomain) {
    return {
      ok: false,
      error: 'Marketing mail must not use the transactional sending domain',
    };
  }
  return { ok: true };
}

export function enforceDomainSeparation(
  role: DomainRole,
  fromAddress: string,
  appDomain: string,
): void {
  const plans = {
    transactional: configureTransactionalDomain(appDomain),
    marketing: configureMarketingDomain(appDomain),
  };
  const check = assertFromMatchesRole(fromAddress, role, plans);
  if (!check.ok) {
    throw new Error(check.error ?? 'domain separation violated');
  }
}
