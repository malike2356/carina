import type Stripe from 'stripe';
import { getStripeBillingClientOrNull } from './billing-stripe-client.js';

export function workspaceFromMetadata(metadata: Stripe.Metadata | null): string | null {
  const workspaceId = metadata?.workspaceId ?? metadata?.workspace_id ?? null;
  return workspaceId ? String(workspaceId) : null;
}

export function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const parentSub = invoice.parent?.subscription_details?.subscription;
  if (typeof parentSub === 'string') return parentSub;
  if (parentSub && typeof parentSub === 'object' && 'id' in parentSub) {
    return String(parentSub.id);
  }
  const legacySub = (invoice as Stripe.Invoice & {
    subscription?: string | { id: string } | null;
  }).subscription;
  if (typeof legacySub === 'string') return legacySub;
  if (legacySub && typeof legacySub === 'object' && 'id' in legacySub) {
    return String(legacySub.id);
  }
  return null;
}

function stripeClient(): Stripe | null {
  return getStripeBillingClientOrNull();
}

export async function resolveWorkspaceIdFromInvoice(invoice: Stripe.Invoice): Promise<string | null> {
  const direct = workspaceFromMetadata(invoice.metadata ?? null);
  if (direct) return direct;

  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return null;

  const stripe = stripeClient();
  if (!stripe) return null;

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return workspaceFromMetadata(subscription.metadata ?? null);
  } catch (err) {
    console.error('[aiva-stripe] Failed to load subscription metadata:', err);
    return null;
  }
}

export function isAivaProductMetadata(metadata: Stripe.Metadata | null | undefined): boolean {
  const product = metadata?.product;
  return product ? String(product) === 'aiva' : false;
}
