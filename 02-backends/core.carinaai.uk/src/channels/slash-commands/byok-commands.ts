import type { SlashCommand } from './registry.js';
import type { InboundMessage } from '../types.js';
import type { WorkerConfig } from '../../types/index.js';
import { getWorkerById, updateWorker } from '../../workers/worker-store.js';
import {
  listTenantProvidersForTenant,
  removeTenantProviderKey,
  setTenantProviderKey,
} from '../../brain/tenant-provider-keys.js';
import {
  PROVIDER_MAP,
  ROUTABLE_PROVIDERS,
  isRoutableProvider,
} from '../../brain/provider-registry.js';

const PROVIDER_ALIASES: Record<string, string> = {
  google: 'gemini',
  googleai: 'gemini',
  chatgpt: 'openai',
  claude: 'anthropic',
};

/** Curated list shown by /byok providers (still accept any api-key routable provider). */
export const BYOK_PROVIDER_HINTS = [
  'deepseek',
  'openai',
  'anthropic',
  'gemini',
  'groq',
  'openrouter',
  'nvidia',
  'mistral',
  'together',
  'xai',
  'custom',
] as const;

export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '****';
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function normalizeByokProvider(raw: string): string {
  const name = raw.trim().toLowerCase();
  return PROVIDER_ALIASES[name] ?? name;
}

export function isByokEligibleProvider(provider: string): boolean {
  const def = PROVIDER_MAP[provider];
  if (!def) return false;
  if (!isRoutableProvider(def) && def.status !== 'alias') return false;
  if (def.authType === 'oauth' || def.authType === 'external-cli') return false;
  if (def.embeddingOnly) return false;
  return def.authType === 'api-key' || def.authType === 'local' || def.authType === 'none';
}

function parseParts(msg: InboundMessage): string[] {
  // Keep API key intact: only split the command line into args carefully.
  // Format: /byok set <provider> <api_key> [base_url] [model]
  return (msg.content?.trim() ?? '').split(/\s+/);
}

function telegramUserId(msg: InboundMessage): string | null {
  const fromMeta = msg.metadata?.telegramUserId?.trim();
  if (fromMeta) return fromMeta;
  const raw = msg.rawPayload as { message?: { from?: { id?: number } } } | null;
  const id = raw?.message?.from?.id;
  return typeof id === 'number' ? String(id) : null;
}

function usageText(): string {
  return [
    'BYOK (bring your own LLM key) for this Aiva:',
    '',
    '/byok claim              - bind yourself as the only user who can set/clear keys',
    '/byok list               - providers configured (keys never shown)',
    '/byok providers          - supported provider names',
    '/byok set <provider> <api_key> [base_url] [model]',
    '/byok clear <provider>   - remove a key',
    '',
    'Examples:',
    '/byok set deepseek sk-...',
    '/byok set openai sk-... https://api.openai.com/v1 gpt-4o',
    '/byok clear openai',
    '',
    'After /byok set, your message with the key is deleted from this chat when possible.',
  ].join('\n');
}

async function ensureByokOwner(
  msg: InboundMessage,
  workerId: string,
  opts: { requireClaimed?: boolean; claimIfEmpty?: boolean } = {},
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const userId = telegramUserId(msg);
  if (!userId) {
    return { ok: false, error: 'Could not identify your Telegram user id.' };
  }

  const worker = await getWorkerById(workerId);
  if (!worker) return { ok: false, error: 'Worker not found.' };

  const current = (worker.workerConfig ?? {}) as WorkerConfig;
  const ownerId = current.telegram?.byokOwnerUserId?.trim();

  if (!ownerId) {
    if (opts.claimIfEmpty) {
      const nextConfig: WorkerConfig = {
        ...current,
        telegram: {
          ...(current.telegram ?? {}),
          byokOwnerUserId: userId,
        },
      };
      await updateWorker(msg.workspaceId, workerId, { workerConfig: nextConfig });
      return { ok: true, userId };
    }
    if (opts.requireClaimed) {
      return {
        ok: false,
        error: 'No BYOK owner claimed yet. Run /byok claim first, then /byok set …',
      };
    }
    // First mutating set auto-claims
    const nextConfig: WorkerConfig = {
      ...current,
      telegram: {
        ...(current.telegram ?? {}),
        byokOwnerUserId: userId,
      },
    };
    await updateWorker(msg.workspaceId, workerId, { workerConfig: nextConfig });
    return { ok: true, userId };
  }

  if (ownerId !== userId) {
    return {
      ok: false,
      error: 'Only the claimed BYOK owner for this Aiva can change API keys. Ask them, or use the app vault.',
    };
  }
  return { ok: true, userId };
}

