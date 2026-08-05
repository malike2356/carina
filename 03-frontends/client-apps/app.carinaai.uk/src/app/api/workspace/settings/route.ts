import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceSettings } from '@/db/schema';
import { AIVA_DEFAULT_THEME_PREFERENCE } from '@/lib/aiva-theme';
import { normalizeAppearance } from '@/lib/appearance';
import { mergeBrandSettings, normalizeBrandConfig, resolveWorkspaceBrand } from '@/lib/brand';
import { stripPlatformEquivalentBrand } from '@/lib/brand-compat';
import { normalizeBrainSettings, parseBrainSettingsPatch } from '@/lib/brain-settings';
import {
  canUseTerminal,
  isWorkspaceOwner,
  listWorkspaceMembers,
  setMemberTerminalPermission,
} from '@/lib/terminal-access';
import { isThemeName } from '@/lib/themes';
import { getSession, requireWorkspace } from '@/lib/session';
import { isAivaProductHost } from '@/lib/product-surface';

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
  const terminalAllowed = await canUseTerminal(workspace.id, session.user.id);
  const workspaceBrand = normalizeBrandConfig(settings?.brand ?? {});
  const resolvedBrand = resolveWorkspaceBrand({
    workspaceBrand,
    userColorTokens: settings?.customTheme,
  });
  const isAivaProduct = isAivaProductHost((await headers()).get('host') ?? '');
  const storedAppearance =
    typeof settings?.appearance === 'object' && settings.appearance !== null
      ? (settings.appearance as { themeMode?: unknown })
      : null;
  const useAivaDefaults =
    isAivaProduct &&
    (!settings || (settings.theme === 'dark' && !storedAppearance?.themeMode));
  const aivaDefaultAppearance = useAivaDefaults
    ? normalizeAppearance({ themeMode: 'light' })
    : undefined;

  return NextResponse.json({
    data: settings
      ? {
          ...settings,
          ...(useAivaDefaults
            ? { theme: AIVA_DEFAULT_THEME_PREFERENCE.themeId, appearance: aivaDefaultAppearance }
            : {}),
          brand: workspaceBrand,
          resolvedBrand,
          ...normalizeBrainSettings(settings),
          isOwner: owner,
          canUseTerminal: terminalAllowed,
          members,
        }
      : {
          workspaceId: workspace.id,
          theme: isAivaProduct ? AIVA_DEFAULT_THEME_PREFERENCE.themeId : 'default',
          ...(isAivaProduct ? { appearance: aivaDefaultAppearance } : {}),
          brand: {},
          resolvedBrand: resolveWorkspaceBrand({}),
          terminalEnabled: true,
          isOwner: owner,
          canUseTerminal: terminalAllowed,
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
    brand?: unknown;
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
  if (body.brand !== undefined) {
    if (!await isWorkspaceOwner(workspace.id, session.user.id)) {
      return NextResponse.json({ error: 'Only the workspace owner can change brand settings' }, { status: 403 });
    }
    const [current] = await db
      .select({ brand: workspaceSettings.brand })
      .from(workspaceSettings)
      .where(eq(workspaceSettings.workspaceId, workspace.id))
      .limit(1);
    updates.brand = mergeBrandSettings(
      current?.brand,
      stripPlatformEquivalentBrand(body.brand, 'hosted'),
    );
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
  const appearancePatch =
    typeof body.appearance === 'object' && body.appearance !== null
      ? (body.appearance as { themeMode?: unknown })
      : null;
  if (appearancePatch?.themeMode === 'light' || appearancePatch?.themeMode === 'dark') {
    response.cookies.set('carina_theme_mode', appearancePatch.themeMode, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
    });
  }
  return response;
}
