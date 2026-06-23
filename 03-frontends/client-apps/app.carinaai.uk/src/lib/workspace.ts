import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaces } from '@/db/schema';
import { seedBuiltinWorkspaceProfiles } from '@/lib/workspace-profiles';

export async function getWorkspaceForUser(userId: string) {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.userId, userId))
    .limit(1);
  return workspace ?? null;
}

export async function ensureWorkspaceForUser(userId: string, name: string) {
  const existing = await getWorkspaceForUser(userId);
  if (existing) return existing;
  const [created] = await db
    .insert(workspaces)
    .values({
      userId,
      name: `${name.split(' ')[0] ?? 'My'} workspace`,
    })
    .returning();
  await seedBuiltinWorkspaceProfiles(created.id);
  return created;
}
