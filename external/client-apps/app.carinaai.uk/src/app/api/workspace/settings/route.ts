import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceSettings } from '@/db/schema';
import { normalizeAppearance } from '@/lib/appearance';
import { normalizeBrainSettings, parseBrainSettingsPatch } from '@/lib/brain-settings';
import { isWorkspaceOwner, listWorkspaceMembers, setMemberTerminalPermission } from '@/lib/terminal-access';
import { isThemeName } from '@/lib/themes';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const [settings] = await db
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspace.id))
    .limit(1);

  const owner = await isWorkspaceOwner(workspace.id, session.user.id);
  const members = owner ? await listWorkspaceMembers(workspace.id) : [];

  return NextResponse.json({
    data: settings
      ? {
          ...settings,
          ...normalizeBrainSettings(settings),
          isOwner: owner,
          members,
        }
      : {
          workspaceId: workspace.id,
          theme: 'dark',
          terminalEnabled: true,
          isOwner: owner,
          members,
          ...normalizeBrainSettings(null),
        },
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as {
    theme?: string;
    customTheme?: unknown;
    appearance?: unknown;
    autoExtractMemories?: boolean;
    autoExtractSkills?: boolean;
    autoApproveSkillsMinConfidence?: number;
    maxSkillsPerRequest?: number;
    injectMemoriesInChat?: boolean;
    terminalEnabled?: boolean;
    memberUserId?: string;
    memberTerminal?: boolean;
  };
  const updates: Partial<typeof workspaceSettings.$inferInsert> = { updatedAt: new Date() };
  const brainPatch = parseBrainSettingsPatch(body);
  if (brainPatch.autoExtractMemories !== undefined) {
    updates.autoExtractMemories = brainPatch.autoExtractMemories;
  }
  if (brainPatch.autoExtractSkills !== undefined) updates.autoExtractSkills = brainPatch.autoExtractSkills;
  if (brainPatch.autoApproveSkillsMinConfidence !== undefined) {
    updates.autoApproveSkillsMinConfidence = brainPatch.autoApproveSkillsMinConfidence;
  }
  if (brainPatch.maxSkillsPerRequest !== undefined) {
    updates.maxSkillsPerRequest = brainPatch.maxSkillsPerRequest;
  }
  if (brainPatch.injectMemoriesInChat !== undefined) {
    updates.injectMemoriesInChat = brainPatch.injectMemoriesInChat;
  }
  if (body.terminalEnabled !== undefined) {
    if (!await isWorkspaceOwner(workspace.id, session.user.id)) {
      return NextResponse.json({ error: 'Only the workspace owner can change terminal settings' }, { status: 403 });
    }
    updates.terminalEnabled = Boolean(body.terminalEnabled);
  }

  if (body.memberUserId && body.memberTerminal !== undefined) {
    if (!await isWorkspaceOwner(workspace.id, session.user.id)) {
      return NextResponse.json({ error: 'Only the workspace owner can change member terminal access' }, { status: 403 });
    }
    await setMemberTerminalPermission(workspace.id, body.memberUserId, Boolean(body.memberTerminal));
  }

  if (body.theme !== undefined) {
    if (!isThemeName(body.theme)) {
      return NextResponse.json({ error: 'Unsupported theme' }, { status: 400 });
    }
    updates.theme = body.theme;
  }
  if (body.customTheme !== undefined) updates.customTheme = body.customTheme;
  if (body.appearance !== undefined) {
    const [current] = await db
      .select({ appearance: workspaceSettings.appearance })
      .from(workspaceSettings)
      .where(eq(workspaceSettings.workspaceId, workspace.id))
      .limit(1);
    updates.appearance = normalizeAppearance({
      ...(typeof current?.appearance === 'object' && current.appearance !== null ? current.appearance : {}),
      ...(typeof body.appearance === 'object' && body.appearance !== null ? body.appearance : {}),
    });
  }

  await db
    .insert(workspaceSettings)
    .values({
      workspaceId: workspace.id,
      ...updates,
    })
    .onConflictDoUpdate({
      target: workspaceSettings.workspaceId,
      set: updates,
    });

  const response = NextResponse.json({ data: { ok: true } });
  if (updates.theme) {
    response.cookies.set('carina_theme', updates.theme, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
    });
  }
  return response;
}
