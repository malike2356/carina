import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { Readable } from 'stream';
import { indexOpsCodebase, ragQuery, getIndexStats, search } from '../lib/ops-rag.js';
import { getAiProductLlm, resolveOpsAssistantEndpoint } from '../lib/ai-product-llms.js';

export const opsAssistantRouter = Router();

// ---------------------------------------------------------------------------
// Dynamic knowledge builder - scans layout nav and route files at startup
// ---------------------------------------------------------------------------

const __moduleDir = path.dirname(new URL(import.meta.url).pathname);
const opsRoot = path.basename(__moduleDir) === 'routes'
  ? path.dirname(__moduleDir)
  : path.dirname(path.dirname(__moduleDir));

function extractNavLinks(): string {
  const layoutPath = path.join(opsRoot, 'views', 'layout.ejs');
  try {
    const content = fs.readFileSync(layoutPath, 'utf-8');
    const links: string[] = [];
    const linkRe = /href="[^"]*\('([^']+)'\)[^"]*"[^>]*class="nav-link[^"]*"[^>]*>([^<]+)</g;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(content)) !== null) {
      links.push(`  ${m[1]} - ${m[2].trim()}`);
    }
    const hrefRe = /href="<%=\s*withV\('([^']+)'\)\s*%>"[^>]*class="nav-link[^"]*">([^<]+)/g;
    while ((m = hrefRe.exec(content)) !== null) {
      if (!links.some((l) => l.includes(m![1]))) {
        links.push(`  ${m[1]} - ${m[2].trim()}`);
      }
    }
    const groupRe = /<summary>([^<]+)<\/summary>/g;
    const groups: string[] = [];
    while ((m = groupRe.exec(content)) !== null) {
      groups.push(m[1].trim());
    }
    let output = 'SIDEBAR NAVIGATION GROUPS: ' + groups.join(', ') + '\n\n';
    output += 'ALL NAV LINKS (path - label):\n' + links.join('\n');
    return output;
  } catch {
    return '(Could not read layout.ejs for nav extraction)';
  }
}

function extractRouteInfo(): string {
  const routesDir = path.join(opsRoot, 'dist', 'routes');
  const altRoutesDir = path.join(opsRoot, 'routes');
  const dir = fs.existsSync(routesDir) ? routesDir : altRoutesDir;
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js') || f.endsWith('.ts'));
    const routeNames = files
      .map((f) => f.replace(/\.(js|ts)$/, ''))
      .filter((f) => !f.endsWith('.test') && !f.endsWith('.map'));
    return 'REGISTERED ROUTE MODULES (' + routeNames.length + '):\n' +
      routeNames.map((r) => '  ' + r).join('\n');
  } catch {
    return '(Could not scan routes directory)';
  }
}

function extractViewInfo(): string {
  const viewsDir = path.join(opsRoot, 'views');
  try {
    const items: string[] = [];
    const entries = fs.readdirSync(viewsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subFiles = fs.readdirSync(path.join(viewsDir, entry.name));
        items.push(`  ${entry.name}/ (${subFiles.length} views: ${subFiles.slice(0, 5).join(', ')}${subFiles.length > 5 ? '...' : ''})`);
      } else if (entry.name.endsWith('.ejs')) {
        items.push(`  ${entry.name}`);
      }
    }
    return 'VIEW TEMPLATES:\n' + items.join('\n');
  } catch {
    return '(Could not scan views directory)';
  }
}

function extractEnvConfig(): string {
  const envPath = path.join(opsRoot, '.env');
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    const keys = content
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'))
      .map((l) => l.split('=')[0]?.trim())
      .filter(Boolean);
    return 'ENVIRONMENT VARIABLES CONFIGURED (' + keys.length + '):\n' +
      keys.map((k) => '  ' + k).join('\n') +
      '\n(Values hidden for security)';
  } catch {
    return '(Could not read .env)';
  }
}

