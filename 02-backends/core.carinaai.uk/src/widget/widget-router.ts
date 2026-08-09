import path from 'node:path';
import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { pool } from '../memory/db.js';
import { getWorkspaceBranding } from '../workspace/workspace-router.js';
import { processAivaMessageStream } from '../workers/aiva-process-message.js';
import { getWorkerById } from '../workers/worker-store.js';
import {
  getConciergeProfile,
  getPublishedConciergeProfile,
} from '../workers/concierge-profile.js';
import {
  checkAndEnforceLimit,
  incrementMessageCount,
  maybeSendUsageAlerts,
} from '../usage/usage-service.js';

const WIDGET_LIMIT_REPLY =
  'This workspace has reached its monthly message limit. Please upgrade your plan to continue.';

const WIDGET_JS = path.join(process.cwd(), 'widget/dist/widget.js');

const SESSION_CREATE_LIMIT = 10;
const MESSAGE_LIMIT = 20;
const HOUR_MS = 60 * 60 * 1000;

const sessionCreatesByIp = new Map<string, { count: number; resetAt: number }>();
const messagesBySession = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
  }
  return req.ip ?? 'unknown';
}

function rateLimit(
  map: Map<string, { count: number; resetAt: number }>,
  key: string,
  limit: number,
): boolean {
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || now >= entry.resetAt) {
    map.set(key, { count: 1, resetAt: now + HOUR_MS });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

function isActiveWorker(worker: Awaited<ReturnType<typeof getWorkerById>>): worker is NonNullable<typeof worker> {
  return Boolean(worker && worker.status === 'active');
}

async function widgetConfig(worker: NonNullable<Awaited<ReturnType<typeof getWorkerById>>>) {
  const published = await getPublishedConciergeProfile(worker.id);
  const widgetSettings = worker.workerConfig?.widget;
  const welcomeMessage = published?.greetingMessage?.trim()
    || widgetSettings?.welcomeMessage?.trim()
    || `Hi, I am ${worker.name}. How can I help?`;
  const displayName = published?.personaName?.trim() || worker.name;
  const branding = await getWorkspaceBranding(worker.workspaceId);
  const companyName = published?.businessName?.trim()
    || branding.companyName
    || worker.name;
  const hideAttribution = branding.hideVerloxAttribution;
  const accentColor = widgetSettings?.accentColor?.trim() || branding.primaryColor;
  return {
    workerName: displayName,
    workerRole: published?.businessDescription?.trim() || worker.roleDescription,
    welcomeMessage,
    accentColor,
    workspaceName: companyName,
    companyName,
    logoUrl: branding.logoUrl,
    hideAttribution,
    poweredByLabel: hideAttribution ? '' : 'Powered by VERLOX',
    name: displayName,
    role: published?.businessDescription?.trim() || worker.roleDescription,
    greeting: welcomeMessage,
    personaName: published?.personaName ?? null,
    conciergePublished: Boolean(published),
  };
}

/**
 * Owner-assistant workers (no concierge_profiles row) keep legacy widget access.
 * Workers with a concierge profile only accept new sessions when published.
 */
async function assertWidgetSessionAllowed(
  worker: NonNullable<Awaited<ReturnType<typeof getWorkerById>>>,
  res: Response,
): Promise<boolean> {
  const profile = await getConciergeProfile(worker.workspaceId, worker.id);
  if (!profile) return true;
  if (profile.published) return true;
  res.status(404).json({
    error: 'This concierge is not available right now.',
    code: 'concierge_unpublished',
  });
  return false;
}

export const widgetRouter: ExpressRouter = Router();

widgetRouter.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

widgetRouter.get('/:workerId/config', async (req: Request, res: Response) => {
  const worker = await getWorkerById(String(req.params.workerId));
  if (!isActiveWorker(worker)) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  if (!(await assertWidgetSessionAllowed(worker, res))) return;
  res.json(await widgetConfig(worker));
});

widgetRouter.post('/:workerId/session', async (req: Request, res: Response) => {
  const worker = await getWorkerById(String(req.params.workerId));
  if (!isActiveWorker(worker)) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }

  const existingToken = String(req.body?.sessionToken ?? '').trim();
  if (existingToken) {
    const found = await pool.query(
      'SELECT session_token, contact_id FROM widget_sessions WHERE session_token = $1 AND worker_id = $2',
      [existingToken, worker.id],
    );
    if (found.rows.length > 0) {
      // Existing sessions stay usable after unpublish so owners can take over.
      await pool.query(
        'UPDATE widget_sessions SET last_active_at = NOW() WHERE session_token = $1',
        [existingToken],
      );
      const cfg = await widgetConfig(worker);
      res.json({
        sessionToken: String(found.rows[0].session_token),
        contactId: String(found.rows[0].contact_id),
        expiresAt: new Date(Date.now() + 30 * 24 * HOUR_MS).toISOString(),
        greeting: cfg.greeting,
        personaName: cfg.personaName,
      });
      return;
    }
  }

  if (!(await assertWidgetSessionAllowed(worker, res))) return;

  if (!rateLimit(sessionCreatesByIp, clientIp(req), SESSION_CREATE_LIMIT)) {
    res.status(429).json({ error: 'Too many sessions. Try again later.' });
    return;
  }

  const cfg = await widgetConfig(worker);
  const created = await pool.query(
    `INSERT INTO widget_sessions (worker_id, workspace_id)
     VALUES ($1, $2)
     RETURNING session_token, contact_id`,
    [worker.id, worker.workspaceId],
  );
  res.status(201).json({
    sessionToken: String(created.rows[0].session_token),
    contactId: String(created.rows[0].contact_id),
    workerName: cfg.workerName,
    greeting: cfg.greeting,
    personaName: cfg.personaName,
    expiresAt: new Date(Date.now() + 30 * 24 * HOUR_MS).toISOString(),
  });
});

