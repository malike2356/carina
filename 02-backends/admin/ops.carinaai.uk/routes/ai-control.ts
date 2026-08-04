import { Router } from 'express';
import {
  carinaGet,
  carinaJson,
  carinaOpsTokenSet,
  carinaPost,
} from '../lib/carina.js';
import { hrefWithUiVersion } from '../lib/callback-url.js';
import {
  AI_PRODUCT_SCOPES,
  listAiProductLlms,
  upsertAiProductLlm,
  type AiProductScopeId,
} from '../lib/ai-product-llms.js';
import {
  fetchPlatformAnalytics,
  formatMinorCurrency,
} from '../lib/ai-usage-dashboard.js';
import {
  listBillingConfig,
  upsertBillingConfig,
} from '../lib/billing-config-store.js';
import { notifyCoreBillingConfigReload } from '../lib/billing-config-notify.js';

export const aiControlRouter = Router();

const uiVersion = process.env.UI_VERSION ?? '20260730k';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'models', label: 'Models by product' },
  { id: 'usage', label: 'Usage and cost' },
  { id: 'gates', label: 'Trial and free gates' },
  { id: 'embeddings', label: 'Embeddings' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function parseTab(raw: unknown): TabId {
  const value = String(raw ?? 'overview').trim().toLowerCase();
  return (TABS.some((t) => t.id === value) ? value : 'overview') as TabId;
}

function hubUrl(tab: TabId, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ tab, ...extra });
  return hrefWithUiVersion(`/ai-control?${params.toString()}`, uiVersion);
}

type LlmStatus = {
  enabled?: boolean;
  defaultProvider?: string;
  model?: string;
  chain?: string[];
  configuredProviders?: string[];
  knownProviders?: Array<{
    name: string;
    displayName: string;
    configured: boolean;
    model: string;
    models?: string[];
  }>;
  modelsByProvider?: Record<string, string[]>;
  note?: string;
  error?: string;
};

