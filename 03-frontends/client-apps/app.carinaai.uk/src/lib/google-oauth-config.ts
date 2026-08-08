import { sql } from 'drizzle-orm';
import { db } from '@/db';

export type GoogleOAuthClientConfig = {
  clientId: string;
  clientSecret: string;
};

const PLATFORM_GOOGLE_GROUP = 'google_oauth';

export function isGoogleOAuthClientId(value: string | null | undefined): boolean {
  const clientId = value?.trim() ?? '';
  return /^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(clientId);
}

/**
 * Read platform Google OAuth from env.
 * Use static `process.env.NAME` access (not `process.env[name]`): Next.js server
 * bundles only expose env keys that appear as static property reads.
 */
function googleClientFromEnv(): GoogleOAuthClientConfig | null {
  const clientId =
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    '';
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ||
    '';
  if (!isGoogleOAuthClientId(clientId) || !clientSecret) return null;
  return { clientId, clientSecret };
}

function rowsFromExecute<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && Array.isArray((value as { rows?: unknown[] }).rows)) {
    return (value as { rows: T[] }).rows;
  }
  return [];
}

async function platformSettingValue(key: string): Promise<string | null> {
  try {
    const rows = rowsFromExecute<{ value: string | null }>(
      await db.execute(sql`
        SELECT value
        FROM platform_settings
        WHERE key = ${key}
          AND "group" = ${PLATFORM_GOOGLE_GROUP}
        ORDER BY id ASC
        LIMIT 1
      `),
    );
    const settingValue = rows[0]?.value;
    return typeof settingValue === 'string' && settingValue.trim() ? settingValue.trim() : null;
  } catch {
    return null;
  }
}

export async function resolvePlatformGoogleClient(): Promise<GoogleOAuthClientConfig | null> {
  const fromDbId = await platformSettingValue('google_oauth_client_id');
  const fromDbSecret = await platformSettingValue('google_oauth_client_secret');
  if (fromDbId && isGoogleOAuthClientId(fromDbId) && fromDbSecret) {
    return { clientId: fromDbId, clientSecret: fromDbSecret };
  }

  return googleClientFromEnv();
}

export async function isGoogleAuthEnabled(): Promise<boolean> {
  return Boolean(await resolvePlatformGoogleClient());
}