widgetRouter.post('/:workerId/message', async (req: Request, res: Response) => {
  const worker = await getWorkerById(String(req.params.workerId));
  if (!isActiveWorker(worker)) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }

  const sessionToken = String(req.body?.sessionToken ?? '');
  const content = String(req.body?.message ?? req.body?.content ?? '').trim();
  if (!sessionToken || !content) {
    res.status(400).json({ error: 'sessionToken and message are required' });
    return;
  }

  if (!rateLimit(messagesBySession, sessionToken, MESSAGE_LIMIT)) {
    res.status(429);
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Message limit reached. Try again later.' })}\n\n`);
    res.end();
    return;
  }

  const session = await pool.query(
    'SELECT contact_id FROM widget_sessions WHERE session_token = $1 AND worker_id = $2',
    [sessionToken, worker.id],
  );
  if (session.rows.length === 0) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  const contactId = String(session.rows[0].contact_id);
  await pool.query(
    'UPDATE widget_sessions SET last_active_at = NOW() WHERE session_token = $1',
    [sessionToken],
  );

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const limitCheck = await checkAndEnforceLimit(worker.workspaceId);
  if (!limitCheck.allowed) {
    void maybeSendUsageAlerts(worker.workspaceId).catch(() => {});
    res.write(`data: ${JSON.stringify({ type: 'token', content: WIDGET_LIMIT_REPLY })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
    return;
  }

  try {
    let finalReply = '';
    for await (const event of processAivaMessageStream({
      workerId: worker.id,
      workspaceId: worker.workspaceId,
      userMessage: content,
      channel: 'web',
      contactId,
      threadId: sessionToken,
      isWebPreviewSession: true,
    })) {
      if (event.type === 'token') {
        finalReply += event.content;
        res.write(`data: ${JSON.stringify({ type: 'token', content: event.content })}\n\n`);
      } else if (event.type === 'replace') {
        finalReply = event.content;
        res.write(`data: ${JSON.stringify({ type: 'replace', content: event.content })}\n\n`);
      }
    }

    if (finalReply) {
      await incrementMessageCount(worker.workspaceId);
      void maybeSendUsageAlerts(worker.workspaceId).catch(() => {});
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Something went wrong.' })}\n\n`);
    res.end();
  }
});

export function mountWidgetRoutes(app: import('express').Express): void {
  app.get('/widget.js', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(WIDGET_JS, (err) => {
      if (err && !res.headersSent) {
        res.status(404).send('// widget bundle not built');
      }
    });
  });
  app.use('/api/widget', widgetRouter);
}
