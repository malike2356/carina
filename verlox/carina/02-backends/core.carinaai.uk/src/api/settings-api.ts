import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import {
  ALL_CONFIG_DOMAINS,
  findDomainByAlias,
  listDomainSummaries,
  getDomainRequiredFields,
  getAllSensitiveFieldKeys,
  type ConfigDomain,
} from '../config/settings-requirements.js';
import {
  readDomainSettings,
  saveDomainSettings,
  isDomainConfigured,
  deleteSetting,
} from '../config/settings-store.js';
import { reloadSettings } from '../config/settings-loader.js';
import { isInternalResearchAuthorized } from './internal-research-api.js';

export const settingsApiRouter: ExpressRouter = Router();

function guard(req: Request, res: Response): boolean {
  if (!isInternalResearchAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

function resolveWorkspaceId(req: Request): string | null {
  const h = req.headers['x-workspace-id'];
  return (Array.isArray(h) ? h[0] : h)?.trim() || null;
}

function resolveDomain(idOrAlias: string): ConfigDomain | null {
  return (
    ALL_CONFIG_DOMAINS.find((d) => d.id === idOrAlias) ??
    findDomainByAlias(idOrAlias) ??
    null
  );
}

function redactSensitive(
  values: Record<string, string>,
  sensitive: Set<string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    out[k] = sensitive.has(k) ? `[${v.length} chars]` : v;
  }
  return out;
}

// GET /api/internal/settings/overview
// Dashboard-safe summary grouped by category. No auth required beyond internal key.
// Must be registered before /:domainId so Express does not treat 'overview' as a param.
settingsApiRouter.get('/overview', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  const workspaceId = resolveWorkspaceId(req);

  const byCategory: Record<string, { id: string; name: string; configured: boolean }[]> = {};
  for (const domain of ALL_CONFIG_DOMAINS) {
    const configured = await isDomainConfigured(domain.id, workspaceId);
    const category = domain.id.split(':')[0] ?? 'other';
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push({ id: domain.id, name: domain.name, configured });
  }

  const categories = Object.entries(byCategory).map(([category, domains]) => ({
    category,
    total: domains.length,
    configured: domains.filter((d) => d.configured).length,
    domains,
  }));

  res.json({
    totalDomains: ALL_CONFIG_DOMAINS.length,
    configuredDomains: categories.reduce((sum, c) => sum + c.configured, 0),
    categories,
  });
});

// GET /api/internal/settings
// List all domains with configured status - never returns secrets.
settingsApiRouter.get('/', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  const workspaceId = resolveWorkspaceId(req);

  const domains = await Promise.all(
    listDomainSummaries().map(async ({ id, name, category, aliases }) => ({
      id,
      name,
      category,
      aliases,
      configured: await isDomainConfigured(id, workspaceId),
      requiresRestart: ALL_CONFIG_DOMAINS.find((d) => d.id === id)?.requiresRestart ?? false,
    })),
  );

  res.json({ domains });
});

// GET /api/internal/settings/:domainId
// Returns current values with sensitive fields redacted.
settingsApiRouter.get('/:domainId', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  const workspaceId = resolveWorkspaceId(req);
  const domain = resolveDomain(req.params.domainId as string);
  if (!domain) {
    res.status(404).json({ error: `Unknown domain: ${req.params.domainId}` });
    return;
  }

  const saved = await readDomainSettings(domain.id, workspaceId);
  const sensitive = getAllSensitiveFieldKeys();

  res.json({
    id: domain.id,
    name: domain.name,
    configured: Object.keys(saved).length > 0,
    requiresRestart: domain.requiresRestart ?? false,
    fields: domain.fields.map((f) => ({
      key: f.key,
      label: f.label,
      sensitive: f.sensitive,
      optional: f.optional,
      envVar: f.envVar,
      validValues: f.validValues,
      currentValue: f.sensitive
        ? saved[f.key] !== undefined ? '[set]' : '[not set]'
        : saved[f.key] ?? process.env[f.envVar ?? ''] ?? '[not set]',
    })),
    values: redactSensitive(saved, sensitive),
  });
});

