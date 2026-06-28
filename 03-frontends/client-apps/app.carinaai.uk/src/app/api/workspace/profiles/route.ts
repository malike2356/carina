import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { chatSessions, workspaceProfiles } from '@/db/schema';
import { ensureWorkspaceProfiles, getWorkspaceProfile, createWorkspaceProfile, cloneWorkspaceProfile } from '@/lib/workspace-profiles';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  let profiles;
  try {
    profiles = await ensureWorkspaceProfiles(workspace.id);
  } catch (error) {
    console.error('[workspace/profiles] ensure failed:', error);
    return NextResponse.json({ error: 'Failed to load workspace profiles' }, { status: 500 });
  }

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
    name?: string;
    slug?: string;
    description?: string | null;
    systemPrompt?: string;
    provider?: string | null;
    model?: string | null;
  };

  if (body.action === 'clone') {
    const profileId = String(body.profileId ?? '').trim();
    if (!profileId) {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
    }
    try {
      const cloned = await cloneWorkspaceProfile(workspace.id, profileId);
      return NextResponse.json({
        data: {
          id: cloned.id,
          slug: cloned.slug,
          name: cloned.name,
          description: cloned.description,
          provider: cloned.provider,
          model: cloned.model,
          isBuiltin: cloned.isBuiltin,
          builtinId: cloned.builtinId,
          hasSystemPrompt: Boolean(cloned.systemPrompt?.trim()),
          createdAt: cloned.createdAt,
          updatedAt: cloned.updatedAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to clone profile';
      const status = message === 'Profile not found' ? 404 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  }

  if (body.action === 'create' || (body.name && !body.action)) {
    try {
      const created = await createWorkspaceProfile(workspace.id, {
        name: String(body.name ?? ''),
        slug: body.slug,
        description: body.description ?? null,
        systemPrompt: String(body.systemPrompt ?? ''),
        provider: body.provider ?? null,
        model: body.model ?? null,
      });
      return NextResponse.json({
        data: {
          id: created.id,
          slug: created.slug,
          name: created.name,
          description: created.description,
          provider: created.provider,
          model: created.model,
          isBuiltin: created.isBuiltin,
          builtinId: created.builtinId,
          hasSystemPrompt: Boolean(created.systemPrompt?.trim()),
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create profile';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (body.action === 'activate_session') {
    const sessionId = String(body.sessionId ?? '').trim();
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const profileId = String(body.profileId ?? '').trim();
    if (!profileId) {
      const updated = await db
        .update(chatSessions)
        .set({ profileId: null, updatedAt: new Date() })
        .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.workspaceId, workspace.id)))
        .returning({ id: chatSessions.id, profileId: chatSessions.profileId });

      if (updated.length === 0) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      return NextResponse.json({
        ok: true,
        data: {
          sessionId: updated[0].id,
          profileId: null,
          profile: null,
        },
      });
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
