import { Router } from 'express';
import {
  carinaGet,
  carinaJson,
  carinaOpsTokenSet,
  carinaPost,
} from '../lib/carina.js';
import { hrefWithUiVersion } from '../lib/callback-url.js';

export const embeddingsRouter = Router();

const uiVersion = process.env.UI_VERSION ?? '20260719a';

type EmbeddingsStatus = {
  status?: {
    active?: string | null;
    configured?: string[];
    chain?: string[];
    dimensions?: number;
    override?: string | null;
  };
  providers?: Array<{
    name: string;
    displayName: string;
    configured: boolean;
    local: boolean;
    keySet: boolean;
    baseUrlSet: boolean;
    baseUrl: string;
    embeddingModel: string;
    enabledFlag?: boolean;
  }>;
  preferredProvider?: string;
  globalModel?: string;
  maxChars?: string;
  totalChunks?: number;
  embeddedChunks?: number;
  missingChunks?: number;
  source?: string;
  error?: string;
};

function embeddingsRedirect(query: Record<string, string>): string {
  const params = new URLSearchParams(query);
  return hrefWithUiVersion(`/embeddings?${params.toString()}`, uiVersion);
}

function emptyStatus(error?: string): EmbeddingsStatus {
  return {
    status: { active: null, configured: [], chain: [], dimensions: 768, override: null },
    providers: [],
    preferredProvider: '',
    globalModel: '',
    maxChars: '',
    totalChunks: 0,
    embeddedChunks: 0,
    missingChunks: 0,
    source: 'none',
    error,
  };
}

async function fetchStatus(): Promise<EmbeddingsStatus> {
  if (!carinaOpsTokenSet()) {
    return emptyStatus('Pair Carina in Settings first (CARINA_OPS_TOKEN).');
  }
  try {
    const response = await carinaGet('/api/ops/embeddings', 8000);
    const parsed = await carinaJson<EmbeddingsStatus>(response);
    if (!parsed.ok || !parsed.data) {
      return emptyStatus(parsed.error ?? 'Failed to load embedding status');
    }
    return parsed.data;
  } catch (err) {
    return emptyStatus(err instanceof Error ? err.message : String(err));
  }
}

embeddingsRouter.get('/', async (req, res) => {
  const status = await fetchStatus();
  res.render('embeddings', {
    title: 'Embeddings',
    status,
    saved: req.query['saved'] === '1',
    probed: req.query['probed'] === '1',
    backfilled: req.query['backfilled'] === '1',
    probeOk: req.query['probe_ok'] === '1',
    probeDims: typeof req.query['dims'] === 'string' ? req.query['dims'] : '',
    probeMs: typeof req.query['ms'] === 'string' ? req.query['ms'] : '',
    probeActive: typeof req.query['active'] === 'string' ? req.query['active'] : '',
    bfUpdated: typeof req.query['updated'] === 'string' ? req.query['updated'] : '',
    bfFailed: typeof req.query['failed'] === 'string' ? req.query['failed'] : '',
    bfRemaining: typeof req.query['remaining'] === 'string' ? req.query['remaining'] : '',
    errMsg: typeof req.query['err'] === 'string' ? req.query['err'] : '',
  });
});