// POST /api/internal/settings/:domainId
// Save settings for a domain. Applies to process.env immediately.
settingsApiRouter.post('/:domainId', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  const workspaceId = resolveWorkspaceId(req);
  const domain = resolveDomain(req.params.domainId as string);
  if (!domain) {
    res.status(404).json({ error: `Unknown domain: ${req.params.domainId}` });
    return;
  }

  const values = (req.body?.values ?? req.body ?? {}) as Record<string, string>;

  const missing = getDomainRequiredFields(domain.id)
    .filter((f) => !values[f.key]?.trim())
    .map((f) => f.key);

  if (missing.length > 0) {
    res.status(400).json({ error: 'Missing required fields', missing });
    return;
  }

  const result = await saveDomainSettings(domain, values, workspaceId);
  if (!result.ok) {
    res.status(500).json({ error: result.error ?? 'Failed to save settings' });
    return;
  }

  // Hot-reload so the running process picks up the new values
  await reloadSettings(workspaceId);

  // Signal live subsystems to reconnect if applicable
  await notifyLiveSubsystem(domain.id, values);

  res.json({
    ok: true,
    domainId: domain.id,
    name: domain.name,
    requiresRestart: domain.requiresRestart ?? false,
    message: domain.requiresRestart
      ? `${domain.name} saved. Restart Carina for full effect.`
      : `${domain.name} saved and active.`,
  });
});

// DELETE /api/internal/settings/:domainId
// Remove all settings for a domain.
settingsApiRouter.delete('/:domainId', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  const workspaceId = resolveWorkspaceId(req);
  const domain = resolveDomain(req.params.domainId as string);
  if (!domain) {
    res.status(404).json({ error: `Unknown domain: ${req.params.domainId}` });
    return;
  }

  for (const field of domain.fields) {
    await deleteSetting(field.key, workspaceId);
  }

  res.json({ ok: true, domainId: domain.id });
});

// POST /api/internal/settings/:domainId/test
// Test connectivity for a domain that supports it.
settingsApiRouter.post('/:domainId/test', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  const workspaceId = resolveWorkspaceId(req);
  const domain = resolveDomain(req.params.domainId as string);
  if (!domain) {
    res.status(404).json({ error: `Unknown domain: ${req.params.domainId}` });
    return;
  }

  const result = await testDomainConnection(domain, workspaceId);
  res.json({ domainId: domain.id, ...result });
});

// ─── Live subsystem notification ─────────────────────────────────────────────

async function notifyLiveSubsystem(
  domainId: string,
  values: Record<string, string>,
): Promise<void> {
  if (domainId === 'scout:endpoint' || domainId === 'scout:enabled') {
    // Start Scout listener only if the control plane is now active after the env update.
    // process.env was already updated by reloadSettings() before this call.
    try {
      const { isScoutControlPlaneActive, initScoutListener } = await import('../security/index.js');
      if (isScoutControlPlaneActive()) {
        initScoutListener();
      }
    } catch {
      // Scout optional - failure is acceptable
    }
  }

  // For provider keys: process.env is updated immediately in settings-store.ts and
  // propagated by reloadSettings(). The LLM router reads process.env on each call
  // so no explicit signal is needed here.
  void values;
}

// ─── Domain connection tests ──────────────────────────────────────────────────

async function testDomainConnection(
  domain: ConfigDomain,
  workspaceId: string | null,
): Promise<{ success: boolean; message: string }> {
  const saved = await readDomainSettings(domain.id, workspaceId);

  const get = (key: string) =>
    saved[key] || process.env[domain.fields.find((f) => f.key === key)?.envVar ?? ''] || '';

  switch (domain.id) {
    case 'provider:openai':
      return testOpenAi(get('OPENAI_API_KEY'));

    case 'provider:anthropic':
      return testAnthropic(get('ANTHROPIC_API_KEY'));

    case 'provider:deepseek':
      return testDeepSeek(get('DEEPSEEK_API_KEY'));

    case 'provider:gemini':
      return testGemini(get('GEMINI_API_KEY'));

    case 'provider:groq':
      return testGroq(get('GROQ_API_KEY'));

    case 'provider:ollama':
      return testOllama(get('OLLAMA_BASE_URL'));

    case 'provider:tavily':
      return testTavily(get('TAVILY_API_KEY'));

    case 'provider:mistral':
      return testMistral(get('MISTRAL_API_KEY'));

    case 'integration:n8n':
      return testN8n(get('N8N_WEBHOOK_URL'));

    case 'integration:trello':
      return testTrello(get('TRELLO_API_KEY'), get('TRELLO_TOKEN'));

    case 'integration:caldav':
      return testCalDav(get('CALDAV_URL'), get('CALDAV_USERNAME'), get('CALDAV_PASSWORD'));

    case 'integration:resend':
      return testResend(get('RESEND_API_KEY'));

    case 'scout:endpoint':
      return testScout(get('SCOUT_URL'), get('SCOUT_API_KEY'));

    case 'search:searxng':
      return testSearXng(get('SEARXNG_URL'));

    default:
      return {
        success: true,
        message: `${domain.name} is configured. No live connectivity test available for this domain.`,
      };
  }
}

