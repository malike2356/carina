import { isCorsOriginAllowed, resolveAllowedCorsOrigins } from '#core/health/cors-origins.js';
import { buildProductionHealthPayload } from '#core/health/production-health.js';
import fsSync from 'node:fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Server } from 'http';
import express, { type Express, type Request, type Response } from 'express';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import chalk from 'chalk';
import { injectMitLicenseFooter, injectWhyCarinaSection } from './license-footer.js';
import { injectWorkspaceChrome, injectWorkspaceHub, injectChatShellBranding, type WorkspacePageId } from './workspace-chrome.js';
import type { ProductMode } from '#core/product/types.js';
import { resolveProductMode } from '#core/product/surface.js';
import { enforceRouteOwnership } from '#core/product/route-matrix.js';
import { config } from '#core/config/index.js';
import { getResolvedBudgetConfig, getResolvedTurnConfig } from '#core/config/runtime-config.js';
import { checkMonthlyBudget } from '#core/brain/cost-tracker.js';
import { formatBudgetVisibility } from '#core/brain/cost-guards.js';
import { llm } from '#core/brain/llm.js';
import { getActiveProfileName } from '#core/profiles/manager.js';
import { emailWebhookRouter } from '#core/api/email-webhook.js';
import { mountHostedRoutes } from '#core/api/hosted.js';
import { mountLocaleRoutes } from '#core/api/locale-api.js';
import { mountCloudRawRoutes, mountServerRoutes } from '#core/server.js';
import { cloudRouter, loginCloudOrg, registerCloudOrg } from '#core/api/cloud/router.js';
import { mountBillingRoutes, mountBillingWebhook } from '#core/api/billing-routes.js';
import { subscribeRouter } from '#core/api/subscribe.js';
import { memoryApiRouter } from '#core/api/memory-api.js';
import { processApiRouter } from '#core/api/process-api.js';
import { kanbanApiRouter } from '#core/api/kanban-api.js';
import { mcpApiRouter } from '#core/api/mcp-api.js';
import { webhookApiRouter } from '#core/api/webhook-api.js';
import { documentsApiRouter } from '#core/gateway/documents-api.js';
import { imagesApiRouter } from '#core/gateway/images-api.js';
import { notesApiRouter } from '#core/gateway/notes-api.js';
import { emailApiRouter } from '#core/gateway/email-api.js';
import { packsApiRouter } from '#core/api/packs-api.js';
import { cookbookApiRouter } from '#core/api/cookbook-api.js';
import { curatorApiRouter } from '#core/api/curator-api.js';
import { learningApiRouter } from '#core/api/learning-api.js';
import { mountDesktopApiRoutes } from '#core/api/desktop-api.js';
import { themeApiRouter } from '#core/api/theme-api.js';
import { webAuthApiRouter } from '#core/api/web-auth-api.js';
import { workspacePresetsApiRouter } from '#core/api/workspace-presets-api.js';
import { isWebTotpEnabled } from '#core/auth/web-totp-store.js';
import { compareApiRouter } from '#core/api/compare-api.js';
import { researchApiRouter } from '#core/api/research-api.js';
import { securityToolsApiRouter } from '#core/api/cyber-tools-api.js';
import { internalResearchApiRouter } from '#core/api/internal-research-api.js';
import { internalTransactionalApiRouter } from '#core/api/internal-transactional-api.js';
import { calendarApiRouter } from '#core/api/calendar-api.js';
import { scheduledApiRouter } from '#core/api/scheduled-api.js';
import { trelloApiRouter } from '#core/api/trello-api.js';
import { getRouter } from '#core/gateway/router.js';
import {
  cancelStreamSession,
  clearStreamSession,
  registerStreamSession,
} from '#core/telemetry/stream-session.js';
import {
  appendStreamDraft,
  discardStreamDraft,
  getStreamDraftPreview,
  getStreamDraftState,
  initStreamDraft,
  pauseStreamDraft,
  resumeStreamDraft,
  waitWhileStreamPaused,
} from '#core/telemetry/stream-draft-controls.js';
import {
  classifyError,
  formatClassifiedError,
} from '#core/telemetry/error-classifier.js';
import {
  formatLegacyTokenChunk,
  formatStreamDone,
  formatStreamSseEvent,
  streamEvent,
} from '#core/telemetry/stream-events.js';
import { resolveWebPasswordHash } from '#core/ops/web-password.js';
import {
  checkWebPassword,
  redirectIfHostedAuthed,
  redirectIfWebAuthed,
  requireHostedSession,
  requireWebAuth,
} from '#core/gateway/web-auth.js';
import {
  checkAuthRateLimit,
  clearAuthFailures,
  recordAuthFailure,
} from '#core/security/auth-rate-limit.js';
import { OPS_PAGE_FILES, requireOpsPlanGate } from '#core/hosted/plan-gates.js';
import { mountCarinaOpsRoutes } from '#core/api/carina-ops-routes.js';
import { mountGatewayRoutes } from '#core/api/gateway-routes.js';
import { enforceHostedQuota, resolveExternalId } from '#core/gateway/hosted-chat.js';
import { isHostedRequest } from '#core/gateway/hosted-domain.js';
import { mountHostedContextRoute, mountHostedWebRoutes } from '#core/api/hosted-web.js';
import { mountHostedBillingRoutes } from '#core/api/hosted-billing.js';
import { mountHostedPushRoutes } from '#core/api/hosted-push.js';
import { mountHostedScoutRoutes } from '#core/api/hosted-scout.js';
import { notifyTaskPush } from '#core/notifications/mobile-push.js';
import { startScoutPushPoller } from '#core/notifications/scout-push-poller.js';
import { getTenantScoutCredentials, scoutServiceUrl } from '#core/billing/tenant-scout.js';
import { ensureHostedScoutHeartbeat, runWithHostedScout } from '#core/gateway/hosted-scout.js';
import { createWhatsAppRouter, isWhatsAppConfigured, logWhatsAppStatus } from '#core/gateway/whatsapp.js';
import { channelRegistry } from '#core/gateway/channels/channel-registry.js';
import { WebAdapter } from '#core/gateway/channels/adapters/web-adapter.js';
import { setupAcpRoutes } from '#core/gateway/acp.js';
import { setupAcpIdeRoutes } from '#core/gateway/acp-ide.js';
import {
  mountAllChannelWebhooks,
  registerAllChannelAdapters,
  startChannelListeners,
  logChannelStatus,
} from '#core/gateway/channel-bootstrap.js';
import { processTelegramWebhookUpdate } from '#core/gateway/telegram.js';
import { tenantKeysRouter } from '#core/api/tenant-keys.js';
import { getUserByApiKey, verifyJwt } from '#core/api/hosted-auth.js';
import { mountWebContextRoute } from '#core/gateway/web-context.js';
import { mountOpsRoutes } from '#core/api/ops-routes.js';
import { mountControlRoutes } from '#core/api/control-routes.js';
import { mountPairingRoutes } from '#core/api/pairing-routes.js';
import { attachTerminalWebSocket } from '#core/api/terminal-ws.js';
import { writeHostPidFile, clearHostPidFile } from '#core/infrastructure/host-service.js';
import { isControlAuthorized, pairedDeviceFromRequest } from '#core/infrastructure/control-auth.js';
import { createSkillsHubApp } from '#core/skills/hub/server.js';
import { initHubDb } from '#core/skills/hub/migrations.js';
import { seedHubRegistry } from '#core/skills/hub/seed.js';
import { transcribeUploadedAudio } from '#core/utils/transcribe-upload.js';

