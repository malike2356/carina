import express, { Router, type NextFunction, type Request, type Response } from 'express';
import type pg from 'pg';
import { pool } from '../db.js';
import { resolveAdapter } from './adapter-registry.js';
import { inspectRequest, getScoutPipelineDeps, resetScoutPipelineDeps, setScoutPipelineDeps, type ScoutPipelineDeps } from './security-pipeline.js';

const getProxyKey = (): string => process.env.SCOUT_PROXY_KEY ?? '';

export interface ScoutProxyOptions {
  agentType?: string;
  target?: string;
  requireProxyKey?: boolean;
}

export type ProxyDeps = ScoutPipelineDeps;

export function _setProxyDeps(overrides: Partial<ProxyDeps>): void {
  setScoutPipelineDeps(overrides);
}

export function _resetProxyDeps(): void {
  resetScoutPipelineDeps();
}

export function detectAgent(userAgent: string | undefined): string {
  if (!userAgent) return 'unknown';
  // Known third-party user-agent prefixes map to neutral adapter types.
  if (userAgent.startsWith('OpenClaw/')) return 'goal-result';
  if (userAgent.startsWith('Hermes-Agent/')) return 'compat-agent';
  if (userAgent.includes('LangChain')) return 'langchain';
  if (userAgent.includes('OpenAI')) return 'openai';
  return 'unknown';
}

function requireProxyKey(req: Request, res: Response, next: NextFunction): void {
  const provided = req.headers['x-scout-proxy-key'];
  const proxyKey = getProxyKey();
  if (!proxyKey || provided !== proxyKey) {
    res.status(401).json({ error: { message: 'Unauthorized', type: 'authentication_error' } });
    return;
  }
  next();
}

function resolveUpstreamBase(req: Request, configured?: string): string {
  if (configured) return configured;
  const targetHost = req.headers['x-scout-target'];
  const raw = typeof targetHost === 'string' ? targetHost : undefined;
  if (!raw) return 'https://api.openai.com';
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

async function forward(req: Request, res: Response, options: ScoutProxyOptions): Promise<void> {
  const agentType = options.agentType ?? detectAgent(req.headers['user-agent']);
  const adapter = resolveAdapter(agentType === 'unknown' ? 'openai' : agentType);
  const parsed = adapter.parseRequest(req.body, { path: req.path, method: req.method, headers: req.headers });
  const decision = await inspectRequest(parsed, req);
  const deps = getScoutPipelineDeps();

  if (decision.blocked) {
    res.status(400).json({
      error: {
        message: `Request blocked by Labyrinth Scout: ${decision.reason ?? 'prompt injection detected'}`,
        type: 'invalid_request_error',
        code: 'prompt_injection_detected',
      },
    });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const apiKey = bearerMatch?.[1] ?? '';
  if (apiKey) {
    void deps.checkApiKey(apiKey, { agentType: adapter.agentType, ip: req.ip, tool: 'proxy' });
  }

  const upstreamBase = resolveUpstreamBase(req, options.target);
  const upstreamPath = adapter.resolveUpstreamPath?.(req.path) ?? req.path;
  const upstreamUrl = `${upstreamBase.replace(/\/$/, '')}${upstreamPath}`;

  if (!deps.isAllowed(upstreamUrl)) {
    await deps.logEvent(req, 'proxy_egress_blocked', 'critical', { upstreamUrl, agentType: adapter.agentType });
    res.status(400).json({ error: { message: `Upstream host not in Labyrinth allowlist: ${upstreamBase}`, type: 'invalid_request_error' } });
    return;
  }

  try {
    const upstreamRes = await deps.fetchFn(upstreamUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        'User-Agent': 'Labyrinth-Scout-Proxy/1.0',
      },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body),
      signal: AbortSignal.timeout(120_000),
    });
    const contentType = upstreamRes.headers.get('content-type') ?? '';
    const streamRequested = Boolean((req.body as Record<string, unknown> | undefined)?.stream);
    const isStream = streamRequested || contentType.includes('text/event-stream');

    if (isStream && upstreamRes.body) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.status(upstreamRes.status);
      const reader = upstreamRes.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        res.write(chunk);
      }
      res.end();
      void deps.checkResponse(upstreamUrl, accumulated).catch(() => undefined);
      void deps.logEvent(req, 'proxy_request', 'info', { agentType: adapter.agentType, upstreamUrl, streaming: true, responseLength: accumulated.length });
      return;
    }

    const responseText = await upstreamRes.text();
    void deps.checkResponse(upstreamUrl, responseText).catch(() => undefined);
    res.status(upstreamRes.status).set('Content-Type', contentType || 'application/json').send(responseText);
    void deps.logEvent(req, 'proxy_request', 'info', { agentType: adapter.agentType, upstreamUrl, streaming: false, responseLength: responseText.length, statusCode: upstreamRes.status });
  } catch (err) {
    console.error('[Proxy] Upstream error:', err);
    res.status(502).json({ error: { message: 'Upstream request failed', type: 'api_error' } });
  }
}

export function createScoutProxyRouter(options: ScoutProxyOptions = {}): Router {
  const router = Router();
  if (options.requireProxyKey !== false) router.use(requireProxyKey);
  router.all('/{*path}', (req, res) => {
    void forward(req, res, options);
  });
  return router;
}

export function createOpenAiProxyRouter(): Router {
  return createScoutProxyRouter({ agentType: 'openai' });
}

export const openAiProxyRouter = createOpenAiProxyRouter();

export function startProxyServer(dbPool: pg.Pool = pool, options: ScoutProxyOptions = {}): void | express.Express {
  void dbPool;
  const enabled = process.env.SCOUT_PROXY_ENABLED === 'true';
  const port = parseInt(process.env.SCOUT_PROXY_PORT ?? '8080', 10);
  if (!enabled) {
    console.log('[Scout] Proxy mode disabled (SCOUT_PROXY_ENABLED != true)');
    return;
  }
  const proxyApp = express();
  proxyApp.set('trust proxy', 1);
  proxyApp.use(express.json({ limit: '10mb' }));
  proxyApp.use('/', createScoutProxyRouter(options));
  proxyApp.listen(port, () => {
    console.log(`[Scout] Proxy listening on port ${port}`);
  });
  return proxyApp;
}