const STATIC_KNOWLEDGE = `You are the Carina Ops Assistant, an internal coach built into the VERLOX Ops panel (ops.carinaai.uk). You help operators understand pages, features, configuration, and architecture.

ARCHITECTURE:
- ops.carinaai.uk is an Express.js + EJS server (TypeScript, compiled to dist/).
- Communicates with core.carinaai.uk (Carina agent backend) via authenticated API calls.
- Communicates with console.labyrinthscout.com (Scout engine) for security telemetry.
- Authentication: session-based login with roles (admin, superadmin).
- Frontend: server-rendered EJS with inline CSS/JS per page.
- Database: PostgreSQL via shared query helper.
- Deployment: Docker container on VPS. Container name: corecarinaaiuk-carina-ops-1.

KEY CONCEPTS:
- Aiva: AI employees hired by users. Each workspace has multiple Aivas with roles/personas.
- Scout: Labyrinth Scout - security monitoring, threat detection, kill switch, honeypots.
- BYOK: Bring Your Own Key. Users can optionally use their own AI API keys. Default is Verlox-managed AI.
- Billing Config: Controls trial credits, daily caps, soft walls, subscription price IDs, prepaid top-ups.
- Human Assist Bridge: Routes Aiva escalation requests to the VA inbox at verlox.uk/mis.
- Channel Shield: Security rules that filter/block channel messages.
- MIS: Management Information System at verlox.uk.
- Tenants: Customer workspaces. Each tenant has Aivas, channels, billing, usage.
- Control Center: Central hub proxying subsystem status from the Carina core API.
- Kill Switch: Emergency halt of all agent instances (security measure).
- Mutation Engine: Self-modification system where agents can propose new tools.
- Standing Orders: Persistent instructions that apply to all agent interactions.
- MCP Servers: Model Context Protocol servers for extending agent capabilities.
- AI Platform: Unified model management, credits, pricing, workbench, deployments.
- Governance: SOC2 compliance, blockchain trust attestation, security posture.

IMPORTANT PAGES:
- Dashboard (/): Platform health overview, uptime, event counts.
- Control Center (/control-center): Central hub with tabs for each subsystem.
- Scout (/scout): Live threat telemetry, instance kill/resume, SSE event stream.
- All Tenants (/tenants): List workspaces. Click for detail with usage tab.
- AI Usage (/ai-usage): Provider cost breakdown, BYOK separation, margin health.
- Billing Config (/billing-config): Trial limits, daily caps, soft walls, price IDs.
- Agent Tools (/admin/agent-tools): Tool category config (enable/disable, max calls, timeout, approval).
- Google OAuth (/google-oauth): load/rotate company Verlox platform Google client (not customer BYOK).
- Human Assist Bridge (/human-assist-bridge): MIS bridge config (token, mode, URL).
- Server (/server): VPS management - file browser, services, logs.
- Settings (/settings): Ops panel config, pairing tokens, env vars.

BEHAVIORAL RULES:
- Be concise and direct. Use short paragraphs.
- ALWAYS ground answers about "this page" in CURRENT PAGE CONTEXT and VIEW TEMPLATE GROUNDING when present. Those blocks are the source of truth for what the operator can see right now.
- Do not invent buttons, fields, tables, empty states, or workflows that are not listed in the current page context or view template.
- If the page shows an empty state (for example "No files registered"), say that clearly.
- Distinguish AI Platform Files (/ai-platform/files) from Server File Browser (/server/files). They are different pages.
- Reference specific pages and paths when relevant.
- Explain what fields do and recommend sensible values when asked about config.
- Never use markdown formatting (no asterisks, hashes, backticks). Use plain text.
- Use numbered lists or ALL-CAPS labels for structure.
- Never reveal API keys, tokens, or secrets.
- If you do not know something specific, say so honestly.`;

let dynamicKnowledge: string | null = null;