export type StartWebOptions = {
  localMode?: boolean;
  host?: string;
  port?: number;
};

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

export type WebGatewayOptions = StartWebOptions;

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function packageRoot(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function firstExistingDir(candidates: string[]): string {
  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

const root = packageRoot();
export const WEB_ASSET_DIR = firstExistingDir([
  path.join(root, 'dist', 'assets', 'web'),
  path.join(root, 'assets', 'web'),
]);
export const DASHBOARD_ASSET_DIR = firstExistingDir([
  path.join(root, 'dist', 'public', 'dashboard'),
  path.join(root, 'public', 'dashboard'),
]);

function resolveCorePricingDir(): string {
  const coreRoot = path.dirname(require.resolve('@verlox/carina-core/package.json'));
  return path.join(coreRoot, 'dist/src/web/pricing');
}

const WEB_STATIC = WEB_ASSET_DIR;
const PRICING_STATIC = resolveCorePricingDir();
const DASHBOARD_STATIC = DASHBOARD_ASSET_DIR;
const activeServers: Server[] = [];
const HUB_HOSTNAMES = new Set(['hub.carinaai.uk', 'skills.carinaai.uk']);

function resolveHubPacksStorage(): string {
  const coreRoot = path.dirname(require.resolve('@verlox/carina-core/package.json'));
  return path.join(coreRoot, 'data/hub-packs');
}

async function resolveCarinaVersion(): Promise<string> {
  try {
    const coreRoot = path.dirname(require.resolve('@verlox/carina-core/package.json'));
    const pkg = JSON.parse(
      await fs.readFile(path.join(coreRoot, 'package.json'), 'utf-8'),
    ) as { version?: string };
    return pkg.version ?? '0.2.0';
  } catch {
    return '0.2.0';
  }
}

export function decoratePageHtml(
  html: string | null | undefined,
  version: string,
  opts?: {
    whyCarina?: boolean;
    workspacePage?: WorkspacePageId;
    includeMitFooter?: boolean;
    productMode?: ProductMode;
    chatShell?: boolean;
  },
): string | null {
  if (html == null) return null;
  const mode = opts?.productMode ?? 'private';
  const showMitFooter = opts?.includeMitFooter !== false && mode !== 'hosted';
  let out = injectMitLicenseFooter(html, version, showMitFooter);
  if (opts?.whyCarina) out = injectWhyCarinaSection(out);
  if (opts?.workspacePage === 'hub') out = injectWorkspaceHub(out, mode);
  else if (opts?.workspacePage) out = injectWorkspaceChrome(out, opts.workspacePage, mode);
  else if (opts?.chatShell) out = injectChatShellBranding(out, mode);
  return out;
}

function surfaceModeFromRequest(req: Request): ProductMode {
  const mode = resolveProductMode(req.hostname);
  return mode === 'ops' ? 'private' : mode;
}

type SurfaceHtmlPair = { private: string | null; hosted: string | null };

function pickSurfaceHtml(pages: SurfaceHtmlPair, req: Request): string | null {
  return surfaceModeFromRequest(req) === 'hosted' ? pages.hosted : pages.private;
}

async function loadSurfaceHtmlPair(
  filePath: string,
  version: string,
  opts?: {
    whyCarina?: boolean;
    workspacePage?: WorkspacePageId;
    includeMitFooter?: boolean;
    chatShell?: boolean;
  },
): Promise<SurfaceHtmlPair> {
  const raw = await fs.readFile(filePath, 'utf-8').catch(() => null);
  if (!raw) return { private: null, hosted: null };
  return {
    private: decoratePageHtml(raw, version, { ...opts, productMode: 'private', chatShell: opts?.chatShell }),
    hosted: decoratePageHtml(raw, version, { ...opts, productMode: 'hosted', chatShell: opts?.chatShell }),
  };
}

async function collectResponse(generator: AsyncGenerator<string>): Promise<string> {
  let full = '';
  for await (const chunk of generator) {
    full += chunk;
  }
  return full;
}

async function resolveTenantId(req: Request): Promise<string | undefined> {
  if (req.hostedUser?.id) return req.hostedUser.id;
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return undefined;
  // Ops/device/session machine tokens are not hosted tenant API keys.
  if (isControlAuthorized(req)) return undefined;
  const jwtUser = verifyJwt(token);
  if (jwtUser) return jwtUser.userId;
  const apiUser = await getUserByApiKey(token);
  return apiUser?.id;
}

function setupChatRoutes(app: Express): void {
  const healthHandler = async (_req: Request, res: Response) => {
    if (process.env.HOSTED_MODE === 'true' || process.env.NODE_ENV === 'production') {
      const payload = await buildProductionHealthPayload();
      res.status(payload.status === 'ok' ? 200 : 503).json(payload);
      return;
    }
    const device = pairedDeviceFromRequest(_req);
    res.json({
      ok: true,
      mode: process.env.CARINA_LOCAL_MODE === 'true' ? 'local' : 'server',
      service: 'carina-gateway',
      pairedDevice: device ? { id: device.id, name: device.name } : undefined,
    });
  };

  app.get('/api/health', healthHandler);
  app.get('/health', healthHandler);

  app.get('/api/config', async (_req: Request, res: Response) => {
    let activeProvider = '';
    try {
      activeProvider = llm.current().name;
    } catch {
      activeProvider = '';
    }
    const turns = getResolvedTurnConfig();
    const budgetConfig = getResolvedBudgetConfig();
    let budget: Awaited<ReturnType<typeof checkMonthlyBudget>> | null = null;
    try {
      budget = await checkMonthlyBudget();
    } catch {
      budget = null;
    }
    res.json({
      provider: activeProvider,
      providers: llm.list(),
      profile: process.env.CARINA_PROFILE ?? getActiveProfileName() ?? 'default',
      locale: process.env.CARINA_LANGUAGE ?? process.env.CARINA_LOCALE ?? 'en',
      web: { port: config.web.port },
      turns: {
        max: turns.maxTurns,
        subagentMax: turns.subagentMaxTurns,
        parentIterationBudget: turns.parentIterationBudget,
        subagentIterationBudget: turns.subagentIterationBudget,
        graceCall: turns.graceCall,
      },
      budget: budgetConfig.monthlyUsd !== null ? {
        monthlyUsd: budgetConfig.monthlyUsd,
        warnAtPercent: budgetConfig.warnAtPercent,
        turnWarnUsd: budgetConfig.turnWarnUsd,
        blockExpensiveOnWarn: budgetConfig.blockExpensiveOnWarn,
        status: budget?.status ?? 'ok',
        usedUsd: budget?.totalCost ?? 0,
        remainingUsd: budget?.budgetLimit !== null && budget?.budgetLimit !== undefined
          ? Math.max(0, budget.budgetLimit - budget.totalCost)
          : null,
        message: budget ? formatBudgetVisibility(budget) : null,
      } : null,
    });
  });

  app.get('/api/providers', async (req: Request, res: Response) => {
    try {
      const externalId = resolveExternalId(req);
      const router = getRouter();
      const webSession = await router.startWebSession(externalId);
      res.json({
        providers: llm.list(),
        known: llm.listKnown(),
        active: router.getSessionActiveProvider(webSession.sessionId),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/providers/switch', express.json(), async (req: Request, res: Response) => {
    const provider = String(req.body?.provider ?? '').trim().toLowerCase();
    if (!provider) {
      res.status(400).json({ error: 'provider is required' });
      return;
    }

    try {
      await runWithHostedScout(req, async () => {
        const router = getRouter();
        const externalId = resolveExternalId(req);
        const webSession = await router.startWebSession(externalId);
        const reply = await collectResponse(router.handle({
          id: String(Date.now()),
          sessionId: webSession.sessionId,
          agentId: webSession.agentId,
          content: `/model ${provider}`,
          source: 'web',
          timestamp: new Date(),
        }));
        res.json({
          ok: true,
          reply,
          active: router.getSessionActiveProvider(webSession.sessionId),
          providers: llm.list(),
        });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  const handleChatSend = async (req: Request, res: Response): Promise<void> => {
    const message = String(req.body?.message ?? '').trim();

    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const quotaMessage = await enforceHostedQuota(req);
    if (quotaMessage) {
      res.status(429).json({ error: quotaMessage, upgradeUrl: '/billing' });
      return;
    }

    try {
      await runWithHostedScout(req, async () => {
        await ensureHostedScoutHeartbeat(req);
        const router = getRouter();
        const externalId = resolveExternalId(req);
        const webSession = await router.startWebSession(externalId);
        const tenantId = await resolveTenantId(req);
        const reply = await collectResponse(router.handle({
          id: String(Date.now()),
          sessionId: webSession.sessionId,
          agentId: webSession.agentId,
          tenantId,
          content: message,
          source: 'web',
          timestamp: new Date(),
        }));
        res.json({
          reply,
          sessionId: webSession.sessionId,
          agentId: webSession.agentId,
          provider: llm.current().name,
        });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  };

  app.post('/api/chat', express.json(), handleChatSend);
  app.post('/api/chat/send', express.json(), handleChatSend);

  app.post('/api/transcribe', express.raw({ type: ['audio/*', 'video/webm', 'application/octet-stream'], limit: '25mb' }), async (req: Request, res: Response) => {
    const audio = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? []);
    const contentType = Array.isArray(req.headers['content-type'])
      ? req.headers['content-type'][0]
      : req.headers['content-type'];
    const languageHeader = Array.isArray(req.headers['x-transcribe-lang'])
      ? req.headers['x-transcribe-lang'][0]
      : req.headers['x-transcribe-lang'];
    const language = String(req.query.language ?? languageHeader ?? '').trim() || undefined;
    const result = await transcribeUploadedAudio(audio, contentType, language);
    if ('error' in result) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  });

  app.post('/api/lsp/request', express.json(), async (req: Request, res: Response) => {
    const { handleLspRequest } = await import('#core/api/lsp-api.js');
    await handleLspRequest(req, res);
  });

  mountDesktopApiRoutes(app);
  app.use('/api/mcp', mcpApiRouter);

  app.post('/api/tts', express.json({ limit: '32kb' }), async (req: Request, res: Response) => {
    const { handleTtsRequest } = await import('#core/api/tts-api.js');
    await handleTtsRequest(req, res);
  });

  app.post('/api/clear', express.json(), async (req: Request, res: Response) => {
    const externalId = resolveExternalId(req);
    const router = getRouter();
    const webSession = await router.startWebSession(externalId);
    await router.clearSession(webSession.sessionId);
    res.json({ ok: true });
  });

  app.get('/api/chat/stream', async (req: Request, res: Response) => {
    const message = String(req.query.message ?? '').trim();
    const pushNotify = req.query.notify === '1';
    const promptPreview = String(req.query.prompt ?? message).trim().slice(0, 240);
    const hostedAccountId = req.hostedUser?.id;
    const turnId = String(req.query.turnId ?? `${Date.now().toString(36)}`);

    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const quotaMessage = await enforceHostedQuota(req);
    if (quotaMessage) {
      res.status(429).json({ error: quotaMessage, upgradeUrl: '/billing' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let streamFailed = false;
    let sessionId = '';
    try {
      await runWithHostedScout(req, async () => {
        await ensureHostedScoutHeartbeat(req);
        const router = getRouter();
        const externalId = resolveExternalId(req);
        const webSession = await router.startWebSession(externalId);
        sessionId = webSession.sessionId;
        const controller = registerStreamSession(sessionId, turnId);
        initStreamDraft(sessionId, turnId);
        res.write(formatStreamSseEvent(streamEvent('meta', {
          sessionId,
          turnId,
          meta: { provider: router.getSessionActiveProvider(sessionId) },
        })));
        res.write(formatStreamSseEvent(streamEvent('status', {
          sessionId,
          turnId,
          content: 'thinking',
        })));

        const tenantId = await resolveTenantId(req);
        const stream = router.handle({
          id: String(Date.now()),
          sessionId: webSession.sessionId,
          agentId: webSession.agentId,
          tenantId,
          content: message,
          source: 'web',
          timestamp: new Date(),
        }, { turnId });
        for await (const chunk of stream) {
          if (controller.signal.aborted) break;
          await waitWhileStreamPaused(sessionId, turnId);
          if (getStreamDraftState(sessionId, turnId) === 'discarded') break;
          appendStreamDraft(sessionId, turnId, chunk);
          res.write(formatLegacyTokenChunk(chunk));
        }
        if (controller.signal.aborted) {
          res.write(formatStreamSseEvent(streamEvent('error', {
            sessionId,
            turnId,
            error: classifyError(new Error('cancelled')),
          })));
        }
        res.write(formatStreamDone());
        clearStreamSession(sessionId, turnId);
      });
    } catch (err) {
      streamFailed = true;
      const classified = classifyError(err);
      res.write(formatStreamSseEvent(streamEvent('error', {
        sessionId: sessionId || undefined,
        turnId,
        error: classified,
        content: formatClassifiedError(classified),
      })));
      res.write(formatLegacyTokenChunk(`\nError: ${formatClassifiedError(classified)}`));
      res.write(formatStreamDone());
    }
    res.end();

    if (pushNotify && hostedAccountId) {
      void notifyTaskPush(
        hostedAccountId,
        promptPreview,
        streamFailed ? 'failed' : 'completed',
      );
    }
  });

  app.post('/api/chat/cancel', express.json(), (req: Request, res: Response) => {
    const sessionId = String(req.body?.sessionId ?? '').trim();
    const turnId = String(req.body?.turnId ?? '').trim();
    if (!sessionId || !turnId) {
      res.status(400).json({ error: 'sessionId and turnId are required' });
      return;
    }
    discardStreamDraft(sessionId, turnId);
    const cancelled = cancelStreamSession(sessionId, turnId);
    res.json({ ok: cancelled, draft: getStreamDraftPreview(sessionId, turnId) });
  });

  app.post('/api/chat/stream/pause', express.json(), (req: Request, res: Response) => {
    const sessionId = String(req.body?.sessionId ?? '').trim();
    const turnId = String(req.body?.turnId ?? '').trim();
    if (!sessionId || !turnId) {
      res.status(400).json({ error: 'sessionId and turnId are required' });
      return;
    }
    res.json({ ok: pauseStreamDraft(sessionId, turnId), state: getStreamDraftState(sessionId, turnId) });
  });

  app.post('/api/chat/stream/resume', express.json(), (req: Request, res: Response) => {
    const sessionId = String(req.body?.sessionId ?? '').trim();
    const turnId = String(req.body?.turnId ?? '').trim();
    if (!sessionId || !turnId) {
      res.status(400).json({ error: 'sessionId and turnId are required' });
      return;
    }
    res.json({ ok: resumeStreamDraft(sessionId, turnId), state: getStreamDraftState(sessionId, turnId) });
  });

  app.post('/api/chat/stream/discard', express.json(), (req: Request, res: Response) => {
    const sessionId = String(req.body?.sessionId ?? '').trim();
    const turnId = String(req.body?.turnId ?? '').trim();
    if (!sessionId || !turnId) {
      res.status(400).json({ error: 'sessionId and turnId are required' });
      return;
    }
    discardStreamDraft(sessionId, turnId);
    cancelStreamSession(sessionId, turnId);
    res.json({ ok: true, state: getStreamDraftState(sessionId, turnId) });
  });
}

export async function createWebServer(options: StartWebOptions = {}): Promise<Express> {
  const localMode = options.localMode === true;
  if (localMode) process.env.CARINA_LOCAL_MODE = 'true';
  const carinaVersion = await resolveCarinaVersion();
  let hubApp: Express | null = null;

  const app = express();
  channelRegistry.register(new WebAdapter(config.web.enabled));
  app.set('trust proxy', 1);

  if (!localMode) {
    const hubPacksStorage = resolveHubPacksStorage();
    await fs.mkdir(hubPacksStorage, { recursive: true });
    await initHubDb();
    await seedHubRegistry(hubPacksStorage);
    hubApp = createSkillsHubApp();
    app.use((req, res, next) => {
      if (HUB_HOSTNAMES.has(req.hostname.toLowerCase())) {
        hubApp?.(req, res, next);
        return;
      }
      next();
    });
  }

  app.use((_req, res, next) => {
    const allowed = resolveAllowedCorsOrigins();
    const origin = _req.headers.origin;
    if (isCorsOriginAllowed(origin, allowed)) {
      res.setHeader('Access-Control-Allow-Origin', origin || allowed[0] || 'https://app.carinaai.uk');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-internal-key,X-Transcribe-Lang,X-Admin-Token,X-Workspace-Id');
    if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  if (!localMode) {
    const billingConfigured = Boolean(config.hosted.stripeSecretKey || process.env.STRIPE_SECRET_KEY);
    if (billingConfigured) {
      mountBillingWebhook(app);
    } else {
      console.warn(chalk.yellow('Billing webhook skipped: STRIPE_SECRET_KEY not configured'));
    }
    mountCloudRawRoutes(app);
  }
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  if (process.env.CARINA_OPENAI_API_ENABLED === 'true') {
    const { mountOpenAiCompatibleRoutes } = await import('#core/api/openai-compatible/index.js');
    mountOpenAiCompatibleRoutes(app);
    console.log(chalk.green('OpenAI-compatible API mounted at /v1/*'));
  }
  mountLocaleRoutes(app);
  mountOpsRoutes(app);
  const { marketplaceApiRouter, workshopApiRouter } = await import('#core/api/marketplace-api.js');
  app.use('/api/marketplace', marketplaceApiRouter);
  app.use('/api/workshop', workshopApiRouter);
  if (!localMode) {
    app.use(
      session({
        secret: process.env.WEB_SESSION_SECRET ?? 'change-me-in-production',
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 30 * 24 * 60 * 60 * 1000,
        },
      }),
    );
    app.use(enforceRouteOwnership);
    mountWebContextRoute(app);
    mountControlRoutes(app);
    mountPairingRoutes(app);
    if (process.env.CARINA_NODE_HOST_ENABLED === 'true') {
      const { mountNodeHostRoutes } = await import('#core/infrastructure/node-host/routes.js');
      mountNodeHostRoutes(app);
    }
  }
  app.post('/app/auth/register', registerCloudOrg);
  app.post('/app/auth/login', loginCloudOrg);
  if (!localMode) {
    app.use('/api/cloud', cloudRouter);
  }
  app.use('/api/chat', chatLimiter);
  app.use('/api/playbook', cookbookApiRouter);
  app.use('/api/cookbook', cookbookApiRouter);
  app.use('/api/curator', curatorApiRouter);
  app.use('/api/learning', learningApiRouter);
  app.use('/api/theme', themeApiRouter);
  app.use('/api/auth', webAuthApiRouter);
  app.use('/api/workspace/presets', workspacePresetsApiRouter);
  app.use('/api/compare', compareApiRouter);
  app.use('/api/research', researchApiRouter);
  app.use('/api/tools', securityToolsApiRouter);
  app.use('/api/internal/research', internalResearchApiRouter);
  app.use('/api/internal/transactional', internalTransactionalApiRouter);
  app.use('/api/calendar', calendarApiRouter);
  app.use('/api/scheduled', scheduledApiRouter);
  app.use('/api/trello', trelloApiRouter);
  if (!localMode) {
    app.use('/api/subscribe', subscribeRouter);
    if (config.hosted.stripeSecretKey || process.env.STRIPE_SECRET_KEY) {
      mountBillingRoutes(app);
    } else {
      console.warn(chalk.yellow('Billing routes skipped: STRIPE_SECRET_KEY not configured'));
    }
    app.use('/api/memory', memoryApiRouter);
    app.use('/api/processes', processApiRouter);
    app.use('/api/kanban', kanbanApiRouter);
    app.use('/api/webhooks', webhookApiRouter);
    app.use('/api/documents', documentsApiRouter);
    app.use('/api/notes', notesApiRouter);
    app.use('/api/images', imagesApiRouter);
    app.use('/api/email', emailApiRouter);
    app.use('/api/packs', packsApiRouter);
    mountHostedRoutes(app);
    mountServerRoutes(app);
    if (config.hosted.stripeSecretKey || process.env.STRIPE_SECRET_KEY) {
      mountHostedWebRoutes(app);
    } else {
      console.warn(chalk.yellow('Hosted billing routes skipped: STRIPE_SECRET_KEY not configured'));
    }
    mountGatewayRoutes(app);
    mountCarinaOpsRoutes(app);
    if (config.hosted.stripeSecretKey || process.env.STRIPE_SECRET_KEY) {
      mountHostedBillingRoutes(app);
    }
    app.use('/webhooks/email', emailWebhookRouter);
    app.post('/webhooks/telegram', express.json(), async (req, res) => {
      const handled = await processTelegramWebhookUpdate(req.body);
      if (!handled) {
        res.status(404).json({ error: 'telegram gateway not running' });
        return;
      }
      res.json({ ok: true });
    });

    if (isWhatsAppConfigured()) {
      app.use('/webhooks', createWhatsAppRouter());
      logWhatsAppStatus();
    } else {
      logWhatsAppStatus();
    }

  }

  if (!localMode) {
    app.use('/pricing', express.static(PRICING_STATIC));
    app.use('/dashboard/css', express.static(path.join(DASHBOARD_STATIC, 'css')));
    app.use('/dashboard/js', express.static(path.join(DASHBOARD_STATIC, 'js')));

    const pricingHtml = decoratePageHtml(
      await fs.readFile(path.join(PRICING_STATIC, 'index.html'), 'utf-8').catch(() => null),
      carinaVersion,
    );
    const checkoutHtml = decoratePageHtml(
      await fs.readFile(path.join(PRICING_STATIC, 'checkout.html'), 'utf-8').catch(() => null),
      carinaVersion,
    );
    const successHtml = decoratePageHtml(
      await fs.readFile(path.join(PRICING_STATIC, 'success.html'), 'utf-8').catch(() => null),
      carinaVersion,
    );
    if (pricingHtml) app.get('/pricing', (_req, res) => res.type('html').send(pricingHtml));
    if (checkoutHtml) app.get('/checkout', (_req, res) => res.type('html').send(checkoutHtml));
    if (successHtml) app.get('/billing/success', (_req, res) => res.type('html').send(successHtml));

    const loginHtml = decoratePageHtml(
      await fs
        .readFile(path.join(WEB_STATIC, 'login.html'), 'utf-8')
        .catch(() => '<h1>Login page missing</h1>'),
      carinaVersion,
      { includeMitFooter: false },
    ) ?? '<h1>Login page missing</h1>';
    const hostedLoginHtml = decoratePageHtml(
      await fs
        .readFile(path.join(WEB_STATIC, 'hosted-login.html'), 'utf-8')
        .catch(() => null),
      carinaVersion,
      { includeMitFooter: false },
    );
    const hostedRegisterHtml = decoratePageHtml(
      await fs
        .readFile(path.join(WEB_STATIC, 'hosted-register.html'), 'utf-8')
        .catch(() => null),
      carinaVersion,
      { includeMitFooter: false },
    );
    const hostedForgotHtml = decoratePageHtml(
      await fs
        .readFile(path.join(WEB_STATIC, 'hosted-forgot.html'), 'utf-8')
        .catch(() => null),
      carinaVersion,
      { includeMitFooter: false },
    );
    const hostedResetHtml = decoratePageHtml(
      await fs
        .readFile(path.join(WEB_STATIC, 'hosted-reset.html'), 'utf-8')
        .catch(() => null),
      carinaVersion,
      { includeMitFooter: false },
    );
    const billingHtml = decoratePageHtml(
      await fs
        .readFile(path.join(WEB_STATIC, 'billing.html'), 'utf-8')
        .catch(() => null),
      carinaVersion,
    );
    const settingsHtml = decoratePageHtml(
      await fs
        .readFile(path.join(WEB_STATIC, 'settings.html'), 'utf-8')
        .catch(() => null),
      carinaVersion,
    );
    const securityHtml = decoratePageHtml(
      await fs
        .readFile(path.join(WEB_STATIC, 'security.html'), 'utf-8')
        .catch(() => null),
      carinaVersion,
    );
    const dashboardIndexHtml = decoratePageHtml(
      await fs
        .readFile(path.join(DASHBOARD_STATIC, 'index.html'), 'utf-8')
        .catch(() => null),
      carinaVersion,
    );

    app.get('/login', redirectIfWebAuthed, (req, res) => {
      if (isHostedRequest(req.hostname)) {
        res.redirect('/hosted-login');
        return;
      }
      res.type('html').send(loginHtml);
    });

    app.post('/login', redirectIfWebAuthed, async (req, res) => {
      if (isHostedRequest(req.hostname)) {
        res.redirect('/hosted-login');
        return;
      }
      if (!resolveWebPasswordHash().trim()) {
        res.redirect('/login?error=unset');
        return;
      }
      const clientKey = String(req.ip ?? req.socket.remoteAddress ?? 'local');
      const rate = checkAuthRateLimit('web-login', clientKey);
      if (!rate.allowed) {
        res.redirect('/login?error=rate');
        return;
      }
      const password = String(req.body?.password ?? '');
      const ok = await checkWebPassword(password);
      if (!ok) {
        recordAuthFailure('web-login', clientKey);
        res.redirect('/login?error=1');
        return;
      }
      clearAuthFailures('web-login', clientKey);
      if (await isWebTotpEnabled()) {
        req.session.webPendingTotp = true;
        req.session.webAuthed = false;
        res.redirect('/login/2fa');
        return;
      }
      req.session.webPendingTotp = false;
      req.session.webAuthed = true;
      res.redirect('/');
    });

    const login2faHtml = decoratePageHtml(
      await fs.readFile(path.join(WEB_STATIC, 'login-2fa.html'), 'utf-8').catch(() => ''),
      carinaVersion,
    );

    app.get('/login/2fa', (req, res) => {
      if (!req.session?.webPendingTotp) {
        res.redirect('/login');
        return;
      }
      res.type('html').send(login2faHtml || '<html><body><form method="post" action="/login/2fa"><input name="token" maxlength="6"><button>Verify</button></form></body></html>');
    });

    app.post('/login/2fa', async (req, res) => {
      if (!req.session?.webPendingTotp) {
        res.redirect('/login');
        return;
      }
      const { verifyTotpCode } = await import('#core/auth/web-totp.js');
      const { resolveWebTotpSecret } = await import('#core/auth/web-totp-store.js');
      const token = String(req.body?.token ?? '').trim();
      const secret = await resolveWebTotpSecret();
      if (!secret || !verifyTotpCode(secret, token)) {
        res.redirect('/login/2fa?error=1');
        return;
      }
      req.session.webPendingTotp = false;
      req.session.webAuthed = true;
      res.redirect('/');
    });

    if (hostedLoginHtml) {
      app.get('/hosted-login', redirectIfHostedAuthed, (_req, res) => {
        res.type('html').send(hostedLoginHtml);
      });
    }
    if (hostedRegisterHtml) {
      app.get('/hosted-register', redirectIfHostedAuthed, (_req, res) => {
        res.type('html').send(hostedRegisterHtml);
      });
    }
    if (hostedForgotHtml) {
      app.get('/hosted-forgot', (_req, res) => {
        res.type('html').send(hostedForgotHtml);
      });
    }
    if (hostedResetHtml) {
      app.get('/hosted-reset', (_req, res) => {
        res.type('html').send(hostedResetHtml);
      });
    }

    const mobileHtml = decoratePageHtml(
      await fs
        .readFile(path.join(WEB_STATIC, 'mobile.html'), 'utf-8')
        .catch(() => null),
      carinaVersion,
      { includeMitFooter: false },
    );
    if (mobileHtml) {
      app.get('/mobile', (_req, res) => {
        res.type('html').send(mobileHtml);
      });
    }

    app.post('/logout', (req, res) => {
      const redirectTo = isHostedRequest(req.hostname) ? '/hosted-login' : '/login';
      req.session.destroy(() => res.redirect(redirectTo));
    });

    app.get('/manifest.json', (_req, res) => {
      res.type('application/manifest+json').sendFile(path.join(WEB_STATIC, 'manifest.json'));
    });
    app.get('/service-worker.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'service-worker.js'));
    });
    app.get('/chat-turn-lifecycle.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'chat-turn-lifecycle.js'));
    });
    app.get('/i18n.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'i18n.js'));
    });
    app.get('/mobile.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'mobile.js'));
    });
    app.get('/notes.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'notes.js'));
    });
    app.get('/documents.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'documents.js'));
    });
    app.get('/images.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'images.js'));
    });
    app.get('/email.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'email.js'));
    });
    app.get('/calendar.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'calendar.js'));
    });
    app.get('/scheduled.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'scheduled.js'));
    });
    app.get('/trello.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'trello.js'));
    });
    app.get('/workspace-prefs.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'workspace-prefs.js'));
    });
    app.get('/icon.svg', (_req, res) => {
      res.type('image/svg+xml').sendFile(path.join(WEB_STATIC, 'icon.svg'));
    });
    app.get('/favicon.ico', (_req, res) => {
      res.type('image/svg+xml').sendFile(path.join(WEB_STATIC, 'icon.svg'));
    });

    app.use((req, res, next) => {
      void requireWebAuth(req, res, next);
    });

    if (billingHtml) {
      app.get('/billing', (req, res) => {
        if (!isHostedRequest(req.hostname)) {
          res.redirect('/');
          return;
        }
        res.type('html').send(billingHtml);
      });
    }
    if (settingsHtml) {
      app.get('/settings', (req, res) => {
        if (!isHostedRequest(req.hostname)) {
          res.redirect('/');
          return;
        }
        res.type('html').send(settingsHtml);
      });
    }
    if (securityHtml) {
      app.get('/security', (req, res) => {
        if (!isHostedRequest(req.hostname)) {
          res.redirect('/');
          return;
        }
        res.type('html').send(securityHtml);
      });
    }

    if (config.carinaOps.productEnabled) {
      const OPS_STATIC = path.join(WEB_STATIC, 'ops');
      app.use('/ops/assets', express.static(path.join(OPS_STATIC)));

      const sendOpsHtml = async (res: Response, fileName: string): Promise<void> => {
        const raw = await fs.readFile(path.join(OPS_STATIC, fileName), 'utf-8');
        const decorated = decoratePageHtml(raw, carinaVersion) ?? raw;
        res.type('html').send(decorated);
      };

      app.get('/ops/upgrade', requireHostedSession, (req, res) => {
        if (!isHostedRequest(req.hostname)) {
          res.status(404).send('Not found');
          return;
        }
        void sendOpsHtml(res, 'upgrade.html');
      });

      app.get('/ops', requireHostedSession, requireOpsPlanGate, (req, res) => {
        if (!isHostedRequest(req.hostname)) {
          res.status(404).send('Not found');
          return;
        }
        void sendOpsHtml(res, 'index.html');
      });

      app.get('/ops/:page', requireHostedSession, requireOpsPlanGate, (req, res) => {
        if (!isHostedRequest(req.hostname)) {
          res.status(404).send('Not found');
          return;
        }
        const page = String(req.params.page ?? '');
        const file = OPS_PAGE_FILES[page];
        if (!file) {
          res.status(404).send('Not found');
          return;
        }
        void sendOpsHtml(res, file);
      });
    }

    if (dashboardIndexHtml) {
      const serveDashboard = async (req: Request, res: Response): Promise<void> => {
        const scoutBase = scoutServiceUrl();
        if (isHostedRequest(req.hostname)) {
          if (req.hostedUser?.tier !== 'pro') {
            res.redirect('/billing');
            return;
          }
          const creds = await getTenantScoutCredentials(req.hostedUser.id, req.hostedUser.email);
          if (!creds || !scoutBase) {
            res.redirect('/security');
            return;
          }
          const escapedKey = creds.apiKey.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
          let html = dashboardIndexHtml.replace(
            '<meta name="scout-api-key" content="">',
            `<meta name="scout-api-key" content="${escapedKey}">`,
          );
          html = html.replace('<body>', '<body data-tenant-scout="true">');
          res.type('html').send(html);
          return;
        }
        if (config.labyrinth.apiKey && scoutBase) {
          const escapedKey = config.labyrinth.apiKey.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
          const html = dashboardIndexHtml.replace(
            '<meta name="scout-api-key" content="">',
            `<meta name="scout-api-key" content="${escapedKey}">`,
          );
          res.type('html').send(html);
          return;
        }
        res.redirect('/');
      };
      app.get(['/dashboard', '/dashboard/'], serveDashboard);

      const serveControl = async (req: Request, res: Response): Promise<void> => {
        if (!dashboardIndexHtml) {
          res.redirect('/');
          return;
        }
        let html = dashboardIndexHtml.replace(
          '<title>Carina Security Dashboard</title>',
          '<title>Carina Control Center</title>',
        );
        html = html.replace(
          '<p class="eyebrow" id="top-eyebrow">Labyrinth Scout</p>',
          '<p class="eyebrow" id="top-eyebrow">Carina Host</p>',
        );
        html = html.replace(
          '<h1 id="top-title">Security Dashboard</h1>',
          '<h1 id="top-title">Control Center</h1>',
        );
        html = html.replace('<body>', '<body data-control-center="true">');
        if (config.labyrinth.apiKey && scoutServiceUrl() && !isHostedRequest(req.hostname)) {
          const escapedKey = config.labyrinth.apiKey.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
          html = html.replace(
            '<meta name="scout-api-key" content="">',
            `<meta name="scout-api-key" content="${escapedKey}">`,
          );
        }
        res.type('html').send(html);
      };
      app.get(['/control', '/control/'], serveControl);
    }

    const scoutBase = scoutServiceUrl();
    if (scoutBase) {
      const http = await import('node:http');
      app.use(['/api/dashboard', '/api/events', '/api/sse', '/api/stream'], async (req, res) => {
        let apiKey = config.labyrinth.apiKey;
        if (isHostedRequest(req.hostname)) {
          if (req.hostedUser?.tier !== 'pro') {
            res.status(403).json({ error: 'Scout requires a Pro subscription' });
            return;
          }
          const creds = await getTenantScoutCredentials(req.hostedUser.id, req.hostedUser.email);
          if (!creds) {
            res.status(403).json({ error: 'Scout is not provisioned yet' });
            return;
          }
          apiKey = creds.apiKey;
        }
        if (!apiKey) {
          res.status(503).json({ error: 'Scout is not configured' });
          return;
        }
        const upstreamPath = req.originalUrl.startsWith('/api/sse')
          ? req.originalUrl.replace('/api/sse', '/api/stream')
          : req.originalUrl;
        const scoutUrl = new URL(upstreamPath, scoutBase);
        const proxyReq = http.request(scoutUrl, {
          method: req.method,
          headers: { ...req.headers, host: scoutUrl.host, 'x-scout-key': apiKey },
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
          proxyRes.pipe(res);
        });
        proxyReq.on('error', () => res.status(502).json({ error: 'Scout unreachable' }));
        req.pipe(proxyReq);
      });
    }

    mountHostedContextRoute(app);
    if (config.hosted.stripeSecretKey || process.env.STRIPE_SECRET_KEY) {
      mountHostedBillingRoutes(app);
    }
    mountHostedPushRoutes(app);
    mountHostedScoutRoutes(app);
    startScoutPushPoller();
    app.use('/api/tenant', tenantKeysRouter());
  }

  try {
    const indexPages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'index.html'), carinaVersion, { chatShell: true });
    const memoryPages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'memory.html'), carinaVersion, { workspacePage: 'memory' });
    const packsPages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'packs.html'), carinaVersion, { workspacePage: 'packs' });
    const promptPacksPages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'prompt-packs.html'), carinaVersion, { workspacePage: 'prompt-packs' });
    const playbookPages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'playbook.html'), carinaVersion, { workspacePage: 'playbook' });
    const researchPages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'research.html'), carinaVersion, { workspacePage: 'research' });
    const comparePages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'compare.html'), carinaVersion, { workspacePage: 'compare' });
    const notesPages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'notes.html'), carinaVersion, { workspacePage: 'notes' });
    const documentsPages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'documents.html'), carinaVersion, { workspacePage: 'documents' });
    const imagesPages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'images.html'), carinaVersion, { workspacePage: 'images' });
    const emailPages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'email.html'), carinaVersion, { workspacePage: 'email' });
    const calendarPages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'calendar.html'), carinaVersion, { workspacePage: 'calendar' });
    const scheduledPages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'scheduled.html'), carinaVersion, { workspacePage: 'scheduled' });
    const trelloPages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'trello.html'), carinaVersion, { workspacePage: 'trello' });
    const kanbanPages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'kanban.html'), carinaVersion, { workspacePage: 'kanban' });
    const webhooksPages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'webhooks.html'), carinaVersion, { workspacePage: 'webhooks' });
    const workspacePages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'workspace.html'), carinaVersion, { workspacePage: 'hub' });
    const marketplacePages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'marketplace.html'), carinaVersion, { workspacePage: 'packs' });
    const surfacesPages = await loadSurfaceHtmlPair(path.join(WEB_STATIC, 'surfaces.html'), carinaVersion, { workspacePage: 'hub' });
    app.get('/manifest.json', (_req, res) => {
      res.type('application/manifest+json').sendFile(path.join(WEB_STATIC, 'manifest.json'));
    });
    app.get('/service-worker.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'service-worker.js'));
    });
    app.get('/chat-turn-lifecycle.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'chat-turn-lifecycle.js'));
    });
    app.get('/i18n.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'i18n.js'));
    });
    app.get('/mobile.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'mobile.js'));
    });
    app.get('/notes.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'notes.js'));
    });
    app.get('/documents.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'documents.js'));
    });
    app.get('/images.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'images.js'));
    });
    app.get('/email.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'email.js'));
    });
    app.get('/calendar.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'calendar.js'));
    });
    app.get('/scheduled.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'scheduled.js'));
    });
    app.get('/trello.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'trello.js'));
    });
    app.get('/compare.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'compare.js'));
    });
    app.get('/research.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'research.js'));
    });
    app.get('/workspace-prefs.js', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'workspace-prefs.js'));
    });
    app.get('/icon.svg', (_req, res) => {
      res.type('image/svg+xml').sendFile(path.join(WEB_STATIC, 'icon.svg'));
    });
    app.get('/favicon.ico', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.type('image/svg+xml').sendFile(path.join(WEB_STATIC, 'icon.svg'));
    });
    app.get('/', (req, res) => {
      const html = pickSurfaceHtml(indexPages, req);
      if (!html) {
        res.status(500).send('Web UI missing');
        return;
      }
      res.type('html').send(html);
    });
    app.get('/memory', (req, res) => {
      const html = pickSurfaceHtml(memoryPages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/documents', (req, res) => {
      const html = pickSurfaceHtml(documentsPages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/notes', (req, res) => {
      const html = pickSurfaceHtml(notesPages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/images', (req, res) => {
      const html = pickSurfaceHtml(imagesPages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/email', (req, res) => {
      const html = pickSurfaceHtml(emailPages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/calendar', (req, res) => {
      const html = pickSurfaceHtml(calendarPages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/scheduled', (req, res) => {
      const html = pickSurfaceHtml(scheduledPages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/trello', (req, res) => {
      const html = pickSurfaceHtml(trelloPages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/kanban', (req, res) => {
      const html = pickSurfaceHtml(kanbanPages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/webhooks', (req, res) => {
      const html = pickSurfaceHtml(webhooksPages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/workspace', (req, res) => {
      const html = pickSurfaceHtml(workspacePages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/packs', (req, res) => {
      const html = pickSurfaceHtml(packsPages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/marketplace', (req, res) => {
      const html = pickSurfaceHtml(marketplacePages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/surfaces', (req, res) => {
      const html = pickSurfaceHtml(surfacesPages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/prompt-packs', (req, res) => {
      const html = pickSurfaceHtml(promptPacksPages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/playbook', (req, res) => {
      const html = pickSurfaceHtml(playbookPages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/cookbook', (_req, res) => {
      res.redirect(302, '/playbook');
    });
    app.get('/research', (req, res) => {
      const html = pickSurfaceHtml(researchPages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
    app.get('/compare', (req, res) => {
      const html = pickSurfaceHtml(comparePages, req);
      if (html) res.type('html').send(html);
      else res.status(404).send('Not found');
    });
  } catch {
    console.warn(chalk.yellow(`Web UI not found at ${WEB_STATIC}/index.html`));
  }

  setupChatRoutes(app);
  registerAllChannelAdapters();
  setupAcpRoutes(app);
  setupAcpIdeRoutes(app);
  mountAllChannelWebhooks(app);
  void startChannelListeners();
  logChannelStatus();

  const { setupExpressErrorHandler, captureException } = await import('#core/observability/sentry.js');
  await setupExpressErrorHandler(app);

  // Catch-all error handler - must be last
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void captureException(err);
    console.error('[web error]', err.message, err.stack?.split('\n')[1]);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

export async function startWeb(options: StartWebOptions = {}): Promise<void> {
  if (!config.web.enabled) {
    console.warn(chalk.yellow('Web gateway skipped: WEB_ENABLED=false'));
    return;
  }

  const port = options.port ?? config.web.port;
  const host = options.host;
  const localMode = options.localMode === true;
  const app = await createWebServer(options);

  await new Promise<void>((resolve) => {
    const onListen = (): void => {
      void import('#core/security/gateway-exposure.js').then(({ formatGatewayExposureWarning }) => {
        const exposureWarning = formatGatewayExposureWarning(host);
        if (exposureWarning) {
          console.warn(chalk.yellow(`\n${exposureWarning}\n`));
        }
      });
      if (localMode) {
        console.log(chalk.green(`Carina API running on http://localhost:${port}`));
        console.log(chalk.gray('  GET  /'));
        console.log(chalk.gray('  GET  /api/health'));
        console.log(chalk.gray('  GET  /api/config'));
        console.log(chalk.gray('  POST /api/chat/send'));
        resolve();
        return;
      }
      console.log(chalk.green(`Web gateway ready at http://localhost:${port}`));
      console.log(chalk.gray('  GET  /'));
      console.log(chalk.gray('  GET  /control'));
      console.log(chalk.gray('  GET  /dashboard'));
      console.log(chalk.gray('  POST /api/chat'));
      console.log(chalk.gray('  GET  /api/chat/stream'));
      console.log(chalk.gray('  POST /webhooks/email/inbound'));
      writeHostPidFile();
      resolve();
    };
    const server = host ? app.listen(port, host, onListen) : app.listen(port, onListen);
    server.on('close', () => clearHostPidFile());
    activeServers.push(server);
    attachTerminalWebSocket(server);
    if (process.env.CARINA_NODE_HOST_ENABLED === 'true') {
      void import('#core/infrastructure/node-host/ws-server.js').then(({ attachNodeWebSocketServer }) => {
        attachNodeWebSocketServer(server);
      });
    }
  });
}
