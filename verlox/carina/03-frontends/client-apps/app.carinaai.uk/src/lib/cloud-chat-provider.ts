import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceSettings } from '@/db/schema';

const CLOUD_CHAT_PROVIDERS = new Set([
  'deepseek',
  'openai',
  'groq',
  'openrouter',
  'together',
  'mistral',
]);

export type WorkspaceProviderKey = {
  provider: string;
  apiKey: string;
};

function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase();
}

export function isCloudChatProvider(provider: string): boolean {
  return CLOUD_CHAT_PROVIDERS.has(normalizeProvider(provider));
}

export function listConfiguredProviders(keys: readonly WorkspaceProviderKey[]): string[] {
  return [...new Set(keys.map((key) => normalizeProvider(key.provider)).filter(Boolean))];
}

export function resolveActiveCloudProvider(
  keys: readonly WorkspaceProviderKey[],
  preferred: string | null | undefined,
): string | null {
  const configured = listConfiguredProviders(keys).filter(isCloudChatProvider);
  const normalizedPreferred = normalizeProvider(preferred ?? '');
  if (normalizedPreferred && configured.includes(normalizedPreferred)) return normalizedPreferred;
  if (configured.includes('deepseek')) return 'deepseek';
  return configured[0] ?? null;
}

export async function getWorkspaceDefaultProvider(workspaceId: string): Promise<string> {
  const [settings] = await db
    .select({ defaultProvider: workspaceSettings.defaultProvider })
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId))
    .limit(1);
  return normalizeProvider(settings?.defaultProvider ?? '');
}

export async function setWorkspaceDefaultProvider(
  workspaceId: string,
  provider: string,
): Promise<void> {
  const defaultProvider = normalizeProvider(provider);
  await db
    .insert(workspaceSettings)
    .values({ workspaceId, defaultProvider })
    .onConflictDoUpdate({
      target: workspaceSettings.workspaceId,
      set: { defaultProvider, updatedAt: new Date() },
    });
}
