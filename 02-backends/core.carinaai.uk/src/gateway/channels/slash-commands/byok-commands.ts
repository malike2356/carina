import type { SlashCommand } from './registry.js';
import type { ChannelMessage } from '../channel-adapter.interface.js';
import {
  listTenantProvidersForTenant,
  removeTenantProviderKey,
  setTenantProviderKey,
} from '../../../brain/tenant-provider-keys.js';
import {
  PROVIDER_MAP,
  ROUTABLE_PROVIDERS,
  isRoutableProvider,
} from '../../../brain/provider-registry.js';
import {
  CARINA_GATEWAY_BYOK_TENANT,
  getByokOwnerUserId,
  setByokOwnerUserId,
} from '../../telegram-prefs.js';

const PROVIDER_ALIASES: Record<string, string> = {
  google: 'gemini',
  googleai: 'gemini',
  chatgpt: 'openai',
  claude: 'anthropic',
};

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

function parseParts(msg: ChannelMessage): string[] {
  return msg.text.trim().split(/\s+/);
}

function telegramUserId(msg: ChannelMessage): string | null {
  const id = msg.externalUserId?.trim();
  return id || null;
}

function usageText(): string {
  return [
    'BYOK (bring your own LLM key) for Carina:',
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
  msg: ChannelMessage,
  opts: { requireClaimed?: boolean; claimIfEmpty?: boolean } = {},
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const userId = telegramUserId(msg);
  if (!userId) {
    return { ok: false, error: 'Could not identify your Telegram user id.' };
  }

  const ownerId = (await getByokOwnerUserId())?.trim() ?? null;

  if (!ownerId) {
    if (opts.claimIfEmpty || !opts.requireClaimed) {
      await setByokOwnerUserId(userId);
      return { ok: true, userId };
    }
    return {
      ok: false,
      error: 'No BYOK owner claimed yet. Run /byok claim first, then /byok set …',
    };
  }

  if (ownerId !== userId) {
    return {
      ok: false,
      error: 'Only the claimed BYOK owner for this Carina bot can change API keys.',
    };
  }
  return { ok: true, userId };
}

async function handleSet(msg: ChannelMessage, parts: string[]): Promise<string> {
  const providerRaw = parts[2];
  const apiKey = parts[3];
  const baseUrl = parts[4];
  const model = parts[5];

  if (!providerRaw || !apiKey) {
    return 'Usage: /byok set <provider> <api_key> [base_url] [model]';
  }

  const auth = await ensureByokOwner(msg);
  if (!auth.ok) return auth.error;

  const provider = normalizeByokProvider(providerRaw);
  if (!isByokEligibleProvider(provider)) {
    const hints = BYOK_PROVIDER_HINTS.join(', ');
    return `Unknown or unsupported provider "${providerRaw}". Try: ${hints}`;
  }

  if (apiKey.length < 8) {
    return 'That API key looks too short. Paste the full key after the provider name.';
  }

  if (/^(set|clear|list|providers|claim|help)$/i.test(apiKey)) {
    return 'Usage: /byok set <provider> <api_key> [base_url] [model]';
  }

  if (provider === 'custom' && !baseUrl) {
    return 'custom provider requires a base URL. Example:\n/byok set custom sk-... https://api.example.com/v1';
  }

  await setTenantProviderKey(
    CARINA_GATEWAY_BYOK_TENANT,
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
    'Carina will use your key for that provider when this bot runs without another tenant context.',
    'Tip: delete the key message yourself if Telegram could not remove it automatically.',
  ].join('\n');
}

async function handleClear(msg: ChannelMessage, parts: string[]): Promise<string> {
  const providerRaw = parts[2];
  if (!providerRaw) return 'Usage: /byok clear <provider>';

  const auth = await ensureByokOwner(msg, { requireClaimed: true });
  if (!auth.ok) return auth.error;

  const provider = normalizeByokProvider(providerRaw);
  await removeTenantProviderKey(CARINA_GATEWAY_BYOK_TENANT, provider);
  return `Removed BYOK for ${provider}. Carina will fall back to install-configured providers.`;
}

async function handleList(): Promise<string> {
  const rows = await listTenantProvidersForTenant(CARINA_GATEWAY_BYOK_TENANT);
  if (rows.length === 0) {
    return 'No BYOK keys configured for Carina.\nUse /byok set <provider> <api_key>';
  }
  const lines = ['BYOK providers for Carina:', ''];
  for (const row of rows) {
    const flags = [
      row.enabled ? 'enabled' : 'disabled',
      row.hasCustomBaseUrl ? 'custom URL' : null,
      row.hasCustomModel ? 'custom model' : null,
    ].filter(Boolean);
    lines.push(`- ${row.provider} (${flags.join(', ')})`);
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

async function handleClaim(msg: ChannelMessage): Promise<string> {
  const userId = telegramUserId(msg);
  if (!userId) return 'Could not identify your Telegram user id.';

  const ownerId = (await getByokOwnerUserId())?.trim() ?? null;
  if (ownerId && ownerId !== userId) {
    return 'BYOK owner is already claimed by another Telegram user for this Carina bot.';
  }
  if (ownerId === userId) {
    return 'You are already the BYOK owner for this Carina bot.';
  }

  await setByokOwnerUserId(userId);
  return 'Claimed. Only you can /byok set or /byok clear for Carina from Telegram.';
}

export const byokCommand: SlashCommand = {
  name: 'byok',
  description: 'Bring your own LLM key: /byok set|clear|list|claim',
  async handler(msg) {
    if (msg.channel !== 'telegram' || !msg.isDirect) {
      return 'BYOK slash commands are only available in your private Telegram chat with Carina.';
    }

    const parts = parseParts(msg);
    const sub = (parts[1] ?? '').toLowerCase();

    if (!sub || sub === 'help') return usageText();
    if (sub === 'providers' || sub === 'provider') return handleProviders();
    if (sub === 'list' || sub === 'ls' || sub === 'status') return handleList();
    if (sub === 'claim') return handleClaim(msg);
    if (sub === 'set' || sub === 'add' || sub === 'save') return handleSet(msg, parts);
    if (sub === 'clear' || sub === 'remove' || sub === 'delete' || sub === 'rm') {
      return handleClear(msg, parts);
    }

    return `Unknown /byok option: ${sub}\n\n${usageText()}`;
  },
};

export function byokShouldDeleteInbound(msg: ChannelMessage): boolean {
  const parts = parseParts(msg);
  const sub = (parts[1] ?? '').toLowerCase();
  return sub === 'set' || sub === 'add' || sub === 'save';
}
