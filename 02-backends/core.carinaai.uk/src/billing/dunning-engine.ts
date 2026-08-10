/**
 * Payment recovery / dunning orchestration for Aiva Stripe subscriptions.
 * Never cancel on first failure; 14-day grace with staggered retries + email sequence.
 */

import type Stripe from 'stripe';
import {
  DUNNING_EMAIL_DAYS,
  DUNNING_RETRY_DAYS,
  dunningGraceDays,
  getActiveDunningCase,
  listActiveDunningCases,
  loadDunningStore,
  upsertDunningCase,
  type DunningCase,
  type DunningEmailStage,
  type DunningRetryPlan,
} from './dunning-store.js';
import { enterGracePeriod, exitGracePeriod, isInGracePeriod } from './grace-period.js';
import { sendDunningEmail } from './dunning-emails.js';
import { aivaAppUrl } from '../email/workspace-contact.js';
import {
  subscriptionIdFromInvoice,
} from './aiva-stripe-metadata.js';

function addDaysIso(fromIso: string, days: number): string {
  const d = new Date(fromIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function formatMoney(amountMinor: number, currency: string): string {
  const value = amountMinor / 100;
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function newCaseId(): string {
  return `dun_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function scheduleRetries(failedAtIso: string): DunningRetryPlan[] {
  return DUNNING_RETRY_DAYS.map((dayOffset) => ({
    dayOffset,
    scheduledAt: addDaysIso(failedAtIso, dayOffset),
    result: 'pending' as const,
  }));
}

function scheduleEmails(failedAtIso: string): DunningCase['emails'] {
  return DUNNING_EMAIL_DAYS.map((dayOffset, idx) => ({
    stage: (idx + 1) as DunningEmailStage,
    dayOffset,
    scheduledAt: addDaysIso(failedAtIso, dayOffset),
  }));
}

async function resolvePortalUrl(customerId?: string): Promise<string> {
  const fallback = aivaAppUrl('/billing/aiva');
  if (!customerId) return fallback;
  try {
    const { StripeService } = await import('./stripe-service.js');
    const stripe = new StripeService();
    const session = await stripe.updatePaymentMethod(customerId, fallback);
    return session.url || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Main handler for Stripe `invoice.payment_failed`.
 * Enters grace on first failure; during grace records further Stripe attempts without suspending.
 */
export async function handleFailedPayment(stripeEvent: {
  data: { object: Stripe.Invoice };
}): Promise<DunningCase | null> {
  const invoice = stripeEvent.data.object;
  return handleFailedInvoice(invoice);
}

export async function handleFailedInvoice(invoice: Stripe.Invoice): Promise<DunningCase | null> {
  const { resolveWorkspaceIdFromInvoice } = await import('./aiva-stripe-metadata.js');
  const workspaceId = await resolveWorkspaceIdFromInvoice(invoice);
  if (!workspaceId) return null;

  const existing = getActiveDunningCase(workspaceId);
  if (existing) {
    // Still in grace: do not suspend; note an external Stripe retry signal on nearest pending day
    if (await isInGracePeriod(workspaceId)) {
      const pending = existing.retries.find((r) => r.result === 'pending');
      if (pending && !pending.attemptedAt) {
        pending.attemptedAt = new Date().toISOString();
        pending.result = 'failed';
        return upsertDunningCase({ ...existing, retries: [...existing.retries] });
      }
      return existing;
    }
    await processFinalFailure(existing.id);
    return getActiveDunningCase(workspaceId) ?? existing;
  }

  const failedAt = new Date().toISOString();
  const grace = await enterGracePeriod(workspaceId);
  const subscriptionId = subscriptionIdFromInvoice(invoice) ?? undefined;
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : undefined;
  const amountDueMinor = invoice.amount_due ?? 0;
  const currency = invoice.currency ?? 'gbp';

  const dunningCase: DunningCase = {
    id: newCaseId(),
    workspaceId,
    stripeSubscriptionId: subscriptionId,
    stripeInvoiceId: invoice.id,
    stripeCustomerId: customerId,
    amountDueMinor,
    currency,
    failedAt,
    graceEndsAt: grace.graceEndsAt,
    status: 'active',
    retries: scheduleRetries(failedAt),
    emails: scheduleEmails(failedAt),
    mrrMinor: amountDueMinor,
  };
  upsertDunningCase(dunningCase);

  const portalUrl = await resolvePortalUrl(customerId);
  await sendDunningEmail(dunningCase, 1, {
    portalUrl,
    amount: formatMoney(amountDueMinor, currency),
  });

  return getActiveDunningCase(workspaceId) ?? dunningCase;
}

export async function processSuccessfulRetry(workspaceId: string): Promise<DunningCase | null> {
  const active = getActiveDunningCase(workspaceId);
  if (!active) {
    await exitGracePeriod(workspaceId, 'recovered');
    return null;
  }
  const next: DunningCase = {
    ...active,
    status: 'recovered',
    recoveredAt: new Date().toISOString(),
    retries: active.retries.map((r) =>
      r.result === 'pending' ? { ...r, result: 'skipped' as const } : r,
    ),
  };
  upsertDunningCase(next);
  await exitGracePeriod(workspaceId, 'recovered');
  return next;
}

export async function processFinalFailure(caseId: string): Promise<DunningCase | null> {
  const found = loadDunningStore().cases.find((c) => c.id === caseId);
  if (!found) return null;
  const next: DunningCase = {
    ...found,
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
  };
  upsertDunningCase(next);
  await exitGracePeriod(found.workspaceId, 'cancelled');
  return next;
}

/** Process due retries and emails (call from daily/hourly cron). */
export async function processDueDunning(now = new Date()): Promise<{
  emailsSent: number;
  retriesMarked: number;
  finals: number;
}> {
  const nowMs = now.getTime();
  let emailsSent = 0;
  let retriesMarked = 0;
  let finals = 0;

  for (const dunningCase of listActiveDunningCases()) {
    if (Date.parse(dunningCase.graceEndsAt) <= nowMs) {
      await processFinalFailure(dunningCase.id);
      finals += 1;
      continue;
    }

    const portalUrl = await resolvePortalUrl(dunningCase.stripeCustomerId);
    const amount = formatMoney(dunningCase.amountDueMinor ?? 0, dunningCase.currency ?? 'gbp');

    for (const email of dunningCase.emails) {
      if (email.sentAt) continue;
      if (Date.parse(email.scheduledAt) > nowMs) continue;
      await sendDunningEmail(dunningCase, email.stage, { portalUrl, amount });
      emailsSent += 1;
    }

    const refreshed = getActiveDunningCase(dunningCase.workspaceId) ?? dunningCase;
    let changed = false;
    const retries = refreshed.retries.map((r) => {
      if (r.result !== 'pending') return r;
      if (Date.parse(r.scheduledAt) > nowMs) return r;
      // Record scheduled retry intent; Stripe smart retries also run independently.
      retriesMarked += 1;
      changed = true;
      return {
        ...r,
        attemptedAt: now.toISOString(),
        result: 'failed' as const,
      };
    });
    if (changed) {
      upsertDunningCase({ ...refreshed, retries });
    }
  }

  return { emailsSent, retriesMarked, finals };
}

export function dunningConfig() {
  return {
    graceDays: dunningGraceDays(),
    retryDays: [...DUNNING_RETRY_DAYS],
    emailDays: [...DUNNING_EMAIL_DAYS],
    note: 'Stripe webhook signatures must be verified before handleFailedPayment runs.',
  };
}
