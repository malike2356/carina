import { appendEnvValue } from '../cli/config/loader.js';
import {
  isLlmRotationEnabled,
  parseRotationProvidersEnv,
  resolveProviderFallbackChain,
} from '../brain/fallback-chain.js';
import {
  PROVIDER_DEFINITIONS,
  PROVIDER_MAP,
  isProviderConfigured,
  isRoutableProvider,
  providerModel,
} from '../brain/provider-registry.js';
import { llm } from '../brain/llm.js';
import { writeSetting, readDomainSettings } from '../config/settings-store.js';
import { suggestedModelsForProvider } from './llm-provider-models.js';

export const LLM_ROTATION_DOMAIN = 'llm:platform';

export const LLM_ROTATION_MANAGED_KEYS = [
  'CARINA_LLM_ROTATION_ENABLED',
  'CARINA_LLM_ROTATION_PROVIDERS',
  'CARINA_PROVIDER_FALLBACK',
  'DEFAULT_PROVIDER',
  'DEFAULT_MODEL',
] as const;

export type LlmRotationManagedKey = (typeof LLM_ROTATION_MANAGED_KEYS)[number];

export interface LlmProviderCard {
  name: string;
  displayName: string;
  configured: boolean;
  model: string;
  models: string[];
  local: boolean;
  inAllowlist: boolean;
}

export interface LlmRotationPlatformStatus {
  enabled: boolean;
  providers: string[];
  defaultProvider: string;
  model: string;
  configuredProviders: string[];
  chain: string[];
  knownProviders: LlmProviderCard[];
  modelsByProvider: Record<string, string[]>;
  source: 'carina_settings' | 'env' | 'mixed' | 'none';
  note: string;
}

export interface SaveLlmRotationInput {
  enabled?: boolean | string;
  providers?: string[] | string;
  defaultProvider?: string;
  model?: string;
}

function normalizeBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'on', 'yes'].includes(v)) return true;
  if (['0', 'false', 'off', 'no'].includes(v)) return false;
  return fallback;
}

function normalizeProviderList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((p) => String(p).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\s]+/)
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function modelEnvForProvider(provider: string): string | null {
  const def = PROVIDER_MAP[provider];
  return def?.modelEnv ?? null;
}

/**
 * Apply DB-saved LLM rotation keys into process.env (DB wins over container env).
 */
export async function applyLlmRotationSettingsFromDb(): Promise<Record<string, string>> {
  const saved = await readDomainSettings(LLM_ROTATION_DOMAIN, null);
  for (const key of LLM_ROTATION_MANAGED_KEYS) {
    const value = saved[key];
    if (value !== undefined && value !== null) {
      process.env[key] = value;
    }
  }
  // Provider-specific model keys may also be stored under the same domain.
  for (const [key, value] of Object.entries(saved)) {
    if (key.endsWith('_MODEL') && value) {
      process.env[key] = value;
    }
  }
  return saved;
}

function configuredChatProviders(): string[] {
  return PROVIDER_DEFINITIONS
    .filter((d) => isRoutableProvider(d) && isProviderConfigured(d))
    .map((d) => d.name);
}

function knownProviderCards(allowlist: string[]): LlmProviderCard[] {
  const allow = new Set(allowlist);
  return PROVIDER_DEFINITIONS
    .filter((d) => isRoutableProvider(d) && (d.authType === 'api-key' || d.local || d.name === 'custom'))
    .map((d) => {
      const model = providerModel(d);
      return {
        name: d.name,
        displayName: d.displayName,
        configured: isProviderConfigured(d),
        model,
        models: suggestedModelsForProvider(d.name, model),
        local: Boolean(d.local),
        inAllowlist: allow.size === 0 ? true : allow.has(d.name),
      };
    })
    .sort((a, b) => Number(b.configured) - Number(a.configured) || a.name.localeCompare(b.name));
}

