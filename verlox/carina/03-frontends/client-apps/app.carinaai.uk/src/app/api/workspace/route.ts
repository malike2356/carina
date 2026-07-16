import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const body = await req.json().catch(() => ({}));
    if (String(body.confirm ?? '') !== 'DELETE') {
      return NextResponse.json({ error: 'Type DELETE to confirm account deletion.' }, { status: 400 });
    }

    const stripeSubscriptionId = workspace.stripeSubscriptionId;
    if (stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
      const { getStripe } = await import('@/lib/stripe');
      await getStripe().subscriptions.cancel(stripeSubscriptionId).catch(() => {});
    }

    const upstream = await proxyAivaRequest(workspace.id, '/api/aiva/workspace', { method: 'DELETE' });
    if (!upstream.ok) {
      const text = await upstream.text();
      return NextResponse.json({ error: text || 'Core deletion failed' }, { status: upstream.status });
    }

    const { db } = await import('@/db');
    const { users, workspaces } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    await db
      .update(workspaces)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(workspaces.id, workspace.id));

    await db
      .update(users)
      .set({
        deletedAt: new Date(),
        email: `deleted+${session.user.id}@deleted.local`,
        name: 'Deleted user',
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