// ─── Individual provider tests ────────────────────────────────────────────────

async function testOpenAi(key: string): Promise<{ success: boolean; message: string }> {
  if (!key) return { success: false, message: 'No OpenAI API key configured.' };
  try {
    const r = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    return r.ok
      ? { success: true, message: 'OpenAI API key is valid.' }
      : { success: false, message: 'OpenAI rejected the key. Check it at platform.openai.com.' };
  } catch {
    return { success: false, message: 'Could not reach OpenAI API.' };
  }
}

async function testAnthropic(key: string): Promise<{ success: boolean; message: string }> {
  if (!key) return { success: false, message: 'No Anthropic API key configured.' };
  try {
    const r = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(8000),
    });
    return r.ok
      ? { success: true, message: 'Anthropic API key is valid.' }
      : { success: false, message: 'Anthropic rejected the key. Check it at console.anthropic.com.' };
  } catch {
    return { success: false, message: 'Could not reach Anthropic API.' };
  }
}

async function testDeepSeek(key: string): Promise<{ success: boolean; message: string }> {
  if (!key) return { success: false, message: 'No DeepSeek API key configured.' };
  try {
    const r = await fetch('https://api.deepseek.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    return r.ok
      ? { success: true, message: 'DeepSeek API key is valid.' }
      : { success: false, message: 'DeepSeek rejected the key.' };
  } catch {
    return { success: false, message: 'Could not reach DeepSeek API.' };
  }
}

async function testGemini(key: string): Promise<{ success: boolean; message: string }> {
  if (!key) return { success: false, message: 'No Gemini API key configured.' };
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return r.ok
      ? { success: true, message: 'Gemini API key is valid.' }
      : { success: false, message: 'Gemini rejected the key. Check it at aistudio.google.com.' };
  } catch {
    return { success: false, message: 'Could not reach Gemini API.' };
  }
}

async function testGroq(key: string): Promise<{ success: boolean; message: string }> {
  if (!key) return { success: false, message: 'No Groq API key configured.' };
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    return r.ok
      ? { success: true, message: 'Groq API key is valid.' }
      : { success: false, message: 'Groq rejected the key.' };
  } catch {
    return { success: false, message: 'Could not reach Groq API.' };
  }
}

async function testOllama(baseUrl: string): Promise<{ success: boolean; message: string }> {
  if (!baseUrl) return { success: false, message: 'No Ollama URL configured.' };
  try {
    const url = baseUrl.replace(/\/$/, '') + '/api/tags';
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (r.ok) {
      const data = (await r.json()) as { models?: unknown[] };
      const count = data?.models?.length ?? 0;
      return { success: true, message: `Ollama is reachable. ${count} model(s) available.` };
    }
    return { success: false, message: `Ollama at ${baseUrl} returned HTTP ${r.status}.` };
  } catch {
    return { success: false, message: `Could not reach Ollama at ${baseUrl}. Is it running?` };
  }
}

