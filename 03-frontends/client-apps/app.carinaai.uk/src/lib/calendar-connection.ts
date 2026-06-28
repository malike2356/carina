import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { calendarConnections } from '@/db/schema';
import type { CalDavCredentials } from '@/lib/caldav-client';
import type { GoogleCalendarCredentials } from '@/lib/google-calendar-client';
import { decryptKey, encryptKey } from '@/lib/vault';

export type CalendarProvider = 'caldav' | 'google';

interface StoredGoogleSecrets {
  clientSecret: string;
  refreshToken: string;
}

export interface CalendarConnectionView {
  id: string;
  provider: CalendarProvider;
  url: string | null;
  username: string | null;
  calendarId: string | null;
  clientId: string | null;
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  hasPassword: boolean;
  hasGoogleSecrets: boolean;
}

export function resolvePlatformGoogleClient(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function resolveGoogleOAuthClient(
  row: typeof calendarConnections.$inferSelect | null,
  workspaceId: string,
): { clientId: string; clientSecret: string } | null {
  const platform = resolvePlatformGoogleClient();
  const secrets = row ? readStoredGoogleSecrets(row, workspaceId) : null;
  const clientId = row?.username?.trim() || platform?.clientId;
  const clientSecret = secrets?.clientSecret || platform?.clientSecret;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export async function getWorkspaceCalendarConnection(workspaceId: string) {
  const [row] = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.workspaceId, workspaceId))
    .limit(1);
  return row ?? null;
}

function readStoredGoogleSecrets(
  row: typeof calendarConnections.$inferSelect,
  workspaceId: string,
): StoredGoogleSecrets | null {
  if (!row.encryptedPassword || !row.passwordIv || !row.passwordTag) return null;
  try {
    const raw = decryptKey(row.encryptedPassword, row.passwordIv, row.passwordTag, workspaceId);
    const parsed = JSON.parse(raw) as StoredGoogleSecrets;
    if (!parsed.clientSecret?.trim() || !parsed.refreshToken?.trim()) return null;
    return {
      clientSecret: parsed.clientSecret.trim(),
      refreshToken: parsed.refreshToken.trim(),
    };
  } catch {
    return null;
  }
}

function sealGoogleSecrets(
  secrets: StoredGoogleSecrets,
  workspaceId: string,
): Pick<typeof calendarConnections.$inferInsert, 'encryptedPassword' | 'passwordIv' | 'passwordTag'> {
  const sealed = encryptKey(JSON.stringify(secrets), workspaceId);
  return {
    encryptedPassword: sealed.encrypted,
    passwordIv: sealed.iv,
    passwordTag: sealed.tag,
  };
}

export function toConnectionView(row: typeof calendarConnections.$inferSelect): CalendarConnectionView {
  const provider = (row.provider === 'google' ? 'google' : 'caldav') as CalendarProvider;
  const hasSecrets = Boolean(row.encryptedPassword && row.passwordIv && row.passwordTag);

  return {
    id: row.id,
    provider,
    url: row.url,
    username: row.username,
    calendarId: provider === 'google' ? row.url : null,
    clientId: provider === 'google' ? row.username : null,
    enabled: row.enabled,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastSyncError: row.lastSyncError,
    hasPassword: provider === 'caldav' ? hasSecrets : false,
    hasGoogleSecrets: provider === 'google' ? hasSecrets : false,
  };
}

export function resolveConnectionCredentials(
  row: typeof calendarConnections.$inferSelect,
  workspaceId: string,
): CalDavCredentials | null {
  if (row.provider === 'google') return null;
  if (!row.url?.trim() || !row.username?.trim()) return null;
  if (!row.encryptedPassword || !row.passwordIv || !row.passwordTag) return null;

  return {
    url: row.url.trim(),
    username: row.username.trim(),
    password: decryptKey(row.encryptedPassword, row.passwordIv, row.passwordTag, workspaceId),
  };
}

