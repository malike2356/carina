import type StripeTypes from 'stripe';
import {
  reactivateSubscription,
  suspendIfGraceExpired,
} from '../aiva-billing.js';
import {
  sendPaymentSuccessEmail,
} from '../../email/email-triggers.js';
import { aivaAppUrl } from '../../email/workspace-contact.js';
import {
  resolveWorkspaceIdFromInvoice,
  workspaceFromMetadata,
} from '../aiva-stripe-metadata.js';
import { handleFailedInvoice, processSuccessfulRetry } from '../dunning-engine.js';
import { suspendSubscription } from '../aiva-billing.js';

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

  await processSuccessfulRetry(workspaceId);
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

  // Only suspend when an existing grace window has already expired.
  if (await suspendIfGraceExpired(workspaceId)) {
    return;
  }

  await handleFailedInvoice(invoice);
}

export async function handleAivaSubscriptionDeleted(subscription: StripeTypes.Subscription): Promise<void> {
  const workspaceId = workspaceFromMetadata(subscription.metadata ?? null);
  if (!workspaceId) return;
  await suspendSubscription(workspaceId, 'payment');
}
