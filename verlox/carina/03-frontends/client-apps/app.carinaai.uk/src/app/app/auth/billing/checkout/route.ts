import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { workspaces } from '@/db/schema';
import { getStripe, stripePriceId } from '@/lib/stripe';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Mobile companion contract: POST /app/auth/billing/checkout
 * Mobile "Upgrade to Pro" maps to Carina Team by default; body.plan may override.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { plan?: string };
    const plan = body.plan === 'starter' ? 'starter' : 'team';

    const workspace = await requireWorkspace(session.user.id);
    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.carinaai.uk';

    let customerId = workspace.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: session.user.name,
        metadata: { workspaceId: workspace.id, userId: session.user.id },
      });
      customerId = customer.id;
      await db
        .update(workspaces)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(workspaces.id, workspace.id));
    }

    const checkoutMetadata = {
      workspaceId: workspace.id,
      userId: session.user.id,
      plan,
      planName: plan === 'team' ? 'Carina Team' : 'Carina Starter',
    };

    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: stripePriceId(plan), quantity: 1 }],
      success_url: `${appUrl}/billing?checkout=success`,
      cancel_url: `${appUrl}/billing?checkout=cancel`,
      metadata: checkoutMetadata,
      subscription_data: {
        metadata: checkoutMetadata,
      },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout unavailable';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
