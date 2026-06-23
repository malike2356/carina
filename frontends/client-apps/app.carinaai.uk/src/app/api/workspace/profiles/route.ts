import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { chatSessions, workspaceProfiles } from '@/db/schema';
import { ensureWorkspaceProfiles, getWorkspaceProfile } from '@/lib/workspace-profiles';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const profiles = await ensureWorkspaceProfiles(workspace.id);

  return NextResponse.json({
    data: profiles.map((profile) => ({
      id: profile.id,
      slug: profile.slug,
      name: profile.name,
      description: profile.description,
      provider: profile.provider,
      model: profile.model,
      isBuiltin: profile.isBuiltin,
      builtinId: profile.builtinId,
      hasSystemPrompt: Boolean(profile.systemPrompt?.trim()),
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await req.json()) as {
    action?: string;
    profileId?: string;
    sessionId?: string;
  };

  if (body.action === 'activate_session') {
    const profileId = String(body.profileId ?? '').trim();
    const sessionId = String(body.sessionId ?? '').trim();
    if (!profileId || !sessionId) {
      return NextResponse.json({ error: 'profileId and sessionId are required' }, { status: 400 });
    }

    const profile = await getWorkspaceProfile(workspace.id, profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const updated = await db
      .update(chatSessions)
      .set({ profileId: profile.id, updatedAt: new Date() })
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.workspaceId, workspace.id)))
      .returning({ id: chatSessions.id, profileId: chatSessions.profileId });

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        sessionId: updated[0].id,
        profileId: updated[0].profileId,
        profile: {
          id: profile.id,
          slug: profile.slug,
          name: profile.name,
        },
      },
    });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
