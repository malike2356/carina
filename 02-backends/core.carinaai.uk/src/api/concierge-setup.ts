// Concierge setup wizard API (Prompt 698).
import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { getWorker } from '../workers/worker-store.js';
import { listKnowledgeEntries } from '../workers/knowledge-base.js';
import { upsertToolSession, getToolSession } from '../workers/product-tools/sessions.js';
import {
  buildGoogleToolsAuthUrl,
  isGoogleToolsOAuthConfigured,
} from '../workers/product-tools/google-tools-oauth.js';
import {
  buildZoomAuthUrl,
  exchangeZoomCode,
  isZoomOAuthConfigured,
  resolveZoomRedirectUri,
} from '../workers/product-tools/zoom-oauth.js';
import { signZoomOAuthState, verifyZoomOAuthState } from '../workers/product-tools/zoom-oauth-state.js';
import { credentialsConfigured } from '../channels/credential-store.js';
import {
  evaluateConciergeReadiness,
  getConciergeProfile,
  publishConciergeProfile,
  publicWidgetEmbed,
  unpublishConciergeProfile,
  upsertConciergeStep1,
  upsertConciergeStep2,
  type CalendarProvider,
  type ConferencingProvider,
  type ConciergeBusinessHours,
  type ConciergeChannelConfig,
} from '../workers/concierge-profile.js';
import { evaluateProviderReadiness } from '../customer-concierge/readiness.js';
import { pool } from '../memory/db.js';

export const conciergeSetupRouter: ExpressRouter = Router({ mergeParams: true });

type ConciergeRequest = Request & { workspaceId?: string };

function workerIdFrom(req: ConciergeRequest): string {
  const raw = req.params.id ?? req.params.workerId;
  return Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '');
}

function workspaceIdFrom(req: ConciergeRequest): string {
  return String(req.workspaceId ?? '').trim();
}

async function requireWorker(req: ConciergeRequest, res: Response) {
  const workspaceId = workspaceIdFrom(req);
  const workerId = workerIdFrom(req);
  if (!workspaceId || !workerId) {
    res.status(400).json({ error: 'workspaceId and workerId are required' });
    return null;
  }
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return null;
  }
  return { workspaceId, workerId, worker };
}

