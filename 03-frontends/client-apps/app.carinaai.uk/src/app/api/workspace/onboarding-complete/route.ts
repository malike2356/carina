import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaces } from '@/db/schema';
import { requireSession, requireWorkspace } from '@/lib/session';

export async function PATCH() {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);

    await db
      .update(workspaces)
      .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(workspaces.id, workspace.id));

    const response = NextResponse.json({ ok: true });
    response.cookies.set('aiva_onboarding_done', '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
      sameSite: 'lax',
    });
    response.cookies.set('aiva_signup_pending', '', { maxAge: 0, path: '/' });
    return response;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
