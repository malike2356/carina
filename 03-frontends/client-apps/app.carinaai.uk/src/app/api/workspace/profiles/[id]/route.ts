import { NextResponse } from 'next/server';
import {
  deleteWorkspaceProfile,
  getWorkspaceProfile,
  updateWorkspaceProfile,
} from '@/lib/workspace-profiles';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function serializeProfile(profile: NonNullable<Awaited<ReturnType<typeof getWorkspaceProfile>>>) {
  return {
    id: profile.id,
    slug: profile.slug,
    name: profile.name,
    description: profile.description,
    systemPrompt: profile.systemPrompt,
    provider: profile.provider,
    model: profile.model,
    isBuiltin: profile.isBuiltin,
    builtinId: profile.builtinId,
    hasSystemPrompt: Boolean(profile.systemPrompt?.trim()),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export async function GET(_req: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const { id } = await context.params;
  const profile = await getWorkspaceProfile(workspace.id, id);
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json({ data: serializeProfile(profile) });
}

export async function PATCH(req: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const { id } = await context.params;
  const body = (await req.json()) as {
    name?: string;
    slug?: string;
    description?: string | null;
    systemPrompt?: string;
    provider?: string | null;
    model?: string | null;
  };

  try {
    const updated = await updateWorkspaceProfile(workspace.id, id, {
      name: String(body.name ?? ''),
      slug: body.slug,
      description: body.description ?? null,
      systemPrompt: String(body.systemPrompt ?? ''),
      provider: body.provider ?? null,
      model: body.model ?? null,
    });
    return NextResponse.json({ data: serializeProfile(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update profile';
    const status = message === 'Profile not found' ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const { id } = await context.params;

  try {
    await deleteWorkspaceProfile(workspace.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete profile';
    const status = message === 'Profile not found' ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
