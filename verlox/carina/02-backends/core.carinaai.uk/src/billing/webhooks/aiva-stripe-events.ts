import type Stripe from 'stripe';
import { StripeService } from '../stripe-service.js';
import {
  activateAivaSubscription,
  recordAivaInvoice,
  syncAivaSubscriptionFromStripe,
} from '../aiva-billing-store.js';
import {
  isAivaProductMetadata,
  resolveWorkspaceIdFromInvoice,
  subscriptionIdFromInvoice,
} from '../aiva-stripe-metadata.js';
import {
  handleAivaInvoicePaid,
  handleAivaInvoicePaymentFailed,
  handleAivaSubscriptionDeleted,
} from './aiva-webhook-handler.js';

function metadataProduct(metadata: Stripe.Metadata | null | undefined): string | null {
  const product = metadata?.product;
  return product ? String(product) : null;
}

async function subscriptionIsAiva(subscriptionId: string): Promise<boolean> {
  try {
    const stripe = new StripeService();
    const subscription = await stripe.getSubscription(subscriptionId);
    return isAivaProductMetadata(subscription.metadata ?? null);
  } catch {
    return false;
  }
}

export async function isAivaStripeEvent(event: Stripe.Event): Promise<boolean> {
  const object = event.data.object as { metadata?: Stripe.Metadata };
  if (metadataProduct(object.metadata) === 'aiva') return true;

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    return metadataProduct(session.metadata) === 'aiva';
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    return isAivaProductMetadata(subscription.metadata ?? null);
  }

  if (event.type.startsWith('invoice.')) {
    const invoice = event.data.object as Stripe.Invoice;
    if (isAivaProductMetadata(invoice.metadata ?? null)) return true;
    const subscriptionId = subscriptionIdFromInvoice(invoice);
    if (subscriptionId) return subscriptionIsAiva(subscriptionId);
    const workspaceId = await resolveWorkspaceIdFromInvoice(invoice);
    return Boolean(workspaceId);
  }

  return false;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const workspaceId = session.metadata?.workspaceId ?? session.metadata?.workspace_id;
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
  const customerId = typeof session.customer === 'string' ? session.customer : null;
  if (!workspaceId || !subscriptionId || !customerId) return;

  const stripe = new StripeService();
  const subscription = await stripe.getSubscription(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id ?? '';
  const periodStart = subscription.items.data[0]?.current_period_start;
  const periodEnd = subscription.items.data[0]?.current_period_end;

  await activateAivaSubscription({
    workspaceId: String(workspaceId),
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
    stripePriceId: priceId,
    currentPeriodStart: periodStart ? new Date(periodStart * 1000) : new Date(),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : new Date(),
  });

  const tier = session.metadata?.plan ?? 'starter';
  const customerEmail =
    typeof session.customer_email === 'string' ? session.customer_email : undefined;
  const { provisionAivaScoutWorkspace } = await import('../aiva-scout-provisioning.js');
  void provisionAivaScoutWorkspace({
    workspaceId: String(workspaceId),
    tier: String(tier),
    email: customerEmail,
  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[aiva-scout] provision after checkout failed:', msg);
  });

  if (customerEmail) {
    const { sendWelcomeEmail } = await import('../../email/email-triggers.js');
    void sendWelcomeEmail({
      workspaceId: String(workspaceId),
      email: customerEmail,
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[aiva-billing] welcome email after checkout failed:', msg);
    });
  }
}

export async function handleAivaWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      return;
    case 'customer.subscription.updated':
      await syncAivaSubscriptionFromStripe(event.data.object as Stripe.Subscription);
      return;
    case 'customer.subscription.deleted':
      await handleAivaSubscriptionDeleted(event.data.object as Stripe.Subscription);
      return;
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await recordAivaInvoice(invoice);
      await handleAivaInvoicePaymentFailed(invoice);
      return;
    }
    case 'invoice.payment_succeeded':
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      await recordAivaInvoice(invoice);
      await handleAivaInvoicePaid(invoice);
      return;
    }
    default:
      return;
  }
}