async function handleSet(msg: InboundMessage, workerId: string, parts: string[]): Promise<string> {
  // /byok set <provider> <api_key> [base_url] [model]
  const providerRaw = parts[2];
  const apiKey = parts[3];
  const baseUrl = parts[4];
  const model = parts[5];

  if (!providerRaw || !apiKey) {
    return 'Usage: /byok set <provider> <api_key> [base_url] [model]';
  }

  const auth = await ensureByokOwner(msg, workerId);
  if (!auth.ok) return auth.error;

  const provider = normalizeByokProvider(providerRaw);
  if (!isByokEligibleProvider(provider)) {
    const hints = BYOK_PROVIDER_HINTS.join(', ');
    return `Unknown or unsupported provider "${providerRaw}". Try: ${hints}`;
  }

  if (apiKey.length < 8) {
    return 'That API key looks too short. Paste the full key after the provider name.';
  }

  // Refuse if the key looks like a subcommand leaked into the key slot
  if (/^(set|clear|list|providers|claim|help)$/i.test(apiKey)) {
    return 'Usage: /byok set <provider> <api_key> [base_url] [model]';
  }

  if (provider === 'custom' && !baseUrl) {
    return 'custom provider requires a base URL. Example:\n/byok set custom sk-... https://api.example.com/v1';
  }

  await setTenantProviderKey(
    msg.workspaceId,
    provider,
    apiKey,
    baseUrl,
    model,
  );

  const extras: string[] = [];
  if (baseUrl) extras.push('custom base URL');
  if (model) extras.push(`model ${model}`);

  return [
    `Saved BYOK for ${provider}${extras.length ? ` (${extras.join(', ')})` : ''}.`,
    `Key fingerprint: ${maskApiKey(apiKey)} (full key never stored in chat replies).`,
    'This Aiva will use your key for that provider. Platform wallet is not charged for those calls.',
    'Tip: delete the key message yourself if Telegram could not remove it automatically.',
  ].join('\n');
}

async function handleClear(msg: InboundMessage, workerId: string, parts: string[]): Promise<string> {
  const providerRaw = parts[2];
  if (!providerRaw) return 'Usage: /byok clear <provider>';

  const auth = await ensureByokOwner(msg, workerId, { requireClaimed: true });
  if (!auth.ok) return auth.error;

  const provider = normalizeByokProvider(providerRaw);
  await removeTenantProviderKey(msg.workspaceId, provider);
  return `Removed BYOK for ${provider}. This Aiva will fall back to platform tokens for that provider.`;
}

async function handleList(msg: InboundMessage): Promise<string> {
  const rows = await listTenantProvidersForTenant(msg.workspaceId);
  if (rows.length === 0) {
    return 'No BYOK keys configured for this workspace.\nUse /byok set <provider> <api_key>';
  }
  const lines = ['BYOK providers for this workspace:', ''];
  for (const row of rows) {
    const flags = [
      row.enabled ? 'enabled' : 'disabled',
      row.hasCustomBaseUrl ? 'custom URL' : null,
      row.hasCustomModel ? 'custom model' : null,
    ].filter(Boolean);
    lines.push(`• ${row.provider} (${flags.join(', ')})`);
  }
  lines.push('', 'Keys are encrypted at rest and never shown here.');
  return lines.join('\n');
}

function handleProviders(): string {
  const known = ROUTABLE_PROVIDERS
    .filter((d) => d.authType === 'api-key' || d.name === 'custom')
    .map((d) => d.name)
    .sort();
  return [
    'Common BYOK providers:',
    BYOK_PROVIDER_HINTS.join(', '),
    '',
    'Also accepted (api-key):',
    known.join(', '),
    '',
    'Alias: google → gemini, claude → anthropic, chatgpt → openai',
  ].join('\n');
}

async function handleClaim(msg: InboundMessage, workerId: string): Promise<string> {
  const worker = await getWorkerById(workerId);
  if (!worker) return 'Worker not found.';
  const userId = telegramUserId(msg);
  if (!userId) return 'Could not identify your Telegram user id.';

  const current = (worker.workerConfig ?? {}) as WorkerConfig;
  const ownerId = current.telegram?.byokOwnerUserId?.trim();
  if (ownerId && ownerId !== userId) {
    return 'BYOK owner is already claimed by another Telegram user for this Aiva.';
  }
  if (ownerId === userId) {
    return 'You are already the BYOK owner for this Aiva.';
  }

  const nextConfig: WorkerConfig = {
    ...current,
    telegram: {
      ...(current.telegram ?? {}),
      byokOwnerUserId: userId,
    },
  };
  await updateWorker(msg.workspaceId, workerId, { workerConfig: nextConfig });
  return 'Claimed. Only you can /byok set or /byok clear for this Aiva from Telegram.';
}

export const byokCommand: SlashCommand = {
  name: 'byok',
  description: 'Bring your own LLM key: /byok set|clear|list|providers|claim',
  async handler(msg, workerId) {
    if (msg.channel !== 'telegram' && msg.channel !== 'web') {
      // Allow telegram primarily; web for tests. Block group-like channels.
      return 'BYOK slash commands are only available in your private Telegram chat with this Aiva.';
    }

    const parts = parseParts(msg);
    const sub = (parts[1] ?? '').toLowerCase();

    if (!sub || sub === 'help') return usageText();
    if (sub === 'providers' || sub === 'provider') return handleProviders();
    if (sub === 'list' || sub === 'ls' || sub === 'status') return handleList(msg);
    if (sub === 'claim') return handleClaim(msg, workerId);
    if (sub === 'set' || sub === 'add' || sub === 'save') return handleSet(msg, workerId, parts);
    if (sub === 'clear' || sub === 'remove' || sub === 'delete' || sub === 'rm') {
      return handleClear(msg, workerId, parts);
    }

    return `Unknown /byok option: ${sub}\n\n${usageText()}`;
  },
};

/** True when the inbound slash message may contain a secret and should be deleted after handling. */
export function byokShouldDeleteInbound(msg: InboundMessage): boolean {
  const parts = parseParts(msg);
  const sub = (parts[1] ?? '').toLowerCase();
  return sub === 'set' || sub === 'add' || sub === 'save';
}
