import { Router } from 'express';
import type { Request, Response } from 'express';
import { carinaGet, carinaPost, carinaJson } from '../lib/carina.js';

export const mutationRouter = Router();

async function coreGet(path: string): Promise<unknown | null> {
  try {
    const res = await carinaGet(path);
    const parsed = await carinaJson<unknown>(res);
    return parsed.ok ? parsed.data : null;
  } catch {
    return null;
  }
}

async function corePost(path: string, body?: unknown): Promise<unknown> {
  const res = await carinaPost(path, body ?? {});
  const parsed = await carinaJson<unknown>(res);
  if (!parsed.ok) {
    throw new Error(parsed.error ?? `Core API POST ${path} returned ${parsed.status}`);
  }
  return parsed.data;
}

function settled<T>(result: PromiseSettledResult<T>, key?: string): T | null {
  if (result.status === 'fulfilled') {
    const v = result.value;
    if (key && v && typeof v === 'object') {
      return ((v as Record<string, unknown>)[key] ?? v) as T;
    }
    return v;
  }
  return null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function indexDefaults(error: string | null = null) {
  return {
    title: 'Mutation Engine',
    compounding: null,
    toolStats: null,
    gapProposals: [] as unknown[],
    staged: [] as unknown[],
    extensions: [] as unknown[],
    pendingTools: [] as unknown[],
    error,
    autoSynthesisEnabled: process.env.CARINA_AUTO_SYNTHESIS === 'true',
    extensionsEnabled: process.env.CARINA_MUTATION_EXTENSIONS === 'true',
  };
}

mutationRouter.get('/', async (req: Request, res: Response) => {
  try {
    const [compounding, toolStats, gapData, stagedData, extensionsData, runtimeData] = await Promise.allSettled([
      coreGet('/api/mutation/compounding'),
      coreGet('/api/carina-ops/tools/runtime/stats'),
      coreGet('/api/mutation/gaps?status=pending&limit=10'),
      coreGet('/api/mutation/prompts/staged'),
      coreGet('/api/mutation/extensions?status=staged'),
      coreGet('/api/carina-ops/tools/runtime'),
    ]);

    const gapProposals = asArray(settled(gapData, 'proposals'));
    const staged = asArray(settled(stagedData, 'staged'));
    const extensions = asArray(settled(extensionsData, 'extensions'));
    const runtime = settled(runtimeData) as { tools?: Array<{ status?: string }> } | null;
    const pendingTools = (runtime?.tools ?? []).filter((t) => t.status === 'pending');

    res.render('mutation/index', {
      ...indexDefaults(typeof req.query.error === 'string' ? req.query.error : null),
      compounding: settled(compounding),
      toolStats: settled(toolStats),
      gapProposals,
      staged,
      extensions,
      pendingTools,
    });
  } catch (err) {
    res.render('mutation/index', indexDefaults(String(err)));
  }
});

mutationRouter.get('/tools', async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const error = typeof req.query.error === 'string' ? req.query.error : null;
  try {
    const data = await coreGet('/api/carina-ops/tools/runtime') as { tools?: unknown[]; stats?: unknown } | null;
    let tools = asArray(data?.tools);
    if (status && status !== 'all') {
      tools = tools.filter((t) => (t as { status?: string }).status === status);
    }
    res.render('mutation/tools', {
      title: 'Generated Tools',
      tools,
      stats: data?.stats ?? null,
      activeFilter: status ?? 'all',
      error,
    });
  } catch (err) {
    res.render('mutation/tools', {
      title: 'Generated Tools',
      tools: [],
      stats: null,
      activeFilter: status ?? 'all',
      error: String(err),
    });
  }
});

mutationRouter.get('/tools/:id', async (req: Request, res: Response) => {
  try {
    const id = encodeURIComponent(req.params.id);
    const [tool, quality] = await Promise.all([
      coreGet(`/api/carina-ops/tools/runtime/${id}`),
      coreGet(`/api/carina-ops/tools/runtime/${id}/quality`),
    ]);
    if (!tool) {
      res.redirect('/mutation/tools');
      return;
    }
    const qualityData = quality as { samples?: unknown[] } | null;
    res.render('mutation/tool-detail', {
      title: 'Tool Detail',
      tool,
      qualitySamples: asArray(qualityData?.samples),
    });
  } catch {
    res.redirect('/mutation/tools');
  }
});

mutationRouter.post('/tools/:id/approve', async (req: Request, res: Response) => {
  try {
    await corePost(`/api/carina-ops/tools/runtime/${encodeURIComponent(req.params.id)}/approve`);
    res.redirect('/mutation/tools');
  } catch (err) {
    res.redirect(`/mutation/tools?error=${encodeURIComponent(String(err))}`);
  }
});

mutationRouter.post('/tools/:id/disable', async (req: Request, res: Response) => {
  try {
    await corePost(`/api/carina-ops/tools/runtime/${encodeURIComponent(req.params.id)}/disable`);
    res.redirect('/mutation/tools');
  } catch (err) {
    res.redirect(`/mutation/tools?error=${encodeURIComponent(String(err))}`);
  }
});

