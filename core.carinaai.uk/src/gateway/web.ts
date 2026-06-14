import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Server } from 'http';
import express, { type Express, type Request, type Response } from 'express';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import chalk from 'chalk';
import { config } from '../config/index.js';
import { llm } from '../brain/llm.js';
import { emailWebhookRouter } from '../api/email-webhook.js';
import { mountHostedRoutes } from '../api/hosted.js';
import { mountBillingRoutes, mountBillingWebhook } from '../api/billing-routes.js';
import { subscribeRouter } from '../api/subscribe.js';
import { memoryApiRouter } from '../api/memory-api.js';
import { packsApiRouter } from '../api/packs-api.js';
import { getRouter } from './router.js';
import {
  checkWebPassword,
  redirectIfHostedAuthed,
  redirectIfWebAuthed,
  requireHostedSession,
  requireWebAuth,
} from './web-auth.js';
import { OPS_PAGE_FILES, requireOpsPlanGate } from '../hosted/plan-gates.js';
import { mountCarinaOpsRoutes } from '../api/carina-ops-routes.js';
import { enforceHostedQuota, resolveExternalId } from './hosted-chat.js';
import { isHostedRequest } from './hosted-domain.js';
import { mountHostedContextRoute, mountHostedWebRoutes } from '../api/hosted-web.js';
import { mountHostedBillingRoutes } from '../api/hosted-billing.js';
import { mountHostedPushRoutes } from '../api/hosted-push.js';
import { mountHostedScoutRoutes } from '../api/hosted-scout.js';
import { notifyTaskPush } from '../notifications/mobile-push.js';
import { startScoutPushPoller } from '../notifications/scout-push-poller.js';
import { getTenantScoutCredentials, scoutServiceUrl } from '../billing/tenant-scout.js';
import { ensureHostedScoutHeartbeat, runWithHostedScout } from './hosted-scout.js';
import { createWhatsAppRouter, isWhatsAppConfigured, logWhatsAppStatus } from './whatsapp.js';
import { channelRegistry } from './channels/channel-registry.js';
import { WebAdapter } from './channels/adapters/web-adapter.js';
import { setupAcpRoutes } from './acp.js';
import { setupAcpIdeRoutes } from './acp-ide.js';
import {
  mountAllChannelWebhooks,
  registerAllChannelAdapters,
  startChannelListeners,
  logChannelStatus,
} from './channel-bootstrap.js';
import { tenantKeysRouter } from '../api/tenant-keys.js';
import { getUserByApiKey, verifyJwt } from '../api/hosted-auth.js';
import { mountWebContextRoute } from './web-context.js';
import { mountOpsRoutes } from '../api/ops-routes.js';
import { mountControlRoutes } from '../api/control-routes.js';
import { mountPairingRoutes } from '../api/pairing-routes.js';
import { writeHostPidFile, clearHostPidFile } from '../infrastructure/host-service.js';
import { pairedDeviceFromRequest } from '../infrastructure/control-auth.js';

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_STATIC = path.join(__dirname, 'web');
const PRICING_STATIC = path.join(__dirname, '..', 'web', 'pricing');
const DASHBOARD_STATIC = path.join(__dirname, '../..', 'public', 'dashboard');
const activeServers: Server[] = [];

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
  const jwtUser = verifyJwt(token);
  if (jwtUser) return jwtUser.userId;
  const apiUser = await getUserByApiKey(token);
  return apiUser?.id;
}