export function resolveGoogleConnectionCredentials(
  row: typeof calendarConnections.$inferSelect,
  workspaceId: string,
): GoogleCalendarCredentials | null {
  if (row.provider !== 'google') return null;
  const secrets = readStoredGoogleSecrets(row, workspaceId);
  if (!secrets) return null;

  const clientId = row.username?.trim() || resolvePlatformGoogleClient()?.clientId;
  const clientSecret = secrets.clientSecret || resolvePlatformGoogleClient()?.clientSecret;
  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    refreshToken: secrets.refreshToken,
    calendarId: row.url?.trim() || 'primary',
  };
}

export async function upsertCalendarConnection(
  workspaceId: string,
  input: {
    provider?: CalendarProvider;
    url?: string;
    username?: string;
    password?: string;
    enabled?: boolean;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    calendarId?: string;
  },
) {
  const existing = await getWorkspaceCalendarConnection(workspaceId);
  const provider = input.provider ?? (existing?.provider === 'google' ? 'google' : 'caldav');
  const updates: Partial<typeof calendarConnections.$inferInsert> = {
    provider,
    updatedAt: new Date(),
  };

  if (input.enabled !== undefined) updates.enabled = input.enabled;

  if (provider === 'google') {
    if (input.calendarId !== undefined) updates.url = input.calendarId.trim() || 'primary';
    if (input.clientId !== undefined) updates.username = input.clientId.trim() || null;

    const existingSecrets = existing ? readStoredGoogleSecrets(existing, workspaceId) : null;
    const nextSecrets: StoredGoogleSecrets | null =
      input.clientSecret?.trim() || input.refreshToken?.trim() || existingSecrets
        ? {
            clientSecret: input.clientSecret?.trim() || existingSecrets?.clientSecret || '',
            refreshToken: input.refreshToken?.trim() || existingSecrets?.refreshToken || '',
          }
        : null;

    if (nextSecrets && (nextSecrets.clientSecret || nextSecrets.refreshToken)) {
      Object.assign(updates, sealGoogleSecrets(nextSecrets, workspaceId));
    }
  } else {
    if (input.url !== undefined) updates.url = input.url.trim() || null;
    if (input.username !== undefined) updates.username = input.username.trim() || null;
    if (input.password?.trim()) {
      const sealed = encryptKey(input.password.trim(), workspaceId);
      updates.encryptedPassword = sealed.encrypted;
      updates.passwordIv = sealed.iv;
      updates.passwordTag = sealed.tag;
    }
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
      provider,
      url:
        provider === 'google'
          ? (updates.url ?? input.calendarId?.trim() ?? 'primary')
          : (updates.url ?? null),
      username:
        provider === 'google'
          ? (updates.username ?? input.clientId?.trim() ?? null)
          : (updates.username ?? null),
      encryptedPassword: updates.encryptedPassword,
      passwordIv: updates.passwordIv,
      passwordTag: updates.passwordTag,
      enabled: updates.enabled ?? true,
    })
    .returning();
  return created;
}

export async function saveGoogleOAuthTokens(
  workspaceId: string,
  input: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    calendarId?: string;
  },
) {
  return upsertCalendarConnection(workspaceId, {
    provider: 'google',
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    refreshToken: input.refreshToken,
    calendarId: input.calendarId?.trim() || 'primary',
    enabled: true,
  });
}

export function resolveEnvCalDavCredentials(): CalDavCredentials | null {
  const url = process.env.CALDAV_URL?.trim();
  const username = process.env.CALDAV_USERNAME?.trim();
  const password = process.env.CALDAV_PASSWORD?.trim();
  if (!url || !username || !password) return null;
  return { url, username, password, principalUrl: process.env.CALDAV_PRINCIPAL_URL?.trim() };
}

export function isCalendarConnectionConfigured(view: CalendarConnectionView | null): boolean {
  if (!view?.enabled) return false;
  if (view.provider === 'google') {
    return view.hasGoogleSecrets;
  }
  return Boolean(view.url && view.username && view.hasPassword);
}
