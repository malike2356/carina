// INTERNAL_PROTOTYPE: VERLOX back-office only. Customer Carina Ops UI belongs on app.carinaai.uk.
// Do not add customer-facing routes here. See instructions/action-prompts/carina-ops/.
import { Router, type Request, type Response } from 'express';
import { carinaGet, carinaHeaders, carinaJson, carinaOpsTokenSet, CARINA_BASE } from '../lib/carina.js';
import {
  createAgent,
  createAsset,
  createDeployment,
  createEnvironment,
  createMemoryStore,
  createSession,
  createVaultItem,
  createWorkbenchRun,
  deleteAsset,
  deleteVaultItem,
  ensureAiPlatformSchema,
  estimateCost,
  estimateTokensFromText,
  getDefaultOrg,
  getModelById,
  getPlatformCounts,
  getSkillPackOverrides,
  getSpendThisMonth,
  getUsageByProviderModel,
  getUsageDailyRows,
  getUsageSummary,
  getWorkbenchRun,
  listAgents,
  listAssets,
  listDeployments,
  listEnvironments,
  listMemoryStores,
  listModels,
  listSessions,
  listVaultItems,
  listWorkbenchRuns,
  pingEnvironmentUrl,
  recordUsageDaily,
  toggleVaultItem,
  updateAgent,
  updateAsset,
  updateDeployment,
  updateEnvironment,
  updateMemoryStore,
  updateOrg,
  updateWorkbenchRun,
  upsertSkillPackOverride,
} from '../lib/ai-platform.js';

export const aiPlatformRouter = Router();

const PLATFORM_PAGES = [
  { href: '/ai-platform', label: 'Overview', exact: true },
  { href: '/ai-platform/workbench', label: 'Workbench' },
  { href: '/ai-platform/files', label: 'Files' },
  { href: '/ai-platform/skills', label: 'Skills' },
  { href: '/ai-platform/batches', label: 'Batches' },
  { href: '/ai-platform/agents', label: 'Agents' },
  { href: '/ai-platform/sessions', label: 'Sessions' },
  { href: '/ai-platform/deployments', label: 'Deployments' },
  { href: '/ai-platform/environments', label: 'Environments' },
  { href: '/ai-platform/vaults', label: 'Vaults' },
  { href: '/ai-platform/memory', label: 'Memory' },
  { href: '/ai-platform/analytics', label: 'Analytics' },
  { href: '/ai-platform/credits', label: 'Credits' },
];

async function withSchema<T>(fn: () => Promise<T>): Promise<T> {
  await ensureAiPlatformSchema();
  return fn();
}

function renderPage(
  res: Response,
  view: string,
  data: Record<string, unknown>,
): void {
  res.render(`ai-platform/${view}`, {
    platformNav: PLATFORM_PAGES,
    ...data,
  });
}

aiPlatformRouter.use(async (_req, _res, next) => {
  try {
    await ensureAiPlatformSchema();
    next();
  } catch (err) {
    next(err);
  }
});

