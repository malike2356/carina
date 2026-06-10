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
  requireWebAuth,
} from './web-auth.js';
import { enforceHostedQuota, resolveExternalId } from './hosted-chat.js';
import { isHostedRequest } from './hosted-domain.js';
import { mountHostedContextRoute, mountHostedWebRoutes } from '../api/hosted-web.js';
import { mountHostedScoutRoutes } from '../api/hosted-scout.js';
import { getTenantScoutCredentials, scoutServiceUrl } from '../billing/tenant-scout.js';
import { ensureHostedScoutHeartbeat, runWithHostedScout } from './hosted-scout.js';
import { createWhatsAppRouter, isWhatsAppConfigured, logWhatsAppStatus } from './whatsapp.js';
import { createSmsRouter, isSmsConfigured, logSmsStatus } from './sms.js';
import { channelRegistry } from './channels/channel-registry.js';
import { WebAdapter } from './channels/adapters/web-adapter.js';
import { setupAcpRoutes } from './acp.js';
import { setupAcpIdeRoutes } from './acp-ide.js';
import { mountExtraChannelWebhooks, registerExtraChannelAdapters } from './extra-channels.js';
import { tenantKeysRouter } from '../api/tenant-keys.js';
import { getUserByApiKey, verifyJwt } from '../api/hosted-auth.js';
import { mountWebContextRoute } from './web-context.js';

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
const DASHBOARD_STATIC = path.join(process.cwd(), 'public', 'dashboard');
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
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, mode: process.env.CARINA_LOCAL_MODE === 'true' ? 'local' : 'server' });
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

  app.get('/api/providers', (_req: Request, res: Response) => {
    res.json({ providers: llm.list(), active: llm.current().name });
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
        const sessionId = await router.getSession('web', externalId);
        const tenantId = await resolveTenantId(req);
        const reply = await collectResponse(router.handle({
          id: String(Date.now()),
          sessionId,
          tenantId,
          content: message,
          source: 'web',
          timestamp: new Date(),
        }));
        res.json({ reply, sessionId, provider: llm.current().name });
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
    const sessionId = await router.getSession('web', externalId);
    await router.clearSession(sessionId);
    res.json({ ok: true });
  });

  app.get('/api/chat/stream', async (req: Request, res: Response) => {
    const message = String(req.query.message ?? '').trim();

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

    try {
      await runWithHostedScout(req, async () => {
        await ensureHostedScoutHeartbeat(req);
        const router = getRouter();
        const externalId = resolveExternalId(req);
        const sessionId = await router.getSession('web', externalId);
        const tenantId = await resolveTenantId(req);
        const stream = router.handle({
          id: String(Date.now()),
          sessionId,
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
      const msg = err instanceof Error ? err.message : String(err);
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.write('data: [DONE]\n\n');
    }
    res.end();
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
    mountBillingWebhook(app);
  }
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
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
  }
  app.use('/api/chat', chatLimiter);
  if (!localMode) {
    app.use('/api/subscribe', subscribeRouter);
    mountBillingRoutes(app);
    app.use('/api/memory', memoryApiRouter);
    app.use('/api/packs', packsApiRouter);
    mountHostedRoutes(app);
    mountHostedWebRoutes(app);
    app.use('/webhooks/email', emailWebhookRouter);

    if (isWhatsAppConfigured()) {
      app.use('/webhooks', createWhatsAppRouter());
      logWhatsAppStatus();
    } else {
      logWhatsAppStatus();
    }

    if (isSmsConfigured()) {
      app.use('/webhooks', createSmsRouter());
      logSmsStatus();
    } else {
      logSmsStatus();
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
    mountHostedScoutRoutes(app);
    app.use(tenantKeysRouter());
  }

  try {
    const html = await fs.readFile(path.join(WEB_STATIC, 'index.html'), 'utf-8');
    const memoryHtml = await fs.readFile(path.join(WEB_STATIC, 'memory.html'), 'utf-8').catch(() => null);
    const packsHtml = await fs.readFile(path.join(WEB_STATIC, 'packs.html'), 'utf-8').catch(() => null);
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
  registerExtraChannelAdapters();
  setupAcpRoutes(app);
  setupAcpIdeRoutes(app);
  mountExtraChannelWebhooks(app);

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
      console.log(chalk.gray('  POST /api/chat'));
      console.log(chalk.gray('  GET  /api/chat/stream'));
      console.log(chalk.gray('  POST /webhooks/email/inbound'));
      resolve();
    };
    const server = host ? app.listen(port, host, onListen) : app.listen(port, onListen);
    activeServers.push(server);
  });
}
