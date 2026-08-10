import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveConfigValue = vi.fn((key: string) => {
  const map: Record<string, string> = {
    AIVA_TRIAL_LLM_PROVIDER: 'deepseek',
    AIVA_TRIAL_LLM_MODEL: 'deepseek-chat',
    AIVA_PAID_LLM_PROVIDER: 'anthropic',
    AIVA_PAID_LLM_MODEL: 'claude-sonnet-4-6',
  };
  return map[key] ?? '';
});

const getSubscription = vi.fn();
const listTenantProvidersForTenant = vi.fn();
const getTenantProvider = vi.fn();

vi.mock('./billing-config.js', () => ({
  resolveConfigValue,
  refreshBillingConfigCache: vi.fn(async () => undefined),
}));
vi.mock('../workers/aiva-subscription-store.js', () => ({ getSubscription }));
vi.mock('../brain/tenant-provider-keys.js', () => ({
  listTenantProvidersForTenant,
  getTenantProvider,
}));
vi.mock('../integrations/keprix-health.js', () => ({
  probeKeprixHealth: vi.fn(async () => ({ healthy: true, checkedAt: new Date().toISOString(), latencyMs: 1, reason: 'test' })),
}));

describe('product-llm-resolve', () => {
  beforeEach(() => {
    getSubscription.mockReset();
    listTenantProvidersForTenant.mockReset();
    getTenantProvider.mockReset();
    listTenantProvidersForTenant.mockResolvedValue([]);
    getTenantProvider.mockResolvedValue(null);
    process.env.DEFAULT_PROVIDER = 'openai';
    process.env.DEFAULT_MODEL = 'gpt-4o-mini';
    delete process.env.AIVA_ENGINE_POLICY;
    delete process.env.KEPRIX_PREFERRED;
    delete process.env.KEPRIX_SERVICE_TOKEN;
    delete process.env.KEPRIX_API_BASE_URL;
  });

  it('maps trial statuses to trial lane', async () => {
    const { aivaLlmLaneFromSubscription } = await import('./product-llm-resolve.js');
    expect(aivaLlmLaneFromSubscription({ planTier: 'trial', status: 'trialing' })).toBe('trial');
    expect(aivaLlmLaneFromSubscription({ planTier: 'trial', status: 'pending_channel' })).toBe('trial');
    expect(aivaLlmLaneFromSubscription(null)).toBe('trial');
  });

  it('maps paid active subscriptions to paid lane', async () => {
    const { aivaLlmLaneFromSubscription } = await import('./product-llm-resolve.js');
    expect(aivaLlmLaneFromSubscription({ planTier: 'starter', status: 'active' })).toBe('paid');
    expect(aivaLlmLaneFromSubscription({ planTier: 'growth', status: 'past_due' })).toBe('paid');
    expect(aivaLlmLaneFromSubscription({ planTier: 'starter', status: 'canceled' })).toBe('trial');
  });

  it('resolves trial override from billing_config', async () => {
    getSubscription.mockResolvedValue({ planTier: 'trial', status: 'trialing' });
    const { resolveAivaProductLlm, toProviderOverride } = await import('./product-llm-resolve.js');
    const resolved = await resolveAivaProductLlm('ws-1');
    expect(resolved.lane).toBe('trial');
    expect(resolved.provider).toBe('deepseek');
    expect(resolved.model).toBe('deepseek-chat');
    expect(toProviderOverride(resolved)).toEqual({ name: 'deepseek', model: 'deepseek-chat' });
  });

  it('resolves paid override from billing_config', async () => {
    getSubscription.mockResolvedValue({ planTier: 'business', status: 'active' });
    const { resolveAivaProductLlm } = await import('./product-llm-resolve.js');
    const resolved = await resolveAivaProductLlm('ws-2');
    expect(resolved.lane).toBe('paid');
    expect(resolved.provider).toBe('anthropic');
    expect(resolved.model).toBe('claude-sonnet-4-6');
  });

  it('prefers workspace Gemini BYOK over trial DeepSeek', async () => {
    getSubscription.mockResolvedValue({ planTier: 'trial', status: 'trialing' });
    listTenantProvidersForTenant.mockResolvedValue([
      { provider: 'gemini', enabled: true, hasCustomBaseUrl: false, hasCustomModel: false },
    ]);
    getTenantProvider.mockResolvedValue({
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'gemini-3.5-flash-lite',
    });
    const { resolveAivaProductLlm, toProviderOverride } = await import('./product-llm-resolve.js');
    const resolved = await resolveAivaProductLlm('ws-owner');
    expect(resolved.lane).toBe('byok');
    expect(resolved.source).toBe('workspace_byok');
    expect(resolved.provider).toBe('gemini');
    expect(resolved.model).toBe('gemini-3.5-flash-lite');
    expect(toProviderOverride(resolved)).toEqual({ name: 'gemini', model: 'gemini-3.5-flash-lite' });
  });

  it('selects configured Keprix when the preferred engine policy is enabled', async () => {
    process.env.AIVA_ENGINE_POLICY = 'keprix_preferred';
    process.env.KEPRIX_SERVICE_TOKEN = 'test-keprix-token';
    process.env.KEPRIX_API_BASE_URL = 'http://keprix.test/v1';
    const { resolveAivaProductLlm, toProviderOverride } = await import('./product-llm-resolve.js');
    const resolved = await resolveAivaProductLlm('ws-keprix');
    expect(resolved.source).toBe('engine_policy');
    expect(resolved.provider).toBe('keprix');
    expect(toProviderOverride(resolved)).toEqual({ name: 'keprix', model: 'auto' });
  });
});
