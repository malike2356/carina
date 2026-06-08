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
import { checkWebPassword, redirectIfWebAuthed, requireWebAuth } from './web-auth.js';
import { createWhatsAppRouter, isWhatsAppConfigured, logWhatsAppStatus } from './whatsapp.js';
import { createSmsRouter, isSmsConfigured, logSmsStatus } from './sms.js';
import { channelRegistry } from './channels/channel-registry.js';
import { WebAdapter } from './channels/adapters/web-adapter.js';

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
const activeServers: Server[] = [];

async function collectResponse(generator: AsyncGenerator<string>): Promise<string> {
  let full = '';
  for await (const chunk of generator) {
    full += chunk;
  }
  return full;
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
    const externalId = String(req.body?.sessionId ?? 'anonymous');

    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    try {
      const router = getRouter();
      const sessionId = await router.getSession('web', externalId);
      const reply = await collectResponse(router.handleInbound('web', {
        id: String(Date.now()),
        sessionId: externalId,
        message,
      }));
      res.json({ reply, sessionId, provider: llm.current().name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  };

  app.post('/api/chat', express.json(), handleChatSend);
  app.post('/api/chat/send', express.json(), handleChatSend);

  app.post('/api/clear', express.json(), async (req: Request, res: Response) => {
    const externalId = String(req.body?.sessionId ?? '');
    if (!externalId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }
    const router = getRouter();
    const sessionId = await router.getSession('web', externalId);
    await router.clearSession(sessionId);
    res.json({ ok: true });
  });

  app.get('/api/chat/stream', async (req: Request, res: Response) => {
    const message = String(req.query.message ?? '').trim();
    const externalId = String(req.query.sessionId ?? 'anonymous');

    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const router = getRouter();
      for await (const chunk of router.handleInbound('web', {
        id: String(Date.now()),
        sessionId: externalId,
        message,
      })) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write('data: [DONE]\n\n');
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
  }
  app.use('/api/chat', chatLimiter);
  if (!localMode) {
    app.use('/api/subscribe', subscribeRouter);
    mountBillingRoutes(app);
    app.use('/api/memory', memoryApiRouter);
    app.use('/api/packs', packsApiRouter);
    mountHostedRoutes(app);
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
    const pricingHtml = await fs.readFile(path.join(PRICING_STATIC, 'index.html'), 'utf-8').catch(() => null);
    const checkoutHtml = await fs.readFile(path.join(PRICING_STATIC, 'checkout.html'), 'utf-8').catch(() => null);
    const successHtml = await fs.readFile(path.join(PRICING_STATIC, 'success.html'), 'utf-8').catch(() => null);
    if (pricingHtml) app.get('/pricing', (_req, res) => res.type('html').send(pricingHtml));
    if (checkoutHtml) app.get('/checkout', (_req, res) => res.type('html').send(checkoutHtml));
    if (successHtml) app.get('/billing/success', (_req, res) => res.type('html').send(successHtml));

    // --- Private-instance gate: blocks public chat access behind CARINA_WEB_PASSWORD ---
    const loginHtml = await fs
      .readFile(path.join(WEB_STATIC, 'login.html'), 'utf-8')
      .catch(() => '<h1>Login page missing</h1>');

    app.get('/login', redirectIfWebAuthed, (_req, res) => {
      res.type('html').send(loginHtml);
    });

    app.post('/login', redirectIfWebAuthed, async (req, res) => {
      const password = String(req.body?.password ?? '');
      const ok = await checkWebPassword(password);
      if (!ok) {
        res.redirect('/login?error=1');
        return;
      }
      req.session.webAuthed = true;
      res.redirect('/');
    });

    app.post('/logout', (req, res) => {
      req.session.destroy(() => res.redirect('/login'));
    });

    app.use(requireWebAuth);
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
