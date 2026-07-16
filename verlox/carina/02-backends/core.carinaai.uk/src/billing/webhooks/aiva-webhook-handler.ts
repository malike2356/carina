import type StripeTypes from 'stripe';
import {
  markSubscriptionPastDue,
  reactivateSubscription,
  suspendSubscription,
  suspendIfGraceExpired,
  gracePeriodEndsAt,
} from '../aiva-billing.js';
import { pool } from '../../memory/db.js';
import {
  sendPaymentFailedEmail,
  sendPaymentSuccessEmail,
} from '../../email/email-triggers.js';
import { aivaAppUrl } from '../../email/workspace-contact.js';
import {
  resolveWorkspaceIdFromInvoice,
  workspaceFromMetadata,
} from '../aiva-stripe-metadata.js';

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

export async function handleAivaInvoicePaid(invoice: StripeTypes.Invoice): Promise<void> {
  const workspaceId = await resolveWorkspaceIdFromInvoice(invoice);
  if (!workspaceId) return;

  const amount = formatMoney(invoice.amount_paid ?? 0, invoice.currency ?? 'gbp');
  const planName = String(invoice.metadata?.planName ?? invoice.metadata?.plan ?? 'Aiva');
  const nextBillingDate = invoice.lines?.data?.[0]?.period?.end
    ? new Date(invoice.lines.data[0].period.end * 1000).toLocaleDateString('en-GB')
    : 'See your billing portal';

  await reactivateSubscription(workspaceId);
  await sendPaymentSuccessEmail({
    workspaceId,
    planName,
    amount,
    nextBillingDate,
    invoiceUrl: invoice.hosted_invoice_url ?? aivaAppUrl('/billing/aiva'),
  });
}

export async function handleAivaInvoicePaymentFailed(invoice: StripeTypes.Invoice): Promise<void> {
  const workspaceId = await resolveWorkspaceIdFromInvoice(invoice);
  if (!workspaceId) return;

  if (await suspendIfGraceExpired(workspaceId)) {
    return;
  }

  const existing = await pool.query(
    `SELECT payment_failed_at, status FROM aiva_subscriptions WHERE workspace_id = $1`,
    [workspaceId],
  );
  const row = existing.rows[0] as { payment_failed_at?: string | Date; status?: string } | undefined;
  if (row?.payment_failed_at || row?.status === 'past_due') {
    await suspendSubscription(workspaceId, 'payment');
    return;
  }

  const graceEnds = gracePeriodEndsAt();
  await markSubscriptionPastDue(workspaceId, graceEnds);

  const amount = formatMoney(invoice.amount_due ?? 0, invoice.currency ?? 'gbp');
  await sendPaymentFailedEmail({
    workspaceId,
    amount,
    gracePeriodEndsAt: graceEnds.toISOString(),
    updateUrl: aivaAppUrl('/billing/aiva'),
  });
}

export async function handleAivaSubscriptionDeleted(subscription: StripeTypes.Subscription): Promise<void> {
  const workspaceId = workspaceFromMetadata(subscription.metadata ?? null);
  if (!workspaceId) return;
  await suspendSubscription(workspaceId, 'payment');
}
