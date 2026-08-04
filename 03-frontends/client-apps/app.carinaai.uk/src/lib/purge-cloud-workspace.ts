import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { accounts, sessions, users, workspaces } from '@/db/schema';

export type PurgeCloudWorkspaceResult = {
  purged: boolean;
  workspaceId: string;
  userId: string | null;
  alreadyGone?: boolean;
};

/**
 * Removes the cloud login + workspace for an Aiva customer.
 * Used by ops admin purge so test signups cannot log in again.
 */
export async function purgeCloudWorkspaceById(
  workspaceId: string,
): Promise<PurgeCloudWorkspaceResult> {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace || workspace.deletedAt) {
    return {
      purged: true,
      workspaceId,
      userId: workspace?.userId ?? null,
      alreadyGone: true,
    };
  }

  const userId = workspace.userId;
  const now = new Date();

  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(accounts).where(eq(accounts.userId, userId));

  await db
    .update(workspaces)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(workspaces.id, workspaceId));

  await db
    .update(users)
    .set({
      deletedAt: now,
      email: `deleted+${userId}@deleted.local`,
      name: 'Deleted user',
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  return { purged: true, workspaceId, userId };
}
