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
import {
  convertAudienceIdentityToKnown,
  createAudienceSession,
  getAudienceSessionByWidgetToken,
  isAudienceSessionUsable,
  isOriginAllowed,
  newEmbedNonce,
  signWidgetEmbedConfig,
  touchAudienceSession,
  upsertAudienceIdentity,
  verifyWidgetEmbedConfig,
  type AudienceSessionMode,
} from '../customer-concierge/audience-session.js';
import {
  assertFreshEmbedNonce,
  consumeAudienceRateBucket,
} from '../customer-concierge/audience-rate-limit.js';
import { appendSecurityAudit } from '../security/security-audit.js';

const WIDGET_LIMIT_REPLY =
  'This workspace has reached its monthly message limit. Please upgrade your plan to continue.';

const WIDGET_JS = path.join(process.cwd(), 'widget/dist/widget.js');

const SESSION_CREATE_LIMIT = 10;
const MESSAGE_LIMIT = 20;
const HOUR_MS = 60 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * HOUR_MS;

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
  }
  return req.ip ?? 'unknown';
}

function requestOrigin(req: Request): string | undefined {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.trim()) return origin.trim();
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.trim()) {
    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }
  return undefined;
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

async function resolveOriginAllowlist(
  worker: NonNullable<Awaited<ReturnType<typeof getWorkerById>>>,
): Promise<string[] | undefined> {
  const published = await getPublishedConciergeProfile(worker.id);
  const allowlist = published?.channelConfig?.web?.originAllowlist;
  return Array.isArray(allowlist) ? allowlist.map(String) : undefined;
}

function applyCors(
  req: Request,
  res: Response,
  allowlist: string[] | undefined,
): boolean {
  const origin = requestOrigin(req);
  if (!allowlist || allowlist.length === 0) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Embed-Token, X-Requested-With');
    res.setHeader('Vary', 'Origin');
    return true;
  }
  if (!isOriginAllowed(origin, allowlist)) {
    appendSecurityAudit({
      category: 'auth',
      action: 'widget_origin_denied',
      detail: `Origin denied for widget: ${origin ?? '(missing)'}`,
      metadata: { path: req.path, allowlist },
    });
    return false;
  }
  res.setHeader('Access-Control-Allow-Origin', origin!);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Embed-Token, X-Requested-With');
  res.setHeader('Vary', 'Origin');
  return true;
}

async function ensureAudienceForWidgetSession(input: {
  worker: NonNullable<Awaited<ReturnType<typeof getWorkerById>>>;
  sessionToken: string;
  contactId: string;
  origin?: string | null;
  sessionMode: AudienceSessionMode;
  locale?: string | null;
}): Promise<{ audienceSessionId: string; knowledgeSourceIds: string[] | null }> {
  const existing = await getAudienceSessionByWidgetToken(input.sessionToken);
  if (existing && isAudienceSessionUsable(existing)) {
    await touchAudienceSession(existing.id);
    const published = await getPublishedConciergeProfile(input.worker.id);
    return {
      audienceSessionId: existing.id,
      knowledgeSourceIds: published ? published.knowledgeSourceIds : null,
    };
  }

  const published = await getPublishedConciergeProfile(input.worker.id);
  const identity = await upsertAudienceIdentity({
    workspaceId: input.worker.workspaceId,
    channel: 'web',
    externalKey: `widget:${input.contactId}`,
  });
  const audience = await createAudienceSession({
    workspaceId: input.worker.workspaceId,
    workerId: input.worker.id,
    conciergeProfileId: published?.id ?? null,
    identityId: identity.id,
    channel: 'web',
    sessionMode: input.sessionMode,
    widgetSessionToken: input.sessionToken,
    origin: input.origin ?? null,
    locale: input.locale ?? null,
    ttlMs: SESSION_TTL_MS,
  });
  await pool.query(
    `UPDATE widget_sessions
     SET audience_session_id = $2,
         session_mode = $3,
         origin = $4,
         expires_at = $5,
         last_active_at = NOW()
     WHERE session_token = $1`,
    [
      input.sessionToken,
      audience.id,
      input.sessionMode,
      input.origin ?? null,
      audience.expiresAt,
    ],
  );
  return {
    audienceSessionId: audience.id,
    knowledgeSourceIds: published ? published.knowledgeSourceIds : null,
  };
}

export const widgetRouter: ExpressRouter = Router();