function readKnowledgeFile(): string {
  const knowledgePath = path.join(opsRoot, 'OPS-KNOWLEDGE.md');
  try {
    return fs.readFileSync(knowledgePath, 'utf-8');
  } catch {
    return '';
  }
}

function buildDynamicKnowledge(): string {
  if (dynamicKnowledge) return dynamicKnowledge;
  const nav = extractNavLinks();
  const routes = extractRouteInfo();
  const views = extractViewInfo();
  const env = extractEnvConfig();
  dynamicKnowledge = [
    STATIC_KNOWLEDGE,
    '',
    '--- LIVE SYSTEM SCAN (auto-generated at startup) ---',
    '',
    nav,
    '',
    routes,
    '',
    views,
    '',
    env,
  ].join('\n');
  return dynamicKnowledge;
}

function getFullKnowledge(): string {
  const base = buildDynamicKnowledge();
  const knowledgeFile = readKnowledgeFile();
  if (!knowledgeFile) return base;
  return base + '\n\n--- KNOWLEDGE BASE (OPS-KNOWLEDGE.md, read live) ---\n\n' + knowledgeFile;
}

type ClientPageContext = {
  pathname?: string;
  search?: string;
  title?: string;
  heading?: string;
  subtitle?: string;
  headings?: string[];
  formFields?: string[];
  buttons?: string[];
  emptyStates?: string[];
  visibleText?: string;
};

