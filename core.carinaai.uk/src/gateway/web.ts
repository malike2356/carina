import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { type Express, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import chalk from 'chalk';
import { config } from '../config/index.js';
import { llm } from '../brain/llm.js';
import { emailWebhookRouter } from '../api/email-webhook.js';
import { mountHostedRoutes, mountStripeWebhook } from '../api/hosted.js';
import { subscribeRouter } from '../api/subscribe.js';
import { getRouter } from './router.js';
import { createWhatsAppRouter, isWhatsAppConfigured, logWhatsAppStatus } from './whatsapp.js';
import type { CarinaMessage } from '../types/index.js';

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_STATIC = path.join(__dirname, 'web');

async function collectResponse(generator: AsyncGenerator<string>): Promise<string> {
  let full = '';
  for await (const chunk of generator) {
    full += chunk;
  }
  return full;
}

function setupChatRoutes(app: Express): void {
  app.get('/api/providers', (_req: Request, res: Response) => {
    res.json({ providers: llm.list(), active: llm.current().name });
  });

  app.post('/api/chat', express.json(), async (req: Request, res: Response) => {
    const message = String(req.body?.message ?? '').trim();
    const externalId = String(req.body?.sessionId ?? 'anonymous');

    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const router = getRouter();
    const sessionId = await router.getSession('web', externalId);

    const carinaMsg: CarinaMessage = {
      id: String(Date.now()),
      sessionId,
      content: message,
      source: 'web',
      timestamp: new Date(),
    };

    try {
      const reply = await collectResponse(router.handle(carinaMsg));
      res.json({ reply, sessionId, provider: llm.current().name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

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

    const router = getRouter();
    const sessionId = await router.getSession('web', externalId);

    const carinaMsg: CarinaMessage = {
      id: String(Date.now()),
      sessionId,
      content: message,
      source: 'web',
      timestamp: new Date(),
    };

    try {
      for await (const chunk of router.handle(carinaMsg)) {
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

export async function startWeb(): Promise<void> {
  if (!config.web.enabled) {
    console.warn(chalk.yellow('Web gateway skipped: WEB_ENABLED=false'));
    return;
  }

  const app = express();
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    const allowedOrigin = process.env.CORS_ORIGIN ?? '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  mountStripeWebhook(app);
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use('/api/chat', chatLimiter);
  app.use('/api/subscribe', subscribeRouter);
  mountHostedRoutes(app);

  try {
    const html = await fs.readFile(path.join(WEB_STATIC, 'index.html'), 'utf-8');
    app.get('/', (_req, res) => {
      res.type('html').send(html);
    });
  } catch {
    console.warn(chalk.yellow(`Web UI not found at ${WEB_STATIC}/index.html`));
  }

  setupChatRoutes(app);
  app.use('/webhooks/email', emailWebhookRouter);

  if (isWhatsAppConfigured()) {
    app.use('/webhooks', createWhatsAppRouter());
    logWhatsAppStatus();
  } else {
    logWhatsAppStatus();
  }

  // Catch-all error handler - must be last
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[web error]', err.message, err.stack?.split('\n')[1]);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  });

  await new Promise<void>((resolve) => {
    app.listen(config.web.port, () => {
      console.log(chalk.green(`Web gateway ready at http://localhost:${config.web.port}`));
      console.log(chalk.gray('  GET  /'));
      console.log(chalk.gray('  POST /api/chat'));
      console.log(chalk.gray('  GET  /api/chat/stream'));
      console.log(chalk.gray('  POST /webhooks/email/inbound'));
      resolve();
    });
  });
}