aiPlatformRouter.get('/', async (_req, res) => {
  try {
    const [org, models, usage, counts, recentRuns, spendMonth] = await withSchema(() =>
      Promise.all([
        getDefaultOrg(),
        listModels(),
        getUsageSummary(30),
        getPlatformCounts(),
        listWorkbenchRuns(8),
        getSpendThisMonth(),
      ]),
    );
    renderPage(res, 'overview', {
      title: 'AI Platform',
      org,
      models,
      usage,
      counts,
      recentRuns,
      spendMonth,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

aiPlatformRouter.get('/workbench', async (req, res) => {
  const runId = typeof req.query.run === 'string' ? req.query.run : '';
  const saved = req.query.saved === '1';
  const [org, models, runs, selectedRun] = await withSchema(async () => {
    const o = await getDefaultOrg();
    const m = await listModels();
    const r = await listWorkbenchRuns(25);
    const sel = runId ? await getWorkbenchRun(runId) : null;
    return [o, m, r, sel] as const;
  });
  renderPage(res, 'workbench', {
    title: 'Workbench',
    org,
    models,
    runs,
    selectedRun,
    saved,
    autorun: req.query.autorun === '1',
    carinaApiUrl: process.env.CARINA_API_URL ?? 'http://localhost:3333',
  });
});

aiPlatformRouter.post('/workbench', async (req, res) => {
  const org = await getDefaultOrg();
  const modelId = String(req.body.modelId ?? '');
  const model = modelId ? await getModelById(modelId) : null;
  const provider = model?.provider ?? String(req.body.provider ?? 'anthropic');
  const modelName = model?.model ?? String(req.body.model ?? 'claude-sonnet-4-20250514');
  const prompt = String(req.body.prompt ?? '').trim();
  const title = String(req.body.title ?? '').trim();
  const action = String(req.body.action ?? 'draft');

  if (!prompt) {
    res.redirect('/ai-platform/workbench?err=' + encodeURIComponent('Prompt is required'));
    return;
  }

  const run = await createWorkbenchRun({
    orgId: org.id,
    title: title || prompt.slice(0, 60),
    prompt,
    provider,
    model: modelName,
    status: action === 'run' ? 'running' : 'draft',
  });

  if (action === 'run') {
    res.redirect(`/ai-platform/workbench?run=${run.id}&autorun=1`);
    return;
  }
  res.redirect('/ai-platform/workbench?saved=1');
});

aiPlatformRouter.post('/workbench/:id/complete', async (req, res) => {
  const run = await getWorkbenchRun(req.params.id);
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  const responseText = String(req.body.responseText ?? '');
  const tokensIn = Number(req.body.tokensIn) || estimateTokensFromText(run.prompt);
  const tokensOut = Number(req.body.tokensOut) || estimateTokensFromText(responseText);
  const model = await listModels().then((models) =>
    models.find((m) => m.provider === run.provider && m.model === run.model),
  );
  const costEstimate = model
    ? estimateCost(tokensIn, tokensOut, model.inputPrice, model.outputPrice)
    : 0;

  const org = await getDefaultOrg();
  const cacheHits = org.promptCachingEnabled ? Math.floor(tokensIn * 0.3) : 0;

  await updateWorkbenchRun(run.id, {
    status: 'completed',
    responseText,
    tokensIn,
    tokensOut,
    costEstimate,
  });

  await recordUsageDaily({
    provider: run.provider,
    model: run.model,
    requests: 1,
    tokensIn,
    tokensOut,
    cacheHits,
    estimatedCost: costEstimate,
  });

  res.json({ ok: true, costEstimate, tokensIn, tokensOut });
});

aiPlatformRouter.get('/stream', async (req: Request, res: Response) => {
  const message = String(req.query.message ?? '');
  const sessionId = String(req.query.sessionId ?? '');

  if (!message.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const url = new URL(`${CARINA_BASE}/api/chat/stream`);
  url.searchParams.set('message', message);
  if (sessionId) url.searchParams.set('sessionId', sessionId);

  try {
    const upstream = await fetch(url, { headers: carinaHeaders() });
    if (!upstream.ok || !upstream.body) {
      res.write(`data: ${JSON.stringify({ error: `Carina HTTP ${upstream.status}` })}\n\n`);
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    req.on('close', () => {
      reader.cancel().catch(() => {});
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } catch {
    res.write(`data: ${JSON.stringify({ error: 'Carina unreachable' })}\n\n`);
  }
  res.end();
});

aiPlatformRouter.get('/files', async (req, res) => {
  const saved = req.query.saved === '1';
  const files = await listAssets('file');
  renderPage(res, 'files', { title: 'Files', files, saved });
});

aiPlatformRouter.post('/files', async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  if (!name) {
    res.redirect('/ai-platform/files?err=' + encodeURIComponent('Name is required'));
    return;
  }
  const tags = String(req.body.tags ?? '').trim();
  await createAsset({
    kind: 'file',
    name,
    status: 'active',
    metadataJson: {
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      sizeBytes: 0,
      mimeType: String(req.body.mimeType ?? 'text/plain'),
    },
  });
  res.redirect('/ai-platform/files?saved=1');
});

aiPlatformRouter.post('/files/:id', async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const status = String(req.body.status ?? 'active');
  const tags = String(req.body.tags ?? '').trim();
  const files = await listAssets('file');
  const file = files.find((f) => f.id === req.params.id);
  if (!file) {
    res.redirect('/ai-platform/files');
    return;
  }
  await updateAsset(req.params.id, {
    name: name || file.name,
    status,
    metadataJson: {
      ...file.metadataJson,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : file.metadataJson.tags,
    },
  });
  res.redirect('/ai-platform/files?saved=1');
});

aiPlatformRouter.post('/files/:id/delete', async (req, res) => {
  await deleteAsset(req.params.id);
  res.redirect('/ai-platform/files?saved=1');
});

aiPlatformRouter.get('/skills', async (req, res) => {
  const saved = req.query.saved === '1';
  const err = typeof req.query.err === 'string' ? req.query.err : '';
  let available: Array<{ name: string; version: string; description: string; skillCount?: number }> = [];
  let paired = carinaOpsTokenSet();
  let loadError = '';

  if (paired) {
    const response = await carinaGet('/api/ops/skill-packs');
    const parsed = await carinaJson<{
      available: Array<{ name: string; version: string; description: string; skillCount?: number }>;
      active: string[];
    }>(response);
    if (parsed.ok && parsed.data) {
      available = parsed.data.available ?? [];
    } else {
      loadError = parsed.error ?? 'Could not load skill packs from Carina';
    }
  } else {
    loadError = 'Pair Carina in Settings before managing platform skills.';
  }

  const overrides = await getSkillPackOverrides();
  renderPage(res, 'skills', {
    title: 'Skills',
    available,
    overrides,
    paired,
    error: err || loadError,
    saved,
  });
});

aiPlatformRouter.post('/skills', async (req, res) => {
  const slug = String(req.body.slug ?? '').trim();
  const name = String(req.body.name ?? slug).trim();
  if (!slug) {
    res.redirect('/ai-platform/skills?err=' + encodeURIComponent('Skill pack slug required'));
    return;
  }
  await upsertSkillPackOverride(slug, name, {
    featured: req.body.featured === '1',
    enabled: req.body.enabled !== '0',
  });
  res.redirect('/ai-platform/skills?saved=1');
});

aiPlatformRouter.get('/batches', async (req, res) => {
  const saved = req.query.saved === '1';
  const org = await getDefaultOrg();
  const batches = await listAssets('batch');
  renderPage(res, 'batches', { title: 'Batches', batches, org, saved });
});

aiPlatformRouter.post('/batches', async (req, res) => {
  const org = await getDefaultOrg();
  if (!org.batchEnabled) {
    res.redirect('/ai-platform/batches?err=' + encodeURIComponent('Enable batch API in Credits first'));
    return;
  }
  const name = String(req.body.name ?? '').trim() || 'Batch job';
  const promptCount = Math.max(1, Number(req.body.promptCount) || 1);
  await createAsset({
    kind: 'batch',
    name,
    status: 'queued',
    metadataJson: {
      promptCount,
      completedCount: 0,
      status: 'queued',
      notes: String(req.body.notes ?? '').trim(),
    },
  });
  await recordUsageDaily({
    provider: 'platform',
    model: 'batch',
    batchJobs: 1,
  });
  res.redirect('/ai-platform/batches?saved=1');
});

aiPlatformRouter.post('/batches/:id/cancel', async (req, res) => {
  const batches = await listAssets('batch');
  const batch = batches.find((b) => b.id === req.params.id);
  if (batch) {
    await updateAsset(batch.id, {
      status: 'cancelled',
      metadataJson: { ...batch.metadataJson, status: 'cancelled' },
    });
  }
  res.redirect('/ai-platform/batches?saved=1');
});

aiPlatformRouter.get('/agents', async (req, res) => {
  const saved = req.query.saved === '1';
  const [agents, models] = await Promise.all([listAgents(), listModels()]);
  renderPage(res, 'agents', { title: 'Agents', agents, models, saved });
});

aiPlatformRouter.post('/agents', async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const modelId = String(req.body.modelId ?? '');
  const model = modelId ? await getModelById(modelId) : null;
  if (!name) {
    res.redirect('/ai-platform/agents?err=' + encodeURIComponent('Agent name required'));
    return;
  }
  await createAgent({
    name,
    provider: model?.provider ?? String(req.body.provider ?? 'anthropic'),
    model: model?.model ?? String(req.body.model ?? 'claude-sonnet-4-20250514'),
    status: 'idle',
  });
  res.redirect('/ai-platform/agents?saved=1');
});

aiPlatformRouter.post('/agents/:id/status', async (req, res) => {
  const status = String(req.body.status ?? 'idle');
  await updateAgent(req.params.id, { status });
  res.redirect('/ai-platform/agents?saved=1');
});

aiPlatformRouter.get('/sessions', async (req, res) => {
  const saved = req.query.saved === '1';
  const [sessions, agents] = await Promise.all([listSessions(), listAgents()]);
  renderPage(res, 'sessions', { title: 'Sessions', sessions, agents, saved });
});

aiPlatformRouter.post('/sessions', async (req, res) => {
  const title = String(req.body.title ?? '').trim();
  if (!title) {
    res.redirect('/ai-platform/sessions?err=' + encodeURIComponent('Session title required'));
    return;
  }
  await createSession({
    title,
    agentId: String(req.body.agentId ?? '') || undefined,
    summary: String(req.body.summary ?? '').trim() || undefined,
  });
  res.redirect('/ai-platform/sessions?saved=1');
});

aiPlatformRouter.get('/deployments', async (req, res) => {
  const saved = req.query.saved === '1';
  const [deployments, environments, models] = await Promise.all([
    listDeployments(),
    listEnvironments(),
    listModels(),
  ]);
  renderPage(res, 'deployments', {
    title: 'Deployments',
    deployments,
    environments,
    models,
    saved,
  });
});

aiPlatformRouter.post('/deployments', async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const modelId = String(req.body.modelId ?? '');
  const model = modelId ? await getModelById(modelId) : null;
  if (!name) {
    res.redirect('/ai-platform/deployments?err=' + encodeURIComponent('Deployment name required'));
    return;
  }
  await createDeployment({
    name,
    environmentId: String(req.body.environmentId ?? '') || undefined,
    provider: model?.provider ?? String(req.body.provider ?? 'anthropic'),
    model: model?.model ?? String(req.body.model ?? 'claude-sonnet-4-20250514'),
    version: String(req.body.version ?? '1.0.0'),
    status: String(req.body.status ?? 'pending'),
  });
  res.redirect('/ai-platform/deployments?saved=1');
});

aiPlatformRouter.post('/deployments/:id', async (req, res) => {
  await updateDeployment(req.params.id, {
    status: String(req.body.status ?? ''),
    version: String(req.body.version ?? '') || undefined,
    name: String(req.body.name ?? '') || undefined,
  });
  res.redirect('/ai-platform/deployments?saved=1');
});

aiPlatformRouter.get('/environments', async (req, res) => {
  const saved = req.query.saved === '1';
  const environments = await listEnvironments();
  const health: Record<string, 'ok' | 'fail' | 'skip'> = {};
  for (const env of environments) {
    health[env.id] = env.apiBaseUrl ? await pingEnvironmentUrl(env.apiBaseUrl) : 'skip';
  }
  renderPage(res, 'environments', { title: 'Environments', environments, health, saved });
});

aiPlatformRouter.post('/environments', async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  if (!name) {
    res.redirect('/ai-platform/environments?err=' + encodeURIComponent('Environment name required'));
    return;
  }
  await createEnvironment({
    name,
    apiBaseUrl: String(req.body.apiBaseUrl ?? '').trim() || undefined,
    notes: String(req.body.notes ?? '').trim() || undefined,
  });
  res.redirect('/ai-platform/environments?saved=1');
});

aiPlatformRouter.post('/environments/:id', async (req, res) => {
  await updateEnvironment(req.params.id, {
    name: String(req.body.name ?? '') || undefined,
    apiBaseUrl: String(req.body.apiBaseUrl ?? ''),
    notes: String(req.body.notes ?? ''),
    status: String(req.body.status ?? '') || undefined,
  });
  res.redirect('/ai-platform/environments?saved=1');
});

aiPlatformRouter.get('/vaults', async (req, res) => {
  const saved = req.query.saved === '1';
  const [items, environments] = await Promise.all([listVaultItems(), listEnvironments()]);
  renderPage(res, 'vaults', { title: 'Credential Vaults', items, environments, saved });
});

aiPlatformRouter.post('/vaults', async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const secret = String(req.body.secret ?? '').trim();
  if (!name || !secret) {
    res.redirect('/ai-platform/vaults?err=' + encodeURIComponent('Name and secret required'));
    return;
  }
  await createVaultItem({
    name,
    secret,
    provider: String(req.body.provider ?? 'anthropic'),
    environmentId: String(req.body.environmentId ?? '') || undefined,
  });
  res.redirect('/ai-platform/vaults?saved=1');
});

aiPlatformRouter.post('/vaults/:id/toggle', async (req, res) => {
  await toggleVaultItem(req.params.id, req.body.active === '1');
  res.redirect('/ai-platform/vaults?saved=1');
});

aiPlatformRouter.post('/vaults/:id/delete', async (req, res) => {
  await deleteVaultItem(req.params.id);
  res.redirect('/ai-platform/vaults?saved=1');
});

aiPlatformRouter.get('/memory', async (req, res) => {
  const saved = req.query.saved === '1';
  const stores = await listMemoryStores();
  renderPage(res, 'memory', { title: 'Memory Stores', stores, saved });
});

aiPlatformRouter.post('/memory', async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  if (!name) {
    res.redirect('/ai-platform/memory?err=' + encodeURIComponent('Store name required'));
    return;
  }
  await createMemoryStore({
    name,
    scope: String(req.body.scope ?? 'org'),
    notes: String(req.body.notes ?? '').trim() || undefined,
  });
  res.redirect('/ai-platform/memory?saved=1');
});

aiPlatformRouter.post('/memory/:id', async (req, res) => {
  await updateMemoryStore(req.params.id, {
    name: String(req.body.name ?? '') || undefined,
    scope: String(req.body.scope ?? '') || undefined,
    status: String(req.body.status ?? '') || undefined,
    notes: String(req.body.notes ?? ''),
  });
  res.redirect('/ai-platform/memory?saved=1');
});

aiPlatformRouter.get('/analytics', async (req, res) => {
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
  const [summary, byModel, daily] = await Promise.all([
    getUsageSummary(days),
    getUsageByProviderModel(days),
    getUsageDailyRows(days),
  ]);
  renderPage(res, 'analytics', {
    title: 'Analytics',
    summary,
    byModel,
    daily,
    days,
  });
});

aiPlatformRouter.get('/credits', async (req, res) => {
  const saved = req.query.saved === '1';
  const [org, spendMonth, usage] = await Promise.all([
    getDefaultOrg(),
    getSpendThisMonth(),
    getUsageSummary(30),
  ]);
  renderPage(res, 'credits', {
    title: 'Credits',
    org,
    spendMonth,
    usage,
    saved,
  });
});

aiPlatformRouter.post('/credits', async (req, res) => {
  const org = await getDefaultOrg();
  await updateOrg(org.id, {
    name: String(req.body.name ?? org.name),
    creditBalance: Number(req.body.creditBalance) || 0,
    monthlyLimit: Number(req.body.monthlyLimit) || org.monthlyLimit,
    autoReloadEnabled: req.body.autoReloadEnabled === '1',
    promptCachingEnabled: req.body.promptCachingEnabled === '1',
    batchEnabled: req.body.batchEnabled === '1',
  });
  res.redirect('/ai-platform/credits?saved=1');
});