function stripEjsAndHtml(source: string): string {
  return source
    .replace(/<%[\s\S]*?%>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?(?:br|p|div|li|h[1-6]|tr|td|th|label|button|option)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function resolveViewRelativePath(pathname: string): string | null {
  const clean = (pathname || '/').replace(/\/+$/, '') || '/';
  const candidates: string[] = [];
  if (clean === '/ai-platform') candidates.push('ai-platform/overview.ejs');
  if (clean.startsWith('/ai-platform/')) {
    const segment = clean.slice('/ai-platform/'.length).split('/')[0];
    if (segment) candidates.push(`ai-platform/${segment}.ejs`);
  }
  if (clean === '/') candidates.push('dashboard.ejs', 'index.ejs');
  const trimmed = clean.replace(/^\//, '');
  if (trimmed) {
    candidates.push(`${trimmed}.ejs`);
    const parts = trimmed.split('/');
    if (parts.length >= 2) candidates.push(`${parts[0]}/${parts[1]}.ejs`);
  }
  for (const rel of candidates) {
    if (fs.existsSync(path.join(opsRoot, 'views', rel))) return rel;
  }
  return null;
}

function loadViewGrounding(pathname: string): string {
  const rel = resolveViewRelativePath(pathname);
  if (!rel) return '';
  try {
    const raw = fs.readFileSync(path.join(opsRoot, 'views', rel), 'utf-8');
    const text = stripEjsAndHtml(raw).slice(0, 3500);
    if (!text) return '';
    return [
      'VIEW TEMPLATE GROUNDING (from server-rendered EJS for this route):',
      `View file: views/${rel}`,
      text,
    ].join('\n');
  } catch {
    return '';
  }
}

function buildCurrentPageBlock(currentPage: string | undefined, pageContext?: ClientPageContext): string {
  const pathname = String(pageContext?.pathname || currentPage || '').trim();
  if (!pathname && !pageContext) return '';

  const lines: string[] = [
    'CURRENT PAGE CONTEXT (live from the operator browser; this is the source of truth for "this page"):',
    `Path: ${pathname || '(unknown)'}`,
  ];
  if (pageContext?.search) lines.push(`Query: ${pageContext.search}`);
  if (pageContext?.title) lines.push(`Document title: ${pageContext.title}`);
  if (pageContext?.heading) lines.push(`Primary heading: ${pageContext.heading}`);
  if (pageContext?.subtitle) lines.push(`Subtitle: ${pageContext.subtitle}`);
  if (pageContext?.headings?.length) lines.push(`Section headings: ${pageContext.headings.join(' | ')}`);
  if (pageContext?.formFields?.length) lines.push(`Visible form fields: ${pageContext.formFields.join(' | ')}`);
  if (pageContext?.buttons?.length) lines.push(`Visible actions: ${pageContext.buttons.join(' | ')}`);
  if (pageContext?.emptyStates?.length) lines.push(`Empty / status messages: ${pageContext.emptyStates.join(' | ')}`);
  if (pageContext?.visibleText) {
    lines.push('Visible page text excerpt:');
    lines.push(pageContext.visibleText.slice(0, 4000));
  }

  const viewGrounding = pathname ? loadViewGrounding(pathname) : '';
  if (viewGrounding) {
    lines.push('');
    lines.push(viewGrounding);
  }

  lines.push('');
  lines.push(
    'When the operator asks about "this page", describe ONLY what appears in CURRENT PAGE CONTEXT and VIEW TEMPLATE GROUNDING. Do not invent missing UI.',
  );
  return '\n\n' + lines.join('\n');
}

// Build scan cache on first import (server startup)
buildDynamicKnowledge();

// ---------------------------------------------------------------------------
// Usage tracking
// ---------------------------------------------------------------------------

interface UsageRecord {
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
}

interface UsageStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  history: UsageRecord[];
}

const usageStats: UsageStats = {
  totalRequests: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCostUsd: 0,
  history: [],
};

const PRICING: Record<string, { input: number; output: number }> = {
  'deepseek-chat': { input: 0.00014, output: 0.00028 }, // per 1K tokens
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.8);
}

function recordUsage(model: string, inputTokens: number, outputTokens: number): void {
  const pricing = PRICING[model] || PRICING['deepseek-chat'];
  const costUsd = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
  const record: UsageRecord = {
    timestamp: new Date().toISOString(),
    inputTokens,
    outputTokens,
    costUsd,
    model,
  };
  usageStats.totalRequests += 1;
  usageStats.totalInputTokens += inputTokens;
  usageStats.totalOutputTokens += outputTokens;
  usageStats.totalCostUsd += costUsd;
  usageStats.history.push(record);
  if (usageStats.history.length > 200) usageStats.history.shift();
}

// Index codebase for RAG (async, non-blocking)
try {
  const ragResult = indexOpsCodebase();
  console.log(`  Ops RAG: indexed ${ragResult.fileCount} files, ${ragResult.chunkCount} chunks`);
} catch (err) {
  console.error('  Ops RAG: index failed:', err instanceof Error ? err.message : err);
}

// ---------------------------------------------------------------------------
// API config
// ---------------------------------------------------------------------------

async function getApiConfig(): Promise<{ url: string; key: string; model: string; provider: string } | null> {
  try {
    const preferred = await getAiProductLlm('ops_assistant');
    if (preferred?.provider || preferred?.model) {
      const resolved = resolveOpsAssistantEndpoint(preferred.provider, preferred.model);
      if (resolved) return resolved;
    }
  } catch {
    /* fall through to env defaults */
  }
  return resolveOpsAssistantEndpoint('', '');
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

opsAssistantRouter.post('/chat', async (req, res) => {
  const config = await getApiConfig();
  if (!config) {
    res.status(503).json({ error: 'No AI provider configured. Set DEEPSEEK_API_KEY or OPS_ASSISTANT_API_KEY in ops env, or pick a model in AI Control.' });
    return;
  }

  const { messages, currentPage, pageContext } = req.body as {
    messages?: { role: string; content: string }[];
    currentPage?: string;
    pageContext?: ClientPageContext;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array required' });
    return;
  }

  const pageBlock = buildCurrentPageBlock(currentPage, pageContext);
  const pagePath = String(pageContext?.pathname || currentPage || '');

  // RAG: retrieve relevant code chunks based on the latest user message + current path
  const latestUserMsg = messages.filter((m) => m.role === 'user').pop()?.content || '';
  const ragContext = ragQuery(`${latestUserMsg} ${pagePath} ${pageContext?.heading || ''}`.trim(), 6);

  const systemMessage = getFullKnowledge() + pageBlock +
    (ragContext ? '\n\n' + ragContext : '');

  const apiMessages = [
    { role: 'system', content: systemMessage },
    ...messages.slice(-20).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content).slice(0, 4000),
    })),
  ];

  try {
    const upstream = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.key}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: apiMessages,
        stream: true,
        max_tokens: 1200,
        temperature: 0.4,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      res.status(502).json({ error: `AI provider error (${upstream.status}): ${errText.slice(0, 200)}` });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Estimate input tokens from the messages we sent
    const inputText = apiMessages.map((m) => m.content).join(' ');
    const inputTokenEst = estimateTokens(inputText);

    if (upstream.body) {
      const reader = Readable.fromWeb(upstream.body as import('stream/web').ReadableStream);
      let outputChars = 0;

      reader.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8');
        // Count output characters from content deltas
        const matches = text.matchAll(/"content":"([^"]*)"/g);
        for (const m of matches) {
          outputChars += m[1].length;
        }
        res.write(chunk);
      });

      reader.on('end', () => {
        const outputTokenEst = estimateTokens(String.fromCharCode(0).repeat(outputChars));
        recordUsage(config.model, inputTokenEst, Math.max(outputTokenEst, Math.ceil(outputChars / 3.8)));
        res.end();
      });

      reader.on('error', () => {
        recordUsage(config.model, inputTokenEst, Math.ceil(outputChars / 3.8));
        res.end();
      });

      req.on('close', () => reader.destroy());
    } else {
      res.end();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) {
      res.status(502).json({ error: 'AI request failed: ' + msg });
    } else {
      res.end();
    }
  }
});

