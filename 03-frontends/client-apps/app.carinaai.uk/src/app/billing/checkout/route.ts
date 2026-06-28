import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { workspaces } from '@/db/schema';
import { getStripe, stripePriceId } from '@/lib/stripe';
import { getSession, requireWorkspace } from '@/lib/session';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { plan?: 'starter' | 'team' };
  if (body.plan !== 'starter' && body.plan !== 'team') {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

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
    plan: body.plan,
    planName: body.plan === 'team' ? 'Carina Team' : 'Carina Starter',
  };

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: stripePriceId(body.plan), quantity: 1 }],
    success_url: `${appUrl}/billing?checkout=success`,
    cancel_url: `${appUrl}/billing?checkout=cancel`,
    metadata: checkoutMetadata,
    subscription_data: {
      metadata: checkoutMetadata,
    },
  });

  return NextResponse.json({ url: checkout.url });
}
