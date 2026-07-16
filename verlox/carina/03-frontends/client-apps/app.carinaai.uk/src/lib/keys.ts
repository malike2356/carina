import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { byokKeys } from '@/db/schema';
import { decryptKey } from './vault';

export async function listWorkspaceKeys(workspaceId: string) {
  return db
    .select({
      id: byokKeys.id,
      provider: byokKeys.provider,
      keyHint: byokKeys.keyHint,
      createdAt: byokKeys.createdAt,
    })
    .from(byokKeys)
    .where(eq(byokKeys.workspaceId, workspaceId));
}

export async function getDecryptedWorkspaceKeys(workspaceId: string) {
  const rows = await db
    .select()
    .from(byokKeys)
    .where(eq(byokKeys.workspaceId, workspaceId));

  return rows.map((row) => ({
    provider: row.provider,
    apiKey: decryptKey(row.encryptedKey, row.iv, row.tag, workspaceId),
  }));
}

export async function deleteWorkspaceKey(workspaceId: string, keyId: string) {
  await db
    .delete(byokKeys)
    .where(and(eq(byokKeys.workspaceId, workspaceId), eq(byokKeys.id, keyId)));
}