opsAssistantRouter.get('/health', async (_req, res) => {
  const config = await getApiConfig();
  const ragStats = getIndexStats();
  res.json({
    ok: Boolean(config),
    provider: config?.provider ?? null,
    model: config?.model ?? null,
    knowledgeSize: dynamicKnowledge?.length ?? 0,
    rag: ragStats,
  });
});

opsAssistantRouter.post('/refresh', (_req, res) => {
  dynamicKnowledge = null;
  const rebuilt = buildDynamicKnowledge();
  const ragResult = indexOpsCodebase();
  res.json({ ok: true, knowledgeSize: rebuilt.length, rag: ragResult });
});

opsAssistantRouter.get('/search', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  if (!q) {
    res.status(400).json({ error: 'q parameter required' });
    return;
  }
  const results = search(q, 10);
  res.json({
    query: q,
    results: results.map((r) => ({
      file: r.filePath,
      lines: `${r.lineStart}-${r.lineEnd}`,
      preview: r.content.slice(0, 200),
    })),
  });
});

opsAssistantRouter.get('/usage', (_req, res) => {
  res.json(usageStats);
});

opsAssistantRouter.get('/knowledge', (_req, res) => {
  const knowledgePath = path.join(opsRoot, 'OPS-KNOWLEDGE.md');
  try {
    const content = fs.readFileSync(knowledgePath, 'utf-8');
    res.json({ ok: true, content });
  } catch {
    res.json({ ok: false, content: '' });
  }
});

opsAssistantRouter.post('/knowledge', (req, res) => {
  const { content } = req.body as { content?: string };
  if (content === undefined) {
    res.status(400).json({ ok: false, error: 'content required' });
    return;
  }
  const knowledgePath = path.join(opsRoot, 'OPS-KNOWLEDGE.md');
  try {
    fs.writeFileSync(knowledgePath, content, 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Write failed' });
  }
});

opsAssistantRouter.get('/admin', (_req, res) => {
  res.render('ops-assistant-admin', { title: 'Ops Assistant' });
});