async function testMistral(key: string): Promise<{ success: boolean; message: string }> {
  if (!key) return { success: false, message: 'No Mistral API key configured.' };
  try {
    const r = await fetch('https://api.mistral.ai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    return r.ok
      ? { success: true, message: 'Mistral API key is valid.' }
      : { success: false, message: 'Mistral rejected the key.' };
  } catch {
    return { success: false, message: 'Could not reach Mistral API.' };
  }
}

async function testTavily(key: string): Promise<{ success: boolean; message: string }> {
  if (!key) return { success: false, message: 'No Tavily API key configured.' };
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query: 'test', max_results: 1 }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok || r.status === 400
      ? { success: true, message: 'Tavily API key is valid.' }
      : { success: false, message: 'Tavily rejected the key.' };
  } catch {
    return { success: false, message: 'Could not reach Tavily API.' };
  }
}

async function testN8n(baseUrl: string): Promise<{ success: boolean; message: string }> {
  if (!baseUrl) return { success: false, message: 'No n8n URL configured.' };
  try {
    const url = baseUrl.replace(/\/$/, '') + '/healthz';
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    return r.ok
      ? { success: true, message: `n8n at ${baseUrl} is reachable.` }
      : { success: false, message: `n8n at ${baseUrl} returned HTTP ${r.status}.` };
  } catch {
    return { success: false, message: `Could not reach n8n at ${baseUrl}. Is it running?` };
  }
}

async function testTrello(apiKey: string, token: string): Promise<{ success: boolean; message: string }> {
  if (!apiKey || !token) return { success: false, message: 'Trello API key and token are both required.' };
  try {
    const url = `https://api.trello.com/1/members/me?key=${apiKey}&token=${token}&fields=fullName`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const data = (await r.json()) as { fullName?: string };
      return { success: true, message: `Trello connected as ${data.fullName ?? 'a member'}.` };
    }
    return { success: false, message: 'Trello rejected the credentials. Check key and token.' };
  } catch {
    return { success: false, message: 'Could not reach Trello API.' };
  }
}

async function testCalDav(
  url: string,
  username: string,
  password: string,
): Promise<{ success: boolean; message: string }> {
  if (!url) return { success: false, message: 'No CalDAV URL configured.' };
  try {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    const r = await fetch(url, {
      method: 'OPTIONS',
      headers: { Authorization: `Basic ${credentials}` },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok || r.status === 401) {
      return r.status === 401
        ? { success: false, message: 'CalDAV server reachable but credentials were rejected.' }
        : { success: true, message: `CalDAV server at ${url} is reachable and accepts credentials.` };
    }
    return { success: false, message: `CalDAV at ${url} returned HTTP ${r.status}.` };
  } catch {
    return { success: false, message: `Could not reach CalDAV at ${url}.` };
  }
}

async function testResend(key: string): Promise<{ success: boolean; message: string }> {
  if (!key) return { success: false, message: 'No Resend API key configured.' };
  try {
    const r = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    return r.ok
      ? { success: true, message: 'Resend API key is valid.' }
      : { success: false, message: 'Resend rejected the key.' };
  } catch {
    return { success: false, message: 'Could not reach Resend API.' };
  }
}

async function testScout(url: string, apiKey: string): Promise<{ success: boolean; message: string }> {
  if (!url) return { success: false, message: 'No Scout URL configured.' };
  try {
    const pingUrl = url.replace(/\/$/, '') + '/api/ping';
    const headers: Record<string, string> = {};
    if (apiKey) headers['x-scout-key'] = apiKey;
    const r = await fetch(pingUrl, { headers, signal: AbortSignal.timeout(8000) });
    return r.ok
      ? { success: true, message: `Scout at ${url} is reachable.` }
      : { success: false, message: `Scout at ${url} returned HTTP ${r.status}.` };
  } catch {
    return { success: false, message: `Could not reach Scout at ${url}.` };
  }
}

async function testSearXng(url: string): Promise<{ success: boolean; message: string }> {
  if (!url) return { success: false, message: 'No SearXNG URL configured.' };
  try {
    const pingUrl = url.replace(/\/$/, '') + '/healthz';
    const r = await fetch(pingUrl, { signal: AbortSignal.timeout(6000) });
    return r.ok
      ? { success: true, message: `SearXNG at ${url} is reachable.` }
      : { success: false, message: `SearXNG at ${url} returned HTTP ${r.status}.` };
  } catch {
    return { success: false, message: `Could not reach SearXNG at ${url}.` };
  }
}
