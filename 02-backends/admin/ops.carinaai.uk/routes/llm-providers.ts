import { Router } from 'express';
import {
  carinaGet,
  carinaJson,
  carinaOpsTokenSet,
  carinaPost,
} from '../lib/carina.js';
import { hrefWithUiVersion } from '../lib/callback-url.js';

export const llmProvidersRouter = Router();

const uiVersion = process.env.UI_VERSION ?? '20260730f';

type LlmRotationStatus = {
  enabled?: boolean;
  providers?: string[];
  defaultProvider?: string;
  model?: string;
  configuredProviders?: string[];
  chain?: string[];
  knownProviders?: Array<{
    name: string;
    displayName: string;
    configured: boolean;
    model: string;
    models?: string[];
    local: boolean;
    inAllowlist: boolean;
  }>;
  modelsByProvider?: Record<string, string[]>;
  source?: string;
  note?: string;
  error?: string;
};

function pageRedirect(query: Record<string, string>): string {
  const params = new URLSearchParams(query);
  return hrefWithUiVersion(`/llm-providers?${params.toString()}`, uiVersion);
}

function emptyStatus(error?: string): LlmRotationStatus {
  return {
    enabled: true,
    providers: [],
    defaultProvider: '',
    model: '',
    configuredProviders: [],
    chain: [],
    knownProviders: [],
    modelsByProvider: {},
    source: 'none',
    note: '',
    error,
  };
}

async function fetchStatus(): Promise<LlmRotationStatus> {
  if (!carinaOpsTokenSet()) {
    return emptyStatus('Pair Carina in Settings first (CARINA_OPS_TOKEN).');
  }
  try {
    const response = await carinaGet('/api/ops/llm-rotation', 8000);
    const parsed = await carinaJson<LlmRotationStatus>(response);
    if (!parsed.ok || !parsed.data) {
      return emptyStatus(parsed.error ?? 'Failed to load LLM rotation status');
    }
    return parsed.data;
  } catch (err) {
    return emptyStatus(err instanceof Error ? err.message : String(err));
  }
}

llmProvidersRouter.get('/models', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!carinaOpsTokenSet()) {
    res.status(401).json({ error: 'Pair Carina in Settings first' });
    return;
  }
  const provider = String(req.query.provider ?? '').trim();
  if (!provider) {
    res.status(400).json({ error: 'provider is required' });
    return;
  }
  try {
    const response = await carinaGet(
      `/api/ops/llm-rotation/models?provider=${encodeURIComponent(provider)}`,
      15000,
    );
    const parsed = await carinaJson<{
      provider?: string;
      models?: string[];
      source?: string;
      configured?: boolean;
      currentModel?: string | null;
      error?: string;
    }>(response);
    if (!parsed.ok || !parsed.data) {
      res.status(502).json({ error: parsed.error ?? 'Failed to load models' });
      return;
    }
    res.json(parsed.data);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

llmProvidersRouter.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  const status = await fetchStatus();
  res.render('llm-providers', {
    title: 'LLM Providers',
    status,
    saved: req.query['saved'] === '1',
    errMsg: typeof req.query['err'] === 'string' ? req.query['err'] : '',
  });
});

llmProvidersRouter.post('/save', async (req, res) => {
  if (!carinaOpsTokenSet()) {
    res.redirect(pageRedirect({ err: 'Pair Carina in Settings first' }));
    return;
  }

  const body = req.body as Record<string, string | string[] | undefined>;
  const enabledRaw = body.enabled;
  const enabled = enabledRaw === '1' || enabledRaw === 'on' || enabledRaw === 'true';

  let providers: string[] = [];
  if (Array.isArray(body.providers)) {
    providers = body.providers.map(String);
  } else if (typeof body.providers === 'string' && body.providers.trim()) {
    providers = body.providers.split(/[,\s]+/).map((p) => p.trim()).filter(Boolean);
  }

  const payload = {
    enabled,
    providers,
    defaultProvider: String(body.defaultProvider ?? '').trim(),
    model: String(body.model ?? '').trim(),
  };

  try {
    const response = await carinaPost('/api/ops/llm-rotation', payload, 20000);
    const parsed = await carinaJson<{ ok?: boolean; error?: string }>(response);
    if (!parsed.ok) {
      res.redirect(pageRedirect({ err: (parsed.error ?? 'Save failed').slice(0, 180) }));
      return;
    }
    if (parsed.data && parsed.data.ok === false) {
      res.redirect(pageRedirect({ err: (parsed.data.error ?? 'Save failed').slice(0, 180) }));
      return;
    }
    res.redirect(pageRedirect({ saved: '1' }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect(pageRedirect({ err: msg.slice(0, 180) }));
  }
});