mutationRouter.post('/tools/:id/reinstate', async (req: Request, res: Response) => {
  try {
    await corePost(`/api/carina-ops/tools/runtime/${encodeURIComponent(req.params.id)}/reinstate`);
    res.redirect('/mutation/tools');
  } catch (err) {
    res.redirect(`/mutation/tools?error=${encodeURIComponent(String(err))}`);
  }
});

mutationRouter.get('/prompts', async (req: Request, res: Response) => {
  const error = typeof req.query.error === 'string' ? req.query.error : null;
  try {
    const [history, staged] = await Promise.all([
      coreGet('/api/mutation/prompts/history?limit=20'),
      coreGet('/api/mutation/prompts/staged'),
    ]);
    res.render('mutation/prompts', {
      title: 'Prompt Overrides',
      history: asArray((history as { history?: unknown[] } | null)?.history),
      staged: asArray((staged as { staged?: unknown[] } | null)?.staged),
      error,
    });
  } catch (err) {
    res.render('mutation/prompts', {
      title: 'Prompt Overrides',
      history: [],
      staged: [],
      error: String(err),
    });
  }
});

mutationRouter.post('/prompts/:id/activate', async (req: Request, res: Response) => {
  try {
    await corePost(`/api/mutation/prompts/${encodeURIComponent(req.params.id)}/activate`);
    res.redirect('/mutation/prompts');
  } catch (err) {
    res.redirect(`/mutation/prompts?error=${encodeURIComponent(String(err))}`);
  }
});

mutationRouter.post('/prompts/rollback', async (_req: Request, res: Response) => {
  try {
    await corePost('/api/mutation/prompts/rollback');
    res.redirect('/mutation/prompts');
  } catch (err) {
    res.redirect(`/mutation/prompts?error=${encodeURIComponent(String(err))}`);
  }
});

mutationRouter.get('/gaps', async (req: Request, res: Response) => {
  const error = typeof req.query.error === 'string' ? req.query.error : null;
  try {
    const data = await coreGet('/api/mutation/gaps?limit=50') as { proposals?: unknown[] } | null;
    res.render('mutation/gaps', {
      title: 'Tool Gaps',
      proposals: asArray(data?.proposals),
      error,
      autoSynthesisEnabled: process.env.CARINA_AUTO_SYNTHESIS === 'true',
    });
  } catch (err) {
    res.render('mutation/gaps', {
      title: 'Tool Gaps',
      proposals: [],
      error: String(err),
      autoSynthesisEnabled: process.env.CARINA_AUTO_SYNTHESIS === 'true',
    });
  }
});

mutationRouter.post('/gaps/:id/dismiss', async (req: Request, res: Response) => {
  try {
    await corePost(`/api/mutation/gaps/${encodeURIComponent(req.params.id)}/dismiss`);
    res.redirect('/mutation/gaps');
  } catch (err) {
    res.redirect(`/mutation/gaps?error=${encodeURIComponent(String(err))}`);
  }
});

mutationRouter.get('/extensions', async (req: Request, res: Response) => {
  const error = typeof req.query.error === 'string' ? req.query.error : null;
  try {
    const data = await coreGet('/api/mutation/extensions') as { extensions?: unknown[] } | null;
    res.render('mutation/extensions', {
      title: 'TS Extensions',
      extensions: asArray(data?.extensions),
      error,
      extensionsEnabled: process.env.CARINA_MUTATION_EXTENSIONS === 'true',
    });
  } catch (err) {
    res.render('mutation/extensions', {
      title: 'TS Extensions',
      extensions: [],
      error: String(err),
      extensionsEnabled: process.env.CARINA_MUTATION_EXTENSIONS === 'true',
    });
  }
});

mutationRouter.post('/extensions/:id/approve', async (req: Request, res: Response) => {
  try {
    await corePost(`/api/mutation/extensions/${encodeURIComponent(req.params.id)}/approve`);
    res.redirect('/mutation/extensions');
  } catch (err) {
    res.redirect(`/mutation/extensions?error=${encodeURIComponent(String(err))}`);
  }
});

mutationRouter.post('/extensions/:id/reject', async (req: Request, res: Response) => {
  try {
    await corePost(`/api/mutation/extensions/${encodeURIComponent(req.params.id)}/reject`);
    res.redirect('/mutation/extensions');
  } catch (err) {
    res.redirect(`/mutation/extensions?error=${encodeURIComponent(String(err))}`);
  }
});

mutationRouter.post('/prune', async (req: Request, res: Response) => {
  const dryRun = req.body.dry_run === 'true';
  try {
    const report = await corePost(dryRun ? '/api/mutation/prune/dry-run' : '/api/mutation/prune');
    res.render('mutation/prune-result', { title: 'Prune Results', report, dryRun });
  } catch (err) {
    res.redirect(`/mutation?error=${encodeURIComponent(String(err))}`);
  }
});
