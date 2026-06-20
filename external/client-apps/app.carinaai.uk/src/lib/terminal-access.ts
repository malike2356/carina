import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceMembers, workspaceSettings, workspaces } from '@/db/schema';

export async function isWorkspaceOwner(workspaceId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ ownerId: workspaces.userId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return rows[0]?.ownerId === userId;
}

export async function canUseTerminal(workspaceId: string, userId: string): Promise<boolean> {
  const settingsRows = await db
    .select({ terminalEnabled: workspaceSettings.terminalEnabled })
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId))
    .limit(1);

  let terminalEnabled = settingsRows[0]?.terminalEnabled;
  if (terminalEnabled === undefined) {
    await db
      .insert(workspaceSettings)
      .values({ workspaceId, terminalEnabled: true })
      .onConflictDoUpdate({
        target: workspaceSettings.workspaceId,
        set: { terminalEnabled: true, updatedAt: new Date() },
      });
    terminalEnabled = true;
  }

  if (!terminalEnabled) return false;

  if (await isWorkspaceOwner(workspaceId, userId)) return true;

  const memberRows = await db
    .select({ permissions: workspaceMembers.permissions })
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId),
    ))
    .limit(1);

  const perms = (memberRows[0]?.permissions ?? {}) as Record<string, unknown>;
  return perms['terminal'] === true;
}

export async function listWorkspaceMembers(workspaceId: string) {
  return db
    .select({
      id: workspaceMembers.id,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      permissions: workspaceMembers.permissions,
      invitedAt: workspaceMembers.invitedAt,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
}

export async function setMemberTerminalPermission(
  workspaceId: string,
  memberUserId: string,
  allowed: boolean,
): Promise<void> {
  const rows = await db
    .select({ id: workspaceMembers.id, permissions: workspaceMembers.permissions })
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, memberUserId),
    ))
    .limit(1);

  const existing = rows[0];
  const permissions = {
    ...((existing?.permissions ?? {}) as Record<string, unknown>),
    terminal: allowed,
  };

  if (existing) {
    await db
      .update(workspaceMembers)
      .set({ permissions })
      .where(eq(workspaceMembers.id, existing.id));
    return;
  }

  await db.insert(workspaceMembers).values({
    workspaceId,
    userId: memberUserId,
    role: 'member',
    permissions,
  });
}
