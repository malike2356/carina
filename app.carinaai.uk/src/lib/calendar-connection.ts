import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { calendarConnections } from '@/db/schema';
import { decryptKey, encryptKey } from '@/lib/vault';
import type { CalDavCredentials } from '@/lib/caldav-client';

export interface CalendarConnectionView {
  id: string;
  provider: string;
  url: string | null;
  username: string | null;
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  hasPassword: boolean;
}

export async function getWorkspaceCalendarConnection(workspaceId: string) {
  const [row] = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.workspaceId, workspaceId))
    .limit(1);
  return row ?? null;
}

export function toConnectionView(row: typeof calendarConnections.$inferSelect): CalendarConnectionView {
  return {
    id: row.id,
    provider: row.provider,
    url: row.url,
    username: row.username,
    enabled: row.enabled,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastSyncError: row.lastSyncError,
    hasPassword: Boolean(row.encryptedPassword && row.passwordIv && row.passwordTag),
  };
}

export function resolveConnectionCredentials(
  row: typeof calendarConnections.$inferSelect,
  workspaceId: string,
): CalDavCredentials | null {
  if (!row.url?.trim() || !row.username?.trim()) return null;
  if (!row.encryptedPassword || !row.passwordIv || !row.passwordTag) return null;

  return {
    url: row.url.trim(),
    username: row.username.trim(),
    password: decryptKey(row.encryptedPassword, row.passwordIv, row.passwordTag, workspaceId),
  };
}

export async function upsertCalendarConnection(
  workspaceId: string,
  input: {
    url?: string;
    username?: string;
    password?: string;
    enabled?: boolean;
  },
) {
  const existing = await getWorkspaceCalendarConnection(workspaceId);
  const updates: Partial<typeof calendarConnections.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.url !== undefined) updates.url = input.url.trim() || null;
  if (input.username !== undefined) updates.username = input.username.trim() || null;
  if (input.enabled !== undefined) updates.enabled = input.enabled;

  if (input.password?.trim()) {
    const sealed = encryptKey(input.password.trim(), workspaceId);
    updates.encryptedPassword = sealed.encrypted;
    updates.passwordIv = sealed.iv;
    updates.passwordTag = sealed.tag;
  }

  if (existing) {
    const [updated] = await db
      .update(calendarConnections)
      .set(updates)
      .where(eq(calendarConnections.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(calendarConnections)
    .values({
      workspaceId,
      provider: 'caldav',
      url: updates.url ?? null,
      username: updates.username ?? null,
      encryptedPassword: updates.encryptedPassword,
      passwordIv: updates.passwordIv,
      passwordTag: updates.passwordTag,
      enabled: updates.enabled ?? true,
    })
    .returning();
  return created;
}

export function resolveEnvCalDavCredentials(): CalDavCredentials | null {
  const url = process.env.CALDAV_URL?.trim();
  const username = process.env.CALDAV_USERNAME?.trim();
  const password = process.env.CALDAV_PASSWORD?.trim();
  if (!url || !username || !password) return null;
  return { url, username, password, principalUrl: process.env.CALDAV_PRINCIPAL_URL?.trim() };
}
