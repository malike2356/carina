import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { TERMS_VERSION } from '@/lib/gdpr-constants';
import { seedSignupLegalAcceptances } from '@/lib/legal/signup-acceptance';
import { getSession } from '@/lib/session';
import { getWorkspaceForUser } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db
    .update(users)
    .set({
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  const workspace = await getWorkspaceForUser(session.user.id);
  if (workspace) {
    void seedSignupLegalAcceptances(session.user.id, workspace.id).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