widgetRouter.use(async (req, res, next) => {
  try {
    const pathMatch = String(req.path || '').match(
      /^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i,
    );
    const workerId = pathMatch?.[1] ?? '';
    let allowlist: string[] | undefined;
    if (workerId) {
      const worker = await getWorkerById(workerId);
      if (worker) allowlist = await resolveOriginAllowlist(worker);
    }
    if (!applyCors(req, res, allowlist)) {
      if (req.method === 'OPTIONS') {
        res.sendStatus(403);
        return;
      }
      res.status(403).json({ error: 'Origin not allowed', code: 'origin_denied' });
      return;
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  } catch {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  }
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

/** Signed embed configuration for public sites (Prompt 701). */
widgetRouter.get('/:workerId/embed-token', async (req: Request, res: Response) => {
  const worker = await getWorkerById(String(req.params.workerId));
  if (!isActiveWorker(worker)) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  if (!(await assertWidgetSessionAllowed(worker, res))) return;

  const allowlist = await resolveOriginAllowlist(worker);
  const origin = requestOrigin(req);
  if (allowlist && allowlist.length > 0 && !isOriginAllowed(origin, allowlist)) {
    res.status(403).json({ error: 'Origin not allowed', code: 'origin_denied' });
    return;
  }

  const nonce = newEmbedNonce();
  const exp = Date.now() + 15 * 60 * 1000;
  const embedToken = signWidgetEmbedConfig({
    workerId: worker.id,
    workspaceId: worker.workspaceId,
    nonce,
    exp,
  });
  res.json({
    embedToken,
    nonce,
    exp,
    workerId: worker.id,
    workspaceId: worker.workspaceId,
  });
});

widgetRouter.post('/:workerId/session', async (req: Request, res: Response) => {
  const worker = await getWorkerById(String(req.params.workerId));
  if (!isActiveWorker(worker)) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }

  const allowlist = await resolveOriginAllowlist(worker);
  const origin = requestOrigin(req);
  if (allowlist && allowlist.length > 0 && !isOriginAllowed(origin, allowlist)) {
    res.status(403).json({ error: 'Origin not allowed', code: 'origin_denied' });
    return;
  }

  const sessionModeRaw = String(req.body?.sessionMode ?? 'public').trim().toLowerCase();
  const sessionMode: AudienceSessionMode = sessionModeRaw === 'preview' ? 'preview' : 'public';

  // When an origin allowlist is configured, require a signed embed token (replay-safe).
  if (allowlist && allowlist.length > 0) {
    const embedToken = String(
      req.body?.embedToken ?? req.headers['x-embed-token'] ?? '',
    ).trim();
    if (!embedToken) {
      res.status(401).json({ error: 'embedToken required', code: 'embed_token_required' });
      return;
    }
    const verified = verifyWidgetEmbedConfig(embedToken, worker.id);
    if (!verified || verified.workspaceId !== worker.workspaceId) {
      appendSecurityAudit({
        category: 'auth',
        action: 'widget_embed_invalid',
        detail: 'Invalid or forged embed token',
        metadata: { workerId: worker.id },
      });
      res.status(401).json({ error: 'Invalid embed token', code: 'embed_token_invalid' });
      return;
    }
    const fresh = await assertFreshEmbedNonce({
      nonce: verified.nonce,
      workerId: worker.id,
    });
    if (!fresh) {
      appendSecurityAudit({
        category: 'auth',
        action: 'widget_embed_replay',
        detail: 'Embed nonce replay rejected',
        metadata: { workerId: worker.id, nonce: verified.nonce },
      });
      res.status(401).json({ error: 'Embed token already used', code: 'embed_token_replay' });
      return;
    }
  }

  const existingToken = String(req.body?.sessionToken ?? '').trim();
  if (existingToken) {
    const found = await pool.query(
      `SELECT session_token, contact_id, audience_session_id, session_mode
       FROM widget_sessions WHERE session_token = $1 AND worker_id = $2`,
      [existingToken, worker.id],
    );
    if (found.rows.length > 0) {
      // Existing sessions stay usable after unpublish so owners can take over.
      await pool.query(
        'UPDATE widget_sessions SET last_active_at = NOW() WHERE session_token = $1',
        [existingToken],
      );
      const contactId = String(found.rows[0].contact_id);
      const ensured = await ensureAudienceForWidgetSession({
        worker,
        sessionToken: existingToken,
        contactId,
        origin,
        sessionMode: (found.rows[0].session_mode as AudienceSessionMode) || sessionMode,
        locale: req.body?.locale != null ? String(req.body.locale) : null,
      });
      const cfg = await widgetConfig(worker);
      res.json({
        sessionToken: String(found.rows[0].session_token),
        contactId,
        audienceSessionId: ensured.audienceSessionId,
        sessionMode: sessionMode,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        greeting: cfg.greeting,
        personaName: cfg.personaName,
      });
      return;
    }
  }

  if (!(await assertWidgetSessionAllowed(worker, res))) return;

  const createBucket = await consumeAudienceRateBucket({
    bucketKey: `widget:session:${worker.id}:${clientIp(req)}`,
    limit: SESSION_CREATE_LIMIT,
    windowMs: HOUR_MS,
  }).catch(() => ({ allowed: true, remaining: SESSION_CREATE_LIMIT, resetAt: new Date().toISOString() }));
  if (!createBucket.allowed) {
    res.status(429).json({ error: 'Too many sessions. Try again later.' });
    return;
  }

  const cfg = await widgetConfig(worker);
  const created = await pool.query(
    `INSERT INTO widget_sessions (worker_id, workspace_id, session_mode, origin, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING session_token, contact_id`,
    [
      worker.id,
      worker.workspaceId,
      sessionMode,
      origin ?? null,
      new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    ],
  );
  const sessionToken = String(created.rows[0].session_token);
  const contactId = String(created.rows[0].contact_id);
  const ensured = await ensureAudienceForWidgetSession({
    worker,
    sessionToken,
    contactId,
    origin,
    sessionMode,
    locale: req.body?.locale != null ? String(req.body.locale) : null,
  });

  res.status(201).json({
    sessionToken,
    contactId,
    audienceSessionId: ensured.audienceSessionId,
    sessionMode,
    workerName: cfg.workerName,
    greeting: cfg.greeting,
    personaName: cfg.personaName,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });
});

/** Anonymous → known contact conversion; preserves the same conversation. */
widgetRouter.post('/:workerId/identify', async (req: Request, res: Response) => {
  const worker = await getWorkerById(String(req.params.workerId));
  if (!isActiveWorker(worker)) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const sessionToken = String(req.body?.sessionToken ?? '').trim();
  const email = String(req.body?.email ?? '').trim();
  const displayName = req.body?.displayName != null ? String(req.body.displayName).trim() : null;
  if (!sessionToken || !email) {
    res.status(400).json({ error: 'sessionToken and email are required' });
    return;
  }
  const session = await pool.query(
    `SELECT contact_id, audience_session_id FROM widget_sessions
     WHERE session_token = $1 AND worker_id = $2`,
    [sessionToken, worker.id],
  );
  if (session.rows.length === 0) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }
  const audience = await getAudienceSessionByWidgetToken(sessionToken);
  if (!audience || audience.workspaceId !== worker.workspaceId || audience.workerId !== worker.id) {
    res.status(401).json({ error: 'Invalid audience session' });
    return;
  }
  if (!isAudienceSessionUsable(audience)) {
    res.status(401).json({ error: 'Audience session expired or blocked' });
    return;
  }
  try {
    const identity = await convertAudienceIdentityToKnown({
      workspaceId: worker.workspaceId,
      identityId: audience.identityId,
      email,
      displayName,
    });
    appendSecurityAudit({
      category: 'auth',
      action: 'audience_identify',
      detail: 'Anonymous audience converted to known contact',
      metadata: {
        workspaceId: worker.workspaceId,
        workerId: worker.id,
        audienceSessionId: audience.id,
        identityId: identity.id,
      },
    });
    res.json({
      ok: true,
      audienceSessionId: audience.id,
      identityId: identity.id,
      email: identity.email,
      displayName: identity.displayName,
      contactId: String(session.rows[0].contact_id),
      sessionToken,
    });
  } catch (err) {
    const status = Number((err as { status?: number })?.status ?? 400);
    res.status(status).json({ error: (err as Error).message || 'Identify failed' });
  }
});

widgetRouter.post('/:workerId/message', async (req: Request, res: Response) => {
  const worker = await getWorkerById(String(req.params.workerId));
  if (!isActiveWorker(worker)) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }

  const allowlist = await resolveOriginAllowlist(worker);
  const origin = requestOrigin(req);
  if (allowlist && allowlist.length > 0 && !isOriginAllowed(origin, allowlist)) {
    res.status(403).json({ error: 'Origin not allowed', code: 'origin_denied' });
    return;
  }

  const sessionToken = String(req.body?.sessionToken ?? '');
  const content = String(req.body?.message ?? req.body?.content ?? '').trim();
  if (!sessionToken || !content) {
    res.status(400).json({ error: 'sessionToken and message are required' });
    return;
  }

  const msgBucket = await consumeAudienceRateBucket({
    bucketKey: `widget:message:${worker.id}:${sessionToken}`,
    limit: MESSAGE_LIMIT,
    windowMs: HOUR_MS,
  }).catch(() => ({ allowed: true, remaining: MESSAGE_LIMIT, resetAt: new Date().toISOString() }));
  if (!msgBucket.allowed) {
    res.status(429);
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Message limit reached. Try again later.' })}\n\n`);
    res.end();
    return;
  }

  const session = await pool.query(
    `SELECT contact_id, audience_session_id, session_mode, expires_at
     FROM widget_sessions WHERE session_token = $1 AND worker_id = $2`,
    [sessionToken, worker.id],
  );
  if (session.rows.length === 0) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  // Reject forged worker binding: session must belong to this worker (already filtered).
  if (session.rows[0].expires_at && Date.parse(String(session.rows[0].expires_at)) <= Date.now()) {
    res.status(401).json({ error: 'Session expired', code: 'session_expired' });
    return;
  }

  const contactId = String(session.rows[0].contact_id);
  const sessionMode: AudienceSessionMode =
    String(session.rows[0].session_mode ?? 'public') === 'preview' ? 'preview' : 'public';

  let audienceSessionId = session.rows[0].audience_session_id
    ? String(session.rows[0].audience_session_id)
    : '';
  let knowledgeSourceIds: string[] | null = null;
  try {
    const ensured = await ensureAudienceForWidgetSession({
      worker,
      sessionToken,
      contactId,
      origin,
      sessionMode,
    });
    audienceSessionId = ensured.audienceSessionId;
    knowledgeSourceIds = ensured.knowledgeSourceIds;
  } catch {
    res.status(500).json({ error: 'Failed to bind audience session' });
    return;
  }

  const audience = await getAudienceSessionByWidgetToken(sessionToken);
  if (!audience || !isAudienceSessionUsable(audience)) {
    res.status(401).json({ error: 'Audience session expired or blocked' });
    return;
  }
  if (audience.workspaceId !== worker.workspaceId || audience.workerId !== worker.id) {
    appendSecurityAudit({
      category: 'tenant_isolation',
      action: 'widget_tenant_mismatch',
      detail: 'Audience session workspace/worker mismatch',
      metadata: {
        workerId: worker.id,
        workspaceId: worker.workspaceId,
        audienceWorkspaceId: audience.workspaceId,
        audienceWorkerId: audience.workerId,
      },
    });
    res.status(403).json({ error: 'Forbidden', code: 'tenant_mismatch' });
    return;
  }

  await pool.query(
    'UPDATE widget_sessions SET last_active_at = NOW() WHERE session_token = $1',
    [sessionToken],
  );
  await touchAudienceSession(audienceSessionId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  if (audience.status === 'handed_off') {
    const holding =
      'Thanks for your message. A human teammate has taken over this conversation and will reply here shortly.';
    res.write(`data: ${JSON.stringify({ type: 'token', content: holding })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
    return;
  }

  const limitCheck = await checkAndEnforceLimit(worker.workspaceId);
  if (!limitCheck.allowed) {
    void maybeSendUsageAlerts(worker.workspaceId).catch(() => {});
    res.write(`data: ${JSON.stringify({ type: 'token', content: WIDGET_LIMIT_REPLY })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
    return;
  }

  try {
    const { maybeInterceptInbound } = await import('../channel-shield/intercept.js');
    const shield = await maybeInterceptInbound({
      workspaceId: worker.workspaceId,
      channel: 'web',
      externalKey: worker.id,
      externalMessageId: `widget-${sessionToken}-${Date.now()}`,
      conversationId: sessionToken,
      from: { id: contactId },
      text: content,
      metadata: {
        workerId: worker.id,
        audienceSessionId,
        sessionMode,
        origin: origin ?? null,
      },
    });
    if (shield.intercepted && !shield.allowLive) {
      appendSecurityAudit({
        category: 'prompt_injection',
        action: 'widget_channel_shield_block',
        detail: `Channel Shield blocked widget message (verdict=${shield.verdict ?? 'unknown'})`,
        metadata: { workerId: worker.id, audienceSessionId, messageId: shield.messageId },
      });
      res.write(`data: ${JSON.stringify({
        type: 'token',
        content: 'Your message could not be processed right now. Please try again later.',
      })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
      return;
    }

    let finalReply = '';
    for await (const event of processAivaMessageStream({
      workerId: worker.id,
      workspaceId: worker.workspaceId,
      userMessage: content,
      channel: 'web',
      contactId,
      threadId: sessionToken,
      isWebPreviewSession: sessionMode === 'preview',
      audiencePrincipal: true,
      audienceSessionId,
      audienceSessionMode: sessionMode,
      audienceKnowledgeSourceIds: knowledgeSourceIds,
      contactMetadata: { sessionToken },
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
