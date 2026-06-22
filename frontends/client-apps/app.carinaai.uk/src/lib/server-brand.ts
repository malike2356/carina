import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceSettings } from '@/db/schema';
import {
  normalizeBrandConfig,
  resolveBrand,
  resolveWorkspaceBrand,
  type ResolvedBrand,
} from '@/lib/brand';
import { getSession, requireWorkspace } from '@/lib/session';

export function getPublicBrand(): ResolvedBrand {
  return resolveBrand({ mode: 'hosted' });
}

export async function getWorkspaceResolvedBrand(userId: string): Promise<ResolvedBrand> {
  const workspace = await requireWorkspace(userId);
  const [settings] = await db
    .select({ brand: workspaceSettings.brand, customTheme: workspaceSettings.customTheme })
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspace.id))
    .limit(1);

  return resolveWorkspaceBrand({
    workspaceBrand: normalizeBrandConfig(settings?.brand ?? {}),
    userColorTokens: settings?.customTheme,
  });
}

export async function getBrandForCurrentRequest(): Promise<ResolvedBrand> {
  const session = await getSession();
  if (session?.user?.id) {
    try {
      return await getWorkspaceResolvedBrand(session.user.id);
    } catch {
      return getPublicBrand();
    }
  }
  return getPublicBrand();
}

export async function getRequestHostname(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? '';
  return host.split(':')[0].trim().toLowerCase();
}
