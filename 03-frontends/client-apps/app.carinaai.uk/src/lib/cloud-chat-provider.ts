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
  'google',
  'gemini',
]);

/** Non-chat integrations stored as provider keys (must never be selected for cloud chat). */
const NON_CHAT_PROVIDERS = new Set(['labyrinth-scout', 'anthropic']);

export type WorkspaceProviderKey = {
  provider: string;
  apiKey: string;
};

function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase();
}

/** Map vault aliases onto the transport id used by cloud chat endpoints. */
export function canonicalCloudChatProvider(provider: string): string {
  const normalized = normalizeProvider(provider);
  if (normalized === 'gemini') return 'google';
  return normalized;
}

export function isCloudChatProvider(provider: string): boolean {
  const normalized = normalizeProvider(provider);
  if (NON_CHAT_PROVIDERS.has(normalized)) return false;
  return CLOUD_CHAT_PROVIDERS.has(normalized) || CLOUD_CHAT_PROVIDERS.has(canonicalCloudChatProvider(normalized));
}

export function filterCloudChatProviderKeys(
  keys: readonly WorkspaceProviderKey[],
): WorkspaceProviderKey[] {
  return keys
    .filter((key) => isCloudChatProvider(key.provider) && key.apiKey.trim())
    .map((key) => ({
      provider: canonicalCloudChatProvider(key.provider),
      apiKey: key.apiKey,
    }));
}

export function listConfiguredProviders(keys: readonly WorkspaceProviderKey[]): string[] {
  return [
    ...new Set(
      keys
        .map((key) => canonicalCloudChatProvider(key.provider))
        .filter((provider) => isCloudChatProvider(provider)),
    ),
  ];
}

export function resolveActiveCloudProvider(
  keys: readonly WorkspaceProviderKey[],
  preferred: string | null | undefined,
): string | null {
  const configured = listConfiguredProviders(keys);
  const normalizedPreferred = canonicalCloudChatProvider(preferred ?? '');
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