embeddingsRouter.post('/save', async (req, res) => {
  if (!carinaOpsTokenSet()) {
    res.redirect(embeddingsRedirect({ err: 'Pair Carina in Settings first' }));
    return;
  }

  const body = req.body as Record<string, string | undefined>;
  const payload: Record<string, unknown> = {
    preferredProvider: String(body.preferredProvider ?? '').trim() || 'auto',
    embeddingModel: String(body.embeddingModel ?? '').trim(),
    maxChars: String(body.maxChars ?? '').trim(),
    ollamaBaseUrl: String(body.ollamaBaseUrl ?? '').trim(),
    ollamaEmbeddingModel: String(body.ollamaEmbeddingModel ?? '').trim(),
    openaiBaseUrl: String(body.openaiBaseUrl ?? '').trim(),
    ollamaEnabled: body.ollamaEnabled === '1' || body.ollamaEnabled === 'on',
  };

  const geminiApiKey = String(body.geminiApiKey ?? '').trim();
  const openaiApiKey = String(body.openaiApiKey ?? '').trim();
  const voyageApiKey = String(body.voyageApiKey ?? '').trim();
  const ollamaApiKey = String(body.ollamaApiKey ?? '').trim();
  if (geminiApiKey) payload.geminiApiKey = geminiApiKey;
  if (openaiApiKey) payload.openaiApiKey = openaiApiKey;
  if (voyageApiKey) payload.voyageApiKey = voyageApiKey;
  if (ollamaApiKey) payload.ollamaApiKey = ollamaApiKey;

  try {
    const response = await carinaPost('/api/ops/embeddings', payload, 20000);
    const parsed = await carinaJson<{ ok?: boolean; error?: string }>(response);
    if (!parsed.ok) {
      res.redirect(embeddingsRedirect({ err: (parsed.error ?? 'Save failed').slice(0, 180) }));
      return;
    }
    res.redirect(embeddingsRedirect({ saved: '1' }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect(embeddingsRedirect({ err: msg.slice(0, 180) }));
  }
});

embeddingsRouter.post('/probe', async (req, res) => {
  if (!carinaOpsTokenSet()) {
    res.redirect(embeddingsRedirect({ err: 'Pair Carina in Settings first' }));
    return;
  }
  try {
    const response = await carinaPost('/api/ops/embeddings/probe', {}, 60000);
    const parsed = await carinaJson<{
      ok?: boolean;
      dimensions?: number;
      ms?: number;
      active?: string | null;
      error?: string;
    }>(response);
    if (!parsed.data) {
      res.redirect(embeddingsRedirect({ err: parsed.error ?? 'Probe failed' }));
      return;
    }
    if (!parsed.data.ok) {
      res.redirect(embeddingsRedirect({
        probed: '1',
        probe_ok: '0',
        err: (parsed.data.error ?? 'Probe failed').slice(0, 180),
        active: String(parsed.data.active ?? ''),
      }));
      return;
    }
    res.redirect(embeddingsRedirect({
      probed: '1',
      probe_ok: '1',
      dims: String(parsed.data.dimensions ?? ''),
      ms: String(parsed.data.ms ?? ''),
      active: String(parsed.data.active ?? ''),
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect(embeddingsRedirect({ err: msg.slice(0, 180) }));
  }
});

embeddingsRouter.post('/backfill', async (req, res) => {
  if (!carinaOpsTokenSet()) {
    res.redirect(embeddingsRedirect({ err: 'Pair Carina in Settings first' }));
    return;
  }
  const limitRaw = String((req.body as { limit?: string })?.limit ?? '25').trim();
  const limit = Math.min(50, Math.max(1, parseInt(limitRaw, 10) || 25));
  try {
    const response = await carinaPost('/api/ops/embeddings/backfill', { limit }, 120000);
    const parsed = await carinaJson<{
      ok?: boolean;
      updated?: number;
      failed?: number;
      remaining?: number;
      error?: string;
    }>(response);
    if (!parsed.data) {
      res.redirect(embeddingsRedirect({ err: parsed.error ?? 'Backfill failed' }));
      return;
    }
    if (parsed.data.error && !parsed.data.updated) {
      res.redirect(embeddingsRedirect({ err: parsed.data.error.slice(0, 180) }));
      return;
    }
    res.redirect(embeddingsRedirect({
      backfilled: '1',
      updated: String(parsed.data.updated ?? 0),
      failed: String(parsed.data.failed ?? 0),
      remaining: String(parsed.data.remaining ?? 0),
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect(embeddingsRedirect({ err: msg.slice(0, 180) }));
  }
});
