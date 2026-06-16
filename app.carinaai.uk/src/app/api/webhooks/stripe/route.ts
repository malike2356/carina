import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/db';
import { workspaces, type WorkspacePlan } from '@/db/schema';
import { getStripe } from '@/lib/stripe';

export const runtime = 'nodejs';

function planFromPriceId(priceId: string): WorkspacePlan | null {
  const starter = process.env.STRIPE_PRICE_CARINA_OPS_STARTER ?? process.env.STRIPE_PRICE_STARTER;
  const team = process.env.STRIPE_PRICE_CARINA_OPS_TEAM ?? process.env.STRIPE_PRICE_TEAM;
  if (priceId === starter) return 'starter';
  if (priceId === team) return 'team';
  return null;
}

async function updateWorkspaceFromSubscription(
  workspaceId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const priceId = subscription.items.data[0]?.price.id ?? '';
  const plan = planFromPriceId(priceId) ?? 'free';
  const periodEndUnix = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;

  await db
    .update(workspaces)
    .set({
      plan,
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: periodEnd,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId));
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const signature = (await headers()).get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const workspaceId = session.metadata?.workspaceId;
    const subscriptionId = session.subscription;
    if (workspaceId && typeof subscriptionId === 'string') {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await updateWorkspaceFromSubscription(workspaceId, subscription);
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const workspaceId = subscription.metadata?.workspaceId;
    if (workspaceId) {
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        await updateWorkspaceFromSubscription(workspaceId, subscription);
      } else {
        await db
          .update(workspaces)
          .set({
            plan: 'free',
            stripeSubscriptionId: null,
            currentPeriodEnd: null,
            updatedAt: new Date(),
          })
          .where(eq(workspaces.id, workspaceId));
      }
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const workspaceId = intent.metadata?.workspaceId;
    if (workspaceId) {
      await db
        .update(workspaces)
        .set({ updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId));
    }
  }

  return NextResponse.json({ received: true });
}