async function buildActionRequired(
  workspaceId: string,
  workerId: string,
  calendarProvider: CalendarProvider | null | undefined,
  conferencingProvider: ConferencingProvider | null | undefined,
): Promise<Array<{ type: string; label: string; authUrl?: string; message?: string }>> {
  const actions: Array<{ type: string; label: string; authUrl?: string; message?: string }> = [];
  const returnPath = `/aiva/workers/${workerId}?tab=concierge`;

  if (calendarProvider === 'google' || conferencingProvider === 'google_meet') {
    const session = await getToolSession(workspaceId, workerId, 'google-calendar');
    if (!session || Object.keys(session.credentials).length === 0) {
      if (isGoogleToolsOAuthConfigured()) {
        try {
          const built = buildGoogleToolsAuthUrl({
            workspaceId,
            workerId,
            toolSlug: 'google-calendar',
            returnPath,
          });
          actions.push({
            type: 'oauth',
            label: 'Connect Google Calendar',
            authUrl: built.authUrl,
          });
        } catch (err) {
          actions.push({
            type: 'oauth',
            label: 'Connect Google Calendar',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } else {
        actions.push({
          type: 'oauth',
          label: 'Connect Google Calendar',
          message: 'Google OAuth is not configured on this server',
        });
      }
    }
  }

  if (calendarProvider === 'microsoft' || calendarProvider === 'caldav') {
    const session = await getToolSession(workspaceId, workerId, `calendar-${calendarProvider}`);
    if (!session || Object.keys(session.credentials).length === 0) {
      actions.push({
        type: 'manual',
        label: `Connect ${calendarProvider === 'microsoft' ? 'Microsoft' : 'CalDAV'} calendar`,
        message: 'Save calendar credentials via Tools, then re-check readiness.',
      });
    }
  }

  if (conferencingProvider === 'zoom') {
    const session = await getToolSession(workspaceId, workerId, 'zoom');
    if (!session || Object.keys(session.credentials).length === 0) {
      if (isZoomOAuthConfigured()) {
        try {
          const redirectUri = resolveZoomRedirectUri();
          const state = signZoomOAuthState({
            workspaceId,
            workerId,
            redirectUri,
            returnPath,
          });
          const built = buildZoomAuthUrl({ state, redirectUri });
          actions.push({
            type: 'oauth',
            label: 'Connect Zoom',
            authUrl: built.authUrl,
          });
        } catch (err) {
          actions.push({
            type: 'oauth',
            label: 'Connect Zoom',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } else {
        actions.push({
          type: 'manual',
          label: 'Connect Zoom',
          message: 'Paste a Zoom OAuth access token below, or set ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET.',
        });
      }
    }
  }

  return actions;
}

conciergeSetupRouter.post('/setup/step1', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    const personaName = String(req.body?.personaName ?? '').trim();
    const greetingMessage = String(req.body?.greetingMessage ?? '').trim();
    const businessName = String(req.body?.businessName ?? '').trim();
    const businessDescription = String(req.body?.businessDescription ?? '').trim();
    const escalationEmail = String(req.body?.escalationEmail ?? '').trim();
    const knowledgeSourceIds = Array.isArray(req.body?.knowledgeSourceIds)
      ? req.body.knowledgeSourceIds.map(String)
      : [];

    if (!personaName || !greetingMessage || !businessName || !businessDescription || !escalationEmail) {
      res.status(400).json({
        error: 'personaName, greetingMessage, businessName, businessDescription, and escalationEmail are required',
      });
      return;
    }
    if (!escalationEmail.includes('@')) {
      res.status(400).json({ error: 'escalationEmail must be a valid email' });
      return;
    }

    const profile = await upsertConciergeStep1({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
      personaName,
      greetingMessage,
      businessName,
      businessDescription,
      knowledgeSourceIds,
      escalationEmail,
    });
    res.json({ profile, nextStep: 2 });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.post('/setup/step2', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;

    const channels = (req.body?.channels ?? {}) as ConciergeChannelConfig;
    const channelEnabled = Boolean(
      channels.web?.enabled
      || channels.telegram?.enabled
      || channels.whatsapp?.enabled
      || channels.email?.enabled,
    );
    if (!channelEnabled) {
      res.status(400).json({ error: 'At least one channel must be enabled' });
      return;
    }

    const businessHours = req.body?.businessHours as ConciergeBusinessHours | undefined;
    if (!businessHours?.timezone || !Array.isArray(businessHours.windows)) {
      res.status(400).json({ error: 'businessHours with timezone and windows is required' });
      return;
    }

    const calendarProvider = (req.body?.calendarProvider ?? null) as CalendarProvider | null;
    const conferencingProvider = (req.body?.conferencingProvider ?? null) as ConferencingProvider | null;
    const meetingTypes = Array.isArray(req.body?.meetingTypes)
      ? req.body.meetingTypes.map((mt: { name?: string; durationMinutes?: number; description?: string }) => ({
          name: String(mt.name ?? '').trim(),
          durationMinutes: Number(mt.durationMinutes ?? 30),
          description: mt.description ? String(mt.description) : undefined,
        })).filter((mt: { name: string }) => mt.name)
      : [];

    if (meetingTypes.length > 0 && !calendarProvider) {
      res.status(400).json({ error: 'calendarProvider is required when meeting types are set' });
      return;
    }
    if (conferencingProvider && meetingTypes.length === 0) {
      res.status(400).json({ error: 'Add at least one meeting type when conferencing is enabled' });
      return;
    }

    const profile = await upsertConciergeStep2({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
      channels,
      businessHours,
      calendarProvider,
      conferencingProvider,
      meetingTypes,
    });

    const actionRequired = await buildActionRequired(
      ctx.workspaceId,
      ctx.workerId,
      calendarProvider,
      conferencingProvider,
    );
    const readiness = await evaluateConciergeReadiness(ctx.workspaceId, ctx.workerId);
    res.json({ profile, actionRequired, readiness });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.get('/profile', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    const profile = await getConciergeProfile(ctx.workspaceId, ctx.workerId);
    const readiness = await evaluateConciergeReadiness(ctx.workspaceId, ctx.workerId);
    const knowledge = await listKnowledgeEntries(ctx.workerId);
    const embed = profile?.published ? publicWidgetEmbed(ctx.workerId) : null;

    let conversationCountToday = 0;
    let bookingCountToday = 0;
    try {
      const conv = await pool.query(
        `SELECT COUNT(*)::int AS c FROM widget_sessions
         WHERE worker_id = $1 AND created_at >= date_trunc('day', NOW())`,
        [ctx.workerId],
      );
      conversationCountToday = Number(conv.rows[0]?.c ?? 0);
    } catch {
      conversationCountToday = 0;
    }
    try {
      const book = await pool.query(
        `SELECT COUNT(*)::int AS c FROM vical_bookings
         WHERE worker_id = $1 AND created_at >= date_trunc('day', NOW())`,
        [ctx.workerId],
      );
      bookingCountToday = Number(book.rows[0]?.c ?? 0);
    } catch {
      bookingCountToday = 0;
    }

    res.json({
      profile,
      readiness,
      knowledge: knowledge.map((k) => ({
        id: k.id,
        title: k.title,
        type: k.type,
        enabled: k.enabled,
      })),
      embed,
      stats: { conversationCountToday, bookingCountToday },
      zoomOAuthConfigured: isZoomOAuthConfigured(),
      googleOAuthConfigured: isGoogleToolsOAuthConfigured(),
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.get('/readiness', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    const readiness = await evaluateConciergeReadiness(ctx.workspaceId, ctx.workerId);
    const providers = await evaluateProviderReadiness({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
    });
    res.json({ ...readiness, providers });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.get('/providers/readiness', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    const providers = await evaluateProviderReadiness({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
    });
    res.json(providers);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.post('/publish', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    const profile = await publishConciergeProfile(ctx.workspaceId, ctx.workerId);
    const embed = publicWidgetEmbed(ctx.workerId);
    res.json({ profile, ...embed });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    const readiness = (err as { readiness?: unknown }).readiness;
    res.status(status).json({
      error: err instanceof Error ? err.message : String(err),
      readiness,
    });
  }
});

conciergeSetupRouter.post('/unpublish', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    const profile = await unpublishConciergeProfile(ctx.workspaceId, ctx.workerId);
    res.json({
      profile,
      message: 'Concierge unpublished. Existing conversations remain available; new widget sessions are blocked.',
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/** Store Zoom tokens in the product-tool credential store (Prompt 698 connection UI). */
conciergeSetupRouter.post('/connections/zoom', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    if (!credentialsConfigured()) {
      res.status(503).json({ error: 'CHANNEL_CREDENTIAL_KEY is not configured' });
      return;
    }
    const accessToken = String(req.body?.accessToken ?? '').trim();
    const refreshToken = String(req.body?.refreshToken ?? '').trim();
    if (!accessToken) {
      res.status(400).json({ error: 'accessToken is required' });
      return;
    }
    await upsertToolSession({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
      toolSlug: 'zoom',
      provider: 'zoom',
      credentials: {
        access_token: accessToken,
        ...(refreshToken ? { refresh_token: refreshToken } : {}),
      },
      meta: { connectedVia: 'concierge-setup' },
    });
    const readiness = await evaluateConciergeReadiness(ctx.workspaceId, ctx.workerId);
    res.json({ connected: true, readiness });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.get('/connections/zoom/auth-url', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    if (!isZoomOAuthConfigured()) {
      res.status(503).json({ error: 'Zoom OAuth is not configured on this server' });
      return;
    }
    const returnPath =
      typeof req.query.returnPath === 'string'
        ? req.query.returnPath
        : `/aiva/workers/${ctx.workerId}?tab=concierge`;
    const redirectUri = resolveZoomRedirectUri(
      typeof req.query.redirectUri === 'string' ? req.query.redirectUri : undefined,
    );
    const state = signZoomOAuthState({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
      redirectUri,
      returnPath,
    });
    const built = buildZoomAuthUrl({ state, redirectUri });
    res.json({ authUrl: built.authUrl, redirectUri });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.post('/connections/zoom/callback', async (req: ConciergeRequest, res: Response) => {
  try {
    if (!credentialsConfigured()) {
      res.status(503).json({ error: 'CHANNEL_CREDENTIAL_KEY is not configured' });
      return;
    }
    if (!isZoomOAuthConfigured()) {
      res.status(503).json({ error: 'Zoom OAuth is not configured on this server' });
      return;
    }
    const code = String(req.body?.code ?? '').trim();
    const state = String(req.body?.state ?? '').trim();
    if (!code || !state) {
      res.status(400).json({ error: 'code and state are required' });
      return;
    }
    const parsed = verifyZoomOAuthState(state);
    if (!parsed) {
      res.status(400).json({ error: 'Invalid or expired OAuth state' });
      return;
    }
    const tokens = await exchangeZoomCode({ code, redirectUri: parsed.redirectUri });
    await upsertToolSession({
      workspaceId: parsed.workspaceId,
      workerId: parsed.workerId,
      toolSlug: 'zoom',
      provider: 'zoom',
      credentials: {
        access_token: tokens.accessToken,
        ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
      },
      meta: { connectedVia: 'zoom-oauth', expiresIn: tokens.expiresIn },
      expiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null,
    });
    res.json({
      connected: true,
      returnPath: parsed.returnPath ?? `/aiva/workers/${parsed.workerId}?tab=concierge`,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
