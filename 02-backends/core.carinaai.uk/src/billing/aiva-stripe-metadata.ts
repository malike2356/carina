import Stripe from 'stripe';
import type StripeTypes from 'stripe';
import { config } from '../config/index.js';

export function workspaceFromMetadata(metadata: StripeTypes.Metadata | null): string | null {
  const workspaceId = metadata?.workspaceId ?? metadata?.workspace_id ?? null;
  return workspaceId ? String(workspaceId) : null;
}

export function subscriptionIdFromInvoice(invoice: StripeTypes.Invoice): string | null {
  const parentSub = invoice.parent?.subscription_details?.subscription;
  if (typeof parentSub === 'string') return parentSub;
  if (parentSub && typeof parentSub === 'object' && 'id' in parentSub) {
    return String(parentSub.id);
  }
  const legacySub = (invoice as StripeTypes.Invoice & {
    subscription?: string | { id: string } | null;
  }).subscription;
  if (typeof legacySub === 'string') return legacySub;
  if (legacySub && typeof legacySub === 'object' && 'id' in legacySub) {
    return String(legacySub.id);
  }
  return null;
}

function stripeClient(): Stripe | null {
  const secret = config.hosted.stripeSecretKey || process.env.STRIPE_SECRET_KEY || '';
  if (!secret) return null;
  return new Stripe(secret);
}

export async function resolveWorkspaceIdFromInvoice(invoice: StripeTypes.Invoice): Promise<string | null> {
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

export function isAivaProductMetadata(metadata: StripeTypes.Metadata | null | undefined): boolean {
  const product = metadata?.product;
  return product ? String(product) === 'aiva' : false;
}