function setupChatRoutes(app: Express): void {
  app.get('/api/health', async (_req: Request, res: Response) => {
    const device = pairedDeviceFromRequest(_req);
    res.json({
      ok: true,
      mode: process.env.CARINA_LOCAL_MODE === 'true' ? 'local' : 'server',
      service: 'carina-gateway',
      pairedDevice: device ? { id: device.id, name: device.name } : undefined,
    });
  });

  app.get('/api/config', (_req: Request, res: Response) => {
    let activeProvider = '';
    try {
      activeProvider = llm.current().name;
    } catch {
      activeProvider = '';
    }
    res.json({
      provider: activeProvider,
      providers: llm.list(),
      web: { port: config.web.port },
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
    try {
      await runWithHostedScout(req, async () => {
        await ensureHostedScoutHeartbeat(req);
        const router = getRouter();
        const externalId = resolveExternalId(req);
        const webSession = await router.startWebSession(externalId);
        const tenantId = await resolveTenantId(req);
        const stream = router.handle({
          id: String(Date.now()),
          sessionId: webSession.sessionId,
          agentId: webSession.agentId,
          tenantId,
          content: message,
          source: 'web',
          timestamp: new Date(),
        });
        for await (const chunk of stream) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        res.write('data: [DONE]\n\n');
      });
    } catch (err) {
      streamFailed = true;
      const msg = err instanceof Error ? err.message : String(err);
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.write('data: [DONE]\n\n');
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
}

export async function startWeb(options: StartWebOptions = {}): Promise<void> {
  if (!config.web.enabled) {
    console.warn(chalk.yellow('Web gateway skipped: WEB_ENABLED=false'));
    return;
  }

  const port = options.port ?? config.web.port;
  const host = options.host;
  const localMode = options.localMode === true;
  if (localMode) process.env.CARINA_LOCAL_MODE = 'true';

  const app = express();
  channelRegistry.register(new WebAdapter(config.web.enabled));
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    const allowedOrigin = process.env.CORS_ORIGIN ?? '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
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
  }
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  mountOpsRoutes(app);
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
    mountWebContextRoute(app);
    mountControlRoutes(app);
    mountPairingRoutes(app);
    if (process.env.CARINA_NODE_HOST_ENABLED === 'true') {
      const { mountNodeHostRoutes } = await import('../infrastructure/node-host/routes.js');
      mountNodeHostRoutes(app);
    }
  }
  app.use('/api/chat', chatLimiter);
  if (!localMode) {
    app.use('/api/subscribe', subscribeRouter);
    if (config.hosted.stripeSecretKey || process.env.STRIPE_SECRET_KEY) {
      mountBillingRoutes(app);
    } else {
      console.warn(chalk.yellow('Billing routes skipped: STRIPE_SECRET_KEY not configured'));
    }
    app.use('/api/memory', memoryApiRouter);
    app.use('/api/packs', packsApiRouter);
    mountHostedRoutes(app);
    if (config.hosted.stripeSecretKey || process.env.STRIPE_SECRET_KEY) {
      mountHostedWebRoutes(app);
    } else {
      console.warn(chalk.yellow('Hosted billing routes skipped: STRIPE_SECRET_KEY not configured'));
    }
    mountCarinaOpsRoutes(app);
    if (config.hosted.stripeSecretKey || process.env.STRIPE_SECRET_KEY) {
      mountHostedBillingRoutes(app);
    }
    app.use('/webhooks/email', emailWebhookRouter);

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

    const pricingHtml = await fs.readFile(path.join(PRICING_STATIC, 'index.html'), 'utf-8').catch(() => null);
    const checkoutHtml = await fs.readFile(path.join(PRICING_STATIC, 'checkout.html'), 'utf-8').catch(() => null);
    const successHtml = await fs.readFile(path.join(PRICING_STATIC, 'success.html'), 'utf-8').catch(() => null);
    if (pricingHtml) app.get('/pricing', (_req, res) => res.type('html').send(pricingHtml));
    if (checkoutHtml) app.get('/checkout', (_req, res) => res.type('html').send(checkoutHtml));
    if (successHtml) app.get('/billing/success', (_req, res) => res.type('html').send(successHtml));

    const loginHtml = await fs
      .readFile(path.join(WEB_STATIC, 'login.html'), 'utf-8')
      .catch(() => '<h1>Login page missing</h1>');
    const hostedLoginHtml = await fs
      .readFile(path.join(WEB_STATIC, 'hosted-login.html'), 'utf-8')
      .catch(() => null);
    const hostedRegisterHtml = await fs
      .readFile(path.join(WEB_STATIC, 'hosted-register.html'), 'utf-8')
      .catch(() => null);
    const hostedForgotHtml = await fs
      .readFile(path.join(WEB_STATIC, 'hosted-forgot.html'), 'utf-8')
      .catch(() => null);
    const hostedResetHtml = await fs
      .readFile(path.join(WEB_STATIC, 'hosted-reset.html'), 'utf-8')
      .catch(() => null);
    const billingHtml = await fs
      .readFile(path.join(WEB_STATIC, 'billing.html'), 'utf-8')
      .catch(() => null);
    const settingsHtml = await fs
      .readFile(path.join(WEB_STATIC, 'settings.html'), 'utf-8')
      .catch(() => null);
    const securityHtml = await fs
      .readFile(path.join(WEB_STATIC, 'security.html'), 'utf-8')
      .catch(() => null);
    const dashboardIndexHtml = await fs
      .readFile(path.join(DASHBOARD_STATIC, 'index.html'), 'utf-8')
      .catch(() => null);

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
      const password = String(req.body?.password ?? '');
      const ok = await checkWebPassword(password);
      if (!ok) {
        res.redirect('/login?error=1');
        return;
      }
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

    app.post('/logout', (req, res) => {
      const redirectTo = isHostedRequest(req.hostname) ? '/hosted-login' : '/login';
      req.session.destroy(() => res.redirect(redirectTo));
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

      app.get('/ops/upgrade', requireHostedSession, (req, res) => {
        if (!isHostedRequest(req.hostname)) {
          res.status(404).send('Not found');
          return;
        }
        res.sendFile(path.join(OPS_STATIC, 'upgrade.html'));
      });

      app.get('/ops', requireHostedSession, requireOpsPlanGate, (req, res) => {
        if (!isHostedRequest(req.hostname)) {
          res.status(404).send('Not found');
          return;
        }
        res.sendFile(path.join(OPS_STATIC, 'index.html'));
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
        res.sendFile(path.join(OPS_STATIC, file));
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
    const html = await fs.readFile(path.join(WEB_STATIC, 'index.html'), 'utf-8');
    const memoryHtml = await fs.readFile(path.join(WEB_STATIC, 'memory.html'), 'utf-8').catch(() => null);
    const packsHtml = await fs.readFile(path.join(WEB_STATIC, 'packs.html'), 'utf-8').catch(() => null);
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
    app.get('/icon.svg', (_req, res) => {
      res.type('image/svg+xml').sendFile(path.join(WEB_STATIC, 'icon.svg'));
    });
    app.get('/', (_req, res) => {
      res.type('html').send(html);
    });
    if (memoryHtml) {
      app.get('/memory', (_req, res) => {
        res.type('html').send(memoryHtml);
      });
    }
    if (packsHtml) {
      app.get('/packs', (_req, res) => {
        res.type('html').send(packsHtml);
      });
    }
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

  // Catch-all error handler - must be last
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[web error]', err.message, err.stack?.split('\n')[1]);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  });

  await new Promise<void>((resolve) => {
    const onListen = (): void => {
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
  });
}
