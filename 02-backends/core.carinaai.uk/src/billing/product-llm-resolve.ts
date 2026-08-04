import { resolveConfigValue } from './billing-config.js';
import { getSubscription } from '../workers/aiva-subscription-store.js';
import {
  getTenantProvider,
  listTenantProvidersForTenant,
} from '../brain/tenant-provider-keys.js';
import type { ProviderOverride } from '../brain/llm.js';

export type AivaLlmLane = 'trial' | 'paid' | 'platform' | 'byok';

export type ResolvedProductLlm = {
  lane: AivaLlmLane;
  provider: string;
  model: string;
  source: 'billing_config' | 'platform_default' | 'workspace_byok';
  reason: string;
};

const PAID_STATUSES = new Set(['active', 'past_due']);

const BYOK_DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-3.5-flash-lite',
  deepseek: 'deepseek-chat',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-6',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'openrouter/auto',
};

/**
 * Paid lane: active/past_due subscription on a non-trial plan.
 * Everything else (trial, trialing, pending, suspended, missing sub) uses trial lane.
 */
export function aivaLlmLaneFromSubscription(input: {
  planTier?: string | null;
  status?: string | null;
} | null): AivaLlmLane {
  if (!input) return 'trial';
  const plan = String(input.planTier || 'trial').trim().toLowerCase();
  const status = String(input.status || '').trim().toLowerCase();
  if (plan !== 'trial' && PAID_STATUSES.has(status)) return 'paid';
  return 'trial';
}

export function resolveConfiguredProductLlm(lane: AivaLlmLane): ResolvedProductLlm | null {
  if (lane === 'platform' || lane === 'byok') return null;
  const providerKey = lane === 'trial' ? 'AIVA_TRIAL_LLM_PROVIDER' : 'AIVA_PAID_LLM_PROVIDER';
  const modelKey = lane === 'trial' ? 'AIVA_TRIAL_LLM_MODEL' : 'AIVA_PAID_LLM_MODEL';
  const provider = resolveConfigValue(providerKey).trim().toLowerCase();
  const model = resolveConfigValue(modelKey).trim();
  if (!provider) return null;
  return {
    lane,
    provider,
    model,
    source: 'billing_config',
    reason: lane === 'trial'
      ? 'Aiva trial / free lane from AI Control'
      : 'Aiva paid lane from AI Control',
  };
}

/**
 * Workspace BYOK wins over managed trial/paid lanes so owner keys (e.g. Gemini)
 * are used while free-trial clients without keys stay on DeepSeek.
 */
export async function resolveWorkspaceByokLlm(
  workspaceId: string,
): Promise<ResolvedProductLlm | null> {
  const id = String(workspaceId || '').trim();
  if (!id) return null;
  const rows = await listTenantProvidersForTenant(id).catch(() => []);
  const enabled = rows.filter((row) => row.enabled && row.provider);
  if (enabled.length === 0) return null;

  const preferred =
    enabled.find((row) => row.provider === 'gemini')
    ?? enabled[0];
  const creds = await getTenantProvider(id, preferred.provider).catch(() => null);
  if (!creds?.apiKey) return null;

  const model = (creds.model || BYOK_DEFAULT_MODELS[preferred.provider] || '').trim();
  return {
    lane: 'byok',
    provider: preferred.provider,
    model,
    source: 'workspace_byok',
    reason: `Workspace BYOK (${preferred.provider}) overrides managed trial/paid lane`,
  };
}

export async function resolveAivaProductLlm(workspaceId: string): Promise<ResolvedProductLlm> {
  const byok = await resolveWorkspaceByokLlm(workspaceId);
  if (byok) return byok;

  const sub = await getSubscription(workspaceId).catch(() => null);
  const lane = aivaLlmLaneFromSubscription(sub);
  const configured = resolveConfiguredProductLlm(lane);
  if (configured) return configured;

  const platformProvider = (process.env.DEFAULT_PROVIDER || '').trim().toLowerCase() || 'deepseek';
  const platformModel = (process.env.DEFAULT_MODEL || '').trim();
  return {
    lane: 'platform',
    provider: platformProvider,
    model: platformModel,
    source: 'platform_default',
    reason: `${lane} lane has no AI Control override; using Carina platform default`,
  };
}

export function toProviderOverride(resolved: ResolvedProductLlm): ProviderOverride | undefined {
  if (resolved.source !== 'billing_config' && resolved.source !== 'workspace_byok') {
    return undefined;
  }
  if (!resolved.provider) return undefined;
  return {
    name: resolved.provider,
    ...(resolved.model ? { model: resolved.model } : {}),
  };
}