export async function getLlmRotationPlatformStatus(): Promise<LlmRotationPlatformStatus> {
  const saved = await applyLlmRotationSettingsFromDb();
  const configured = configuredChatProviders();
  const enabled = isLlmRotationEnabled();
  const providers = parseRotationProvidersEnv();
  let defaultProvider = (process.env.DEFAULT_PROVIDER ?? '').trim().toLowerCase();
  if (!defaultProvider) {
    try {
      defaultProvider = llm.current().name;
    } catch {
      defaultProvider = configured[0] ?? 'deepseek';
    }
  }
  const model = providerModel(PROVIDER_MAP[defaultProvider] ?? PROVIDER_MAP.deepseek);

  let chain: string[] = [];
  try {
    chain = resolveProviderFallbackChain({
      activeProvider: defaultProvider,
      configuredNames: configured.length > 0 ? configured : [defaultProvider],
      definitions: PROVIDER_DEFINITIONS,
    });
  } catch {
    chain = enabled ? configured : (defaultProvider ? [defaultProvider] : []);
  }

  const hasDb = LLM_ROTATION_MANAGED_KEYS.some((k) => saved[k] !== undefined);
  const hasEnv = Boolean(
    process.env.CARINA_LLM_ROTATION_ENABLED
    || process.env.CARINA_LLM_ROTATION_PROVIDERS
    || process.env.DEFAULT_PROVIDER,
  );

  const knownProviders = knownProviderCards(providers);
  const modelsByProvider: Record<string, string[]> = {};
  for (const card of knownProviders) {
    modelsByProvider[card.name] = card.models;
  }
  modelsByProvider[defaultProvider] = suggestedModelsForProvider(defaultProvider, model);

  return {
    enabled,
    providers,
    defaultProvider,
    model,
    configuredProviders: configured,
    chain,
    knownProviders,
    modelsByProvider,
    source: hasDb && hasEnv ? 'mixed' : hasDb ? 'carina_settings' : hasEnv ? 'env' : 'none',
    note: enabled
      ? 'Rotation ON: on failure, try allowlisted providers in order (active first).'
      : 'Rotation OFF: locked to the default provider and its model only.',
  };
}

async function persistKey(key: string, value: string): Promise<{ ok: boolean; error?: string }> {
  const result = await writeSetting({
    domainId: LLM_ROTATION_DOMAIN,
    key,
    value,
    sensitive: false,
    envVar: key,
    workspaceId: null,
  });
  if (!result.ok) return result;
  try {
    await appendEnvValue(key, value);
  } catch {
    // DB + process.env already updated; .env sync is best-effort.
  }
  return { ok: true };
}

export async function saveLlmRotationPlatformConfig(
  input: SaveLlmRotationInput,
): Promise<{ ok: boolean; error?: string }> {
  await applyLlmRotationSettingsFromDb();

  if (input.enabled !== undefined) {
    const enabled = normalizeBool(input.enabled, true);
    const r = await persistKey('CARINA_LLM_ROTATION_ENABLED', enabled ? 'true' : 'false');
    if (!r.ok) return r;
  }

  if (input.providers !== undefined) {
    const list = normalizeProviderList(input.providers);
    const unknown = list.filter((name) => !PROVIDER_MAP[name]);
    if (unknown.length > 0) {
      return { ok: false, error: `Unknown providers: ${unknown.join(', ')}` };
    }
    const value = list.join(',');
    const r1 = await persistKey('CARINA_LLM_ROTATION_PROVIDERS', value);
    if (!r1.ok) return r1;
    const r2 = await persistKey('CARINA_PROVIDER_FALLBACK', value);
    if (!r2.ok) return r2;
  }

  if (input.defaultProvider !== undefined) {
    const provider = String(input.defaultProvider).trim().toLowerCase();
    if (!provider) {
      return { ok: false, error: 'defaultProvider is required' };
    }
    if (!PROVIDER_MAP[provider]) {
      return { ok: false, error: `Unknown provider: ${provider}` };
    }
    const r = await persistKey('DEFAULT_PROVIDER', provider);
    if (!r.ok) return r;
    try {
      if (llm.isProviderConfigured(provider)) {
        llm.use(provider, input.model?.trim() || undefined);
      }
    } catch {
      // Provider may not be configured yet; env still updated.
    }
  }

  if (input.model !== undefined) {
    const model = String(input.model).trim();
    const provider = (
      input.defaultProvider !== undefined
        ? String(input.defaultProvider).trim().toLowerCase()
        : (process.env.DEFAULT_PROVIDER ?? '')
    ).trim().toLowerCase() || 'deepseek';

    const rDefault = await persistKey('DEFAULT_MODEL', model);
    if (!rDefault.ok) return rDefault;

    const modelEnv = modelEnvForProvider(provider);
    if (modelEnv) {
      const rModel = await persistKey(modelEnv, model);
      if (!rModel.ok) return rModel;
    }
  }

  return { ok: true };
}