async function fetchLlmStatus(): Promise<LlmStatus> {
  if (!carinaOpsTokenSet()) {
    return { error: 'Pair Carina in Settings first (CARINA_OPS_TOKEN).' };
  }
  try {
    const response = await carinaGet('/api/ops/llm-rotation', 8000);
    const parsed = await carinaJson<LlmStatus>(response);
    if (!parsed.ok || !parsed.data) {
      return { error: parsed.error ?? 'Failed to load LLM rotation status' };
    }
    return parsed.data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchEmbeddingsStatus(): Promise<Record<string, unknown>> {
  if (!carinaOpsTokenSet()) {
    return { error: 'Pair Carina in Settings first.' };
  }
  try {
    const response = await carinaGet('/api/ops/embeddings', 8000);
    const parsed = await carinaJson<Record<string, unknown>>(response);
    if (!parsed.ok || !parsed.data) {
      return { error: parsed.error ?? 'Failed to load embeddings status' };
    }
    return parsed.data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchProductLlmEngine(): Promise<Record<string, unknown>> {
  if (!carinaOpsTokenSet()) return { error: 'Pair Carina in Settings first.' };
  try {
    const response = await carinaGet('/api/ops/product-llms', 8000);
    const parsed = await carinaJson<Record<string, unknown>>(response);
    if (!parsed.ok || !parsed.data) {
      return { error: parsed.error ?? 'Failed to load product LLM engine status' };
    }
    return parsed.data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

aiControlRouter.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const tab = parseTab(req.query.tab);
  const [llm, productLlms, analytics, embeddings, billingRows, engine] = await Promise.all([
    fetchLlmStatus(),
    listAiProductLlms(),
    fetchPlatformAnalytics(30),
    fetchEmbeddingsStatus(),
    listBillingConfig(),
    fetchProductLlmEngine(),
  ]);

  const gateValues: Record<string, string> = {};
  for (const row of billingRows) {
    if (
      row.key.startsWith('AIVA_TRIAL_')
      || row.key.startsWith('AIVA_SOFT_WALL_')
      || row.key.startsWith('AIVA_PAID_LLM_')
      || row.key.startsWith('CARINA_CLOUD_FREE_')
    ) {
      gateValues[row.key] = row.effectiveValue;
    }
  }
  // Merge recorded trial/paid prefs from billing if product table empty
  if (!productLlms.aiva_trial.provider && gateValues.AIVA_TRIAL_LLM_PROVIDER) {
    productLlms.aiva_trial.provider = gateValues.AIVA_TRIAL_LLM_PROVIDER;
    productLlms.aiva_trial.model = gateValues.AIVA_TRIAL_LLM_MODEL || '';
  }
  if (!productLlms.aiva_paid.provider && gateValues.AIVA_PAID_LLM_PROVIDER) {
    productLlms.aiva_paid.provider = gateValues.AIVA_PAID_LLM_PROVIDER;
    productLlms.aiva_paid.model = gateValues.AIVA_PAID_LLM_MODEL || '';
  }
  if (!productLlms.carina_platform.provider && llm.defaultProvider) {
    productLlms.carina_platform.provider = llm.defaultProvider;
    productLlms.carina_platform.model = llm.model || '';
  }
  if (!productLlms.aiva_platform.provider && llm.defaultProvider) {
    productLlms.aiva_platform.provider = llm.defaultProvider;
    productLlms.aiva_platform.model = llm.model || '';
  }

  res.render('ai-control/index', {
    title: 'AI Control',
    tab,
    tabs: TABS,
    scopes: AI_PRODUCT_SCOPES,
    productLlms,
    llm,
    engine,
    analytics,
    embeddings,
    gateValues,
    money: formatMinorCurrency,
    saved: req.query.saved === '1',
    errMsg: typeof req.query.err === 'string' ? req.query.err : '',
  });
});

aiControlRouter.post('/models', async (req, res) => {
  if (!carinaOpsTokenSet()) {
    res.redirect(hubUrl('models', { err: 'Pair Carina in Settings first' }));
    return;
  }

  const body = req.body as Record<string, string>;
  const actor = String(req.session?.userName ?? req.session?.userId ?? 'ops-admin');

  const platformProvider = String(body.carina_platform_provider ?? '').trim().toLowerCase();
  const platformModel = String(body.carina_platform_model ?? '').trim();
  const rotationEnabled = body.rotation_enabled === '1' || body.rotation_enabled === 'on';
  const rotationProvidersRaw = body.rotation_providers;
  const rotationProviders = Array.isArray(rotationProvidersRaw)
    ? rotationProvidersRaw.map((p) => String(p).trim().toLowerCase()).filter(Boolean)
    : String(rotationProvidersRaw ?? '')
      .split(/[,\s]+/)
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

  try {
    if (platformProvider) {
      const response = await carinaPost(
        '/api/ops/llm-rotation',
        {
          enabled: rotationEnabled,
          defaultProvider: platformProvider,
          model: platformModel,
          providers: rotationProviders.length
            ? rotationProviders
            : String(body.rotation_providers_fallback ?? '')
              .split(/[,\s]+/)
              .map((p) => p.trim())
              .filter(Boolean),
        },
        20000,
      );
      const parsed = await carinaJson<{ ok?: boolean; error?: string }>(response);
      if (!parsed.ok || parsed.data?.ok === false) {
        res.redirect(hubUrl('models', {
          err: (parsed.data?.error || parsed.error || 'Platform LLM save failed').slice(0, 180),
        }));
        return;
      }
      await upsertAiProductLlm({
        scope: 'carina_platform',
        provider: platformProvider,
        model: platformModel,
        updatedBy: actor,
      });
      await upsertAiProductLlm({
        scope: 'aiva_platform',
        provider: platformProvider,
        model: platformModel,
        updatedBy: actor,
      });
    }

    const scoped: Array<{ scope: AiProductScopeId; providerKey: string; modelKey: string }> = [
      { scope: 'ops_assistant', providerKey: 'ops_assistant_provider', modelKey: 'ops_assistant_model' },
      { scope: 'aiva_trial', providerKey: 'aiva_trial_provider', modelKey: 'aiva_trial_model' },
      { scope: 'aiva_paid', providerKey: 'aiva_paid_provider', modelKey: 'aiva_paid_model' },
    ];

    for (const item of scoped) {
      const provider = String(body[item.providerKey] ?? '').trim().toLowerCase();
      const model = String(body[item.modelKey] ?? '').trim();
      if (!provider && !model) continue;
      await upsertAiProductLlm({
        scope: item.scope,
        provider,
        model,
        updatedBy: actor,
      });
    }

    await upsertBillingConfig('AIVA_TRIAL_LLM_PROVIDER', String(body.aiva_trial_provider ?? '').trim().toLowerCase(), actor);
    await upsertBillingConfig('AIVA_TRIAL_LLM_MODEL', String(body.aiva_trial_model ?? '').trim(), actor);
    await upsertBillingConfig('AIVA_PAID_LLM_PROVIDER', String(body.aiva_paid_provider ?? '').trim().toLowerCase(), actor);
    await upsertBillingConfig('AIVA_PAID_LLM_MODEL', String(body.aiva_paid_model ?? '').trim(), actor);

    await notifyCoreBillingConfigReload().catch(() => undefined);

    res.redirect(hubUrl('models', { saved: '1' }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect(hubUrl('models', { err: msg.slice(0, 180) }));
  }
});

/** Legacy path aliases into the hub. */
export function redirectToAiControl(tab: TabId) {
  return (_req: import('express').Request, res: import('express').Response) => {
    res.redirect(302, hubUrl(tab));
  };
}
