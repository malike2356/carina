// Concierge setup wizard API (Prompt 698).
import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { getWorker } from '../workers/worker-store.js';
import { listKnowledgeEntries } from '../workers/knowledge-base.js';
import { upsertToolSession, getToolSession, deleteToolSession, markSessionProbe } from '../workers/product-tools/sessions.js';
import {
  buildGoogleToolsAuthUrl,
  isGoogleToolsOAuthConfigured,
} from '../workers/product-tools/google-tools-oauth.js';
import {
  buildZoomAuthUrl,
  exchangeZoomCode,
  fetchZoomAccountIdentity,
  isZoomOAuthConfigured,
  resolveZoomRedirectUri,
  revokeZoomToken,
} from '../workers/product-tools/zoom-oauth.js';
import { signZoomOAuthState, verifyZoomOAuthState } from '../workers/product-tools/zoom-oauth-state.js';
import { credentialsConfigured } from '../channels/credential-store.js';
import {
  evaluateConciergeReadiness,
  getConciergeProfile,
  publishConciergeProfile,
  publicWidgetEmbed,
  unpublishConciergeProfile,
  upsertConciergePolicy,
  upsertConciergeStep1,
  upsertConciergeStep2,
  type BookingPermission,
  type CalendarProvider,
  type ConferencingProvider,
  type ConciergeBusinessHours,
  type ConciergeChannelConfig,
} from '../workers/concierge-profile.js';
import { evaluateProviderReadiness } from '../customer-concierge/readiness.js';
import {
  listKnowledgeRevisions,
  setKnowledgePublishState,
  type KnowledgePublishState,
} from '../customer-concierge/published-knowledge.js';
import {
  addInternalNote,
  getSupportCase,
  listInternalNotes,
  listSupportCases,
  updateSupportCaseStatus,
  type SupportCaseStatus,
} from '../customer-concierge/support-cases.js';
import {
  operatorTakeover,
  releaseToAiva,
} from '../customer-concierge/handoff.js';
import { listOperatorInbox, getOperatorInboxDetail } from '../customer-concierge/operator-inbox.js';
import { buildCrmTimeline, getBookingEvidence } from '../customer-concierge/crm-timeline.js';
import { buildConciergeAnalytics } from '../customer-concierge/analytics.js';
import { operatorResumeEnrollment } from '../customer-concierge/outreach-hooks.js';
import { listBookings } from '../vical/bookings.js';
import { bookingInvitationView } from '../vical/calendar/reconcile.js';
import { getConferenceArtifact } from '../vical/saga/ledger.js';
import { getCalendarProjection } from '../vical/calendar/projection-store.js';
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
        publishState: k.publishState,
        revision: k.revision,
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
    const identity = await fetchZoomAccountIdentity(tokens.accessToken);
    await upsertToolSession({
      workspaceId: parsed.workspaceId,
      workerId: parsed.workerId,
      toolSlug: 'zoom',
      provider: 'zoom',
      credentials: {
        access_token: tokens.accessToken,
        ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
      },
      meta: {
        connectedVia: 'zoom-oauth',
        expiresIn: tokens.expiresIn,
        accountId: identity.accountId,
        email: identity.email,
        displayName: identity.displayName,
        scopes: ['meeting:write', 'meeting:read', 'user:read'],
      },
      expiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null,
    });
    res.json({
      connected: true,
      returnPath: parsed.returnPath ?? `/aiva/workers/${parsed.workerId}?tab=concierge`,
      identity: {
        accountId: identity.accountId,
        email: identity.email,
        displayName: identity.displayName,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.get('/connections/zoom/status', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    const session = await getToolSession(ctx.workspaceId, ctx.workerId, 'zoom');
    if (!session || !session.credentials.access_token) {
      res.json({
        connected: false,
        oauthConfigured: isZoomOAuthConfigured(),
        account: null,
        scopeStatus: 'missing',
        lastProbeOk: null,
        failureReason: null,
        safeLogs: [],
      });
      return;
    }
    const meta = session.meta ?? {};
    res.json({
      connected: true,
      oauthConfigured: isZoomOAuthConfigured(),
      account: {
        accountId: typeof meta.accountId === 'string' ? meta.accountId : null,
        email: typeof meta.email === 'string' ? meta.email : null,
        displayName: typeof meta.displayName === 'string' ? meta.displayName : null,
      },
      scopeStatus: Array.isArray(meta.scopes) ? 'granted' : 'unknown',
      scopes: Array.isArray(meta.scopes) ? meta.scopes : [],
      expiresAt: session.expiresAt,
      lastProbeAt: session.lastProbeAt,
      lastProbeOk: session.lastProbeOk,
      failureReason:
        typeof meta.lastProbeError === 'string' && meta.lastProbeError
          ? meta.lastProbeError
          : null,
      safeLogs: [
        {
          at: session.lastProbeAt,
          ok: session.lastProbeOk,
          via: typeof meta.connectedVia === 'string' ? meta.connectedVia : 'unknown',
        },
      ].filter((row) => row.at),
      staticFallbackNote:
        'A static room URL may be used as an explicitly labelled fallback; it does not provide managed Zoom synchronization.',
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.post('/connections/zoom/test', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    const session = await getToolSession(ctx.workspaceId, ctx.workerId, 'zoom');
    if (!session?.credentials.access_token) {
      res.status(400).json({ ok: false, error: 'Zoom is not connected' });
      return;
    }
    const identity = await fetchZoomAccountIdentity(session.credentials.access_token);
    const ok = identity.status === 'ok';
    await markSessionProbe(
      ctx.workspaceId,
      ctx.workerId,
      'zoom',
      ok,
      identity.error,
    );
    if (ok) {
      await upsertToolSession({
        workspaceId: ctx.workspaceId,
        workerId: ctx.workerId,
        toolSlug: 'zoom',
        provider: 'zoom',
        credentials: session.credentials,
        meta: {
          ...session.meta,
          accountId: identity.accountId,
          email: identity.email,
          displayName: identity.displayName,
          lastTestAt: new Date().toISOString(),
        },
        expiresAt: session.expiresAt ? new Date(session.expiresAt) : null,
      });
    }
    res.json({
      ok,
      status: identity.status,
      account: ok
        ? {
            accountId: identity.accountId,
            email: identity.email,
            displayName: identity.displayName,
          }
        : null,
      failureReason: identity.error ?? null,
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.post('/connections/zoom/revoke', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    const session = await getToolSession(ctx.workspaceId, ctx.workerId, 'zoom');
    if (session?.credentials.access_token) {
      await revokeZoomToken(session.credentials.access_token);
    }
    if (session?.credentials.refresh_token) {
      await revokeZoomToken(session.credentials.refresh_token);
    }
    await deleteToolSession(ctx.workspaceId, ctx.workerId, 'zoom');
    res.json({ revoked: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.post('/setup/policy', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    const bookingRaw = String(req.body?.bookingPermission ?? '').trim();
    const bookingPermission =
      bookingRaw === 'off' || bookingRaw === 'offer_only' || bookingRaw === 'offer_and_book'
        ? (bookingRaw as BookingPermission)
        : undefined;
    const profile = await upsertConciergePolicy({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
      tone: req.body?.tone != null ? String(req.body.tone) : undefined,
      supportedLanguages: Array.isArray(req.body?.supportedLanguages)
        ? req.body.supportedLanguages.map(String)
        : undefined,
      responseBoundaries:
        req.body?.responseBoundaries != null
          ? String(req.body.responseBoundaries)
          : undefined,
      contactCapturePolicy:
        req.body?.contactCapturePolicy && typeof req.body.contactCapturePolicy === 'object'
          ? (req.body.contactCapturePolicy as Record<string, unknown>)
          : undefined,
      bookingPermission,
      slaPolicy:
        req.body?.slaPolicy && typeof req.body.slaPolicy === 'object'
          ? (req.body.slaPolicy as Record<string, unknown>)
          : undefined,
      answerPolicy:
        req.body?.answerPolicy && typeof req.body.answerPolicy === 'object'
          ? (req.body.answerPolicy as Record<string, unknown>)
          : undefined,
      escalationRules:
        req.body?.escalationRules && typeof req.body.escalationRules === 'object'
          ? (req.body.escalationRules as Record<string, unknown>)
          : undefined,
    });
    res.json({ profile });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.post(
  '/knowledge/:entryId/publish-state',
  async (req: ConciergeRequest, res: Response) => {
    try {
      const ctx = await requireWorker(req, res);
      if (!ctx) return;
      const entryId = String(req.params.entryId ?? '').trim();
      const publishState = String(req.body?.publishState ?? '').trim() as KnowledgePublishState;
      if (!entryId || !['draft', 'published', 'archived'].includes(publishState)) {
        res.status(400).json({ error: 'entryId and publishState (draft|published|archived) are required' });
        return;
      }
      const ok = await setKnowledgePublishState({
        workerId: ctx.workerId,
        workspaceId: ctx.workspaceId,
        entryId,
        publishState,
        createdBy: typeof req.body?.createdBy === 'string' ? req.body.createdBy : null,
      });
      if (!ok) {
        res.status(404).json({ error: 'Knowledge entry not found' });
        return;
      }
      const readiness = await evaluateConciergeReadiness(ctx.workspaceId, ctx.workerId);
      res.json({ ok: true, publishState, readiness });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

conciergeSetupRouter.get(
  '/knowledge/:entryId/revisions',
  async (req: ConciergeRequest, res: Response) => {
    try {
      const ctx = await requireWorker(req, res);
      if (!ctx) return;
      const entryId = String(req.params.entryId ?? '').trim();
      if (!entryId) {
        res.status(400).json({ error: 'entryId is required' });
        return;
      }
      const revisions = await listKnowledgeRevisions({
        workerId: ctx.workerId,
        entryId,
      });
      res.json({ revisions });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

conciergeSetupRouter.get('/support-cases', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : '';
    const status = statusRaw
      ? (statusRaw.split(',').map((s) => s.trim()) as SupportCaseStatus[])
      : undefined;
    const cases = await listSupportCases({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
      status,
      limit: 50,
    });
    res.json({ cases });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.get(
  '/support-cases/:caseId',
  async (req: ConciergeRequest, res: Response) => {
    try {
      const ctx = await requireWorker(req, res);
      if (!ctx) return;
      const caseId = String(req.params.caseId ?? '').trim();
      const supportCase = await getSupportCase({
        workspaceId: ctx.workspaceId,
        caseId,
      });
      if (!supportCase || supportCase.workerId !== ctx.workerId) {
        res.status(404).json({ error: 'Support case not found' });
        return;
      }
      const notes = await listInternalNotes({
        workspaceId: ctx.workspaceId,
        caseId,
      });
      res.json({ case: supportCase, notes });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

conciergeSetupRouter.post(
  '/support-cases/:caseId/notes',
  async (req: ConciergeRequest, res: Response) => {
    try {
      const ctx = await requireWorker(req, res);
      if (!ctx) return;
      const caseId = String(req.params.caseId ?? '').trim();
      const supportCase = await getSupportCase({
        workspaceId: ctx.workspaceId,
        caseId,
      });
      if (!supportCase || supportCase.workerId !== ctx.workerId) {
        res.status(404).json({ error: 'Support case not found' });
        return;
      }
      const note = await addInternalNote({
        workspaceId: ctx.workspaceId,
        workerId: ctx.workerId,
        caseId,
        audienceSessionId: supportCase.audienceSessionId,
        authorUserId:
          typeof req.body?.authorUserId === 'string' ? req.body.authorUserId : null,
        body: String(req.body?.body ?? ''),
      });
      res.json({ note });
    } catch (err) {
      const status = (err as { status?: number }).status ?? 400;
      res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

conciergeSetupRouter.post(
  '/support-cases/:caseId/status',
  async (req: ConciergeRequest, res: Response) => {
    try {
      const ctx = await requireWorker(req, res);
      if (!ctx) return;
      const caseId = String(req.params.caseId ?? '').trim();
      const status = String(req.body?.status ?? '').trim() as SupportCaseStatus;
      if (!['open', 'pending_customer', 'pending_operator', 'resolved', 'closed'].includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }
      const existing = await getSupportCase({
        workspaceId: ctx.workspaceId,
        caseId,
      });
      if (!existing || existing.workerId !== ctx.workerId) {
        res.status(404).json({ error: 'Support case not found' });
        return;
      }
      const supportCase = await updateSupportCaseStatus({
        workspaceId: ctx.workspaceId,
        caseId,
        status,
        actorType: 'owner',
        actorId: typeof req.body?.actorId === 'string' ? req.body.actorId : null,
        detail: typeof req.body?.detail === 'string' ? req.body.detail : null,
      });
      res.json({ case: supportCase });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

conciergeSetupRouter.post(
  '/handoff/:audienceSessionId/takeover',
  async (req: ConciergeRequest, res: Response) => {
    try {
      const ctx = await requireWorker(req, res);
      if (!ctx) return;
      const audienceSessionId = String(req.params.audienceSessionId ?? '').trim();
      const operatorUserId = String(req.body?.operatorUserId ?? '').trim();
      if (!audienceSessionId || !operatorUserId) {
        res.status(400).json({ error: 'audienceSessionId and operatorUserId are required' });
        return;
      }
      const result = await operatorTakeover({
        workspaceId: ctx.workspaceId,
        audienceSessionId,
        operatorUserId,
        caseId: typeof req.body?.caseId === 'string' ? req.body.caseId : null,
      });
      res.json(result);
    } catch (err) {
      const status = (err as { status?: number }).status ?? 400;
      res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

conciergeSetupRouter.post(
  '/handoff/:audienceSessionId/release',
  async (req: ConciergeRequest, res: Response) => {
    try {
      const ctx = await requireWorker(req, res);
      if (!ctx) return;
      const audienceSessionId = String(req.params.audienceSessionId ?? '').trim();
      if (!audienceSessionId) {
        res.status(400).json({ error: 'audienceSessionId is required' });
        return;
      }
      const result = await releaseToAiva({
        workspaceId: ctx.workspaceId,
        audienceSessionId,
        operatorUserId:
          typeof req.body?.operatorUserId === 'string' ? req.body.operatorUserId : null,
        caseId: typeof req.body?.caseId === 'string' ? req.body.caseId : null,
        note: typeof req.body?.note === 'string' ? req.body.note : null,
      });
      res.json(result);
    } catch (err) {
      const status = (err as { status?: number }).status ?? 400;
      res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

// Prompt 705: operator inbox, CRM timeline, bookings panel, analytics, outreach resume.

conciergeSetupRouter.get('/inbox', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const conversations = await listOperatorInbox({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
      status,
      limit: 50,
    });
    res.json({ conversations });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.get(
  '/inbox/:audienceSessionId',
  async (req: ConciergeRequest, res: Response) => {
    try {
      const ctx = await requireWorker(req, res);
      if (!ctx) return;
      const audienceSessionId = String(req.params.audienceSessionId ?? '').trim();
      const detail = await getOperatorInboxDetail({
        workspaceId: ctx.workspaceId,
        workerId: ctx.workerId,
        audienceSessionId,
      });
      if (!detail) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      res.json({ conversation: detail });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

conciergeSetupRouter.get('/crm-timeline', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    const timeline = await buildCrmTimeline({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
      leadId: typeof req.query.leadId === 'string' ? req.query.leadId : null,
      email: typeof req.query.email === 'string' ? req.query.email : null,
      audienceSessionId:
        typeof req.query.audienceSessionId === 'string' ? req.query.audienceSessionId : null,
      bookingId: typeof req.query.bookingId === 'string' ? req.query.bookingId : null,
    });
    res.json({ timeline });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.get('/bookings', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    const bookings = listBookings(ctx.workspaceId)
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 50)
      .map((b) => {
        const invitation = bookingInvitationView(b);
        const conference = getConferenceArtifact(ctx.workspaceId, b.id);
        const projection = getCalendarProjection(ctx.workspaceId, b.id);
        return {
          id: b.id,
          status: b.status,
          guestName: b.guestName,
          guestEmail: b.guestEmail,
          startsAt: b.startsAt,
          endsAt: b.endsAt,
          meetingUrl: b.meetingUrl ?? null,
          calendarEventId: b.calendarEventId ?? projection?.providerEventId ?? null,
          leadId: b.leadId ?? null,
          sessionOutcome: b.sessionOutcome ?? null,
          orchestrationStatus: b.orchestrationStatus ?? null,
          ...invitation,
          conferenceManaged: conference?.managed ?? null,
          conferenceProvider: conference?.provider ?? null,
          sourceSystem: 'vical',
          deepLinks: {
            outreachBookings: '/aiva/outreach/bookings',
            vicalBookings: '/vical/bookings',
          },
        };
      });
    res.json({
      bookings,
      note: 'Same viCal ledger as outreach Bookings and /vical/bookings; not a divergent record set.',
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.get(
  '/bookings/:bookingId/evidence',
  async (req: ConciergeRequest, res: Response) => {
    try {
      const ctx = await requireWorker(req, res);
      if (!ctx) return;
      const bookingId = String(req.params.bookingId ?? '').trim();
      const evidence = getBookingEvidence(ctx.workspaceId, bookingId);
      if (!evidence) {
        res.status(404).json({ error: 'Booking not found' });
        return;
      }
      res.json({ evidence });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

conciergeSetupRouter.get('/analytics', async (req: ConciergeRequest, res: Response) => {
  try {
    const ctx = await requireWorker(req, res);
    if (!ctx) return;
    const report = await buildConciergeAnalytics({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
      since: typeof req.query.since === 'string' ? req.query.since : undefined,
      until: typeof req.query.until === 'string' ? req.query.until : undefined,
    });
    res.json({ analytics: report });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

conciergeSetupRouter.post(
  '/outreach/enrollments/:enrollmentId/resume',
  async (req: ConciergeRequest, res: Response) => {
    try {
      const ctx = await requireWorker(req, res);
      if (!ctx) return;
      const enrollmentId = String(req.params.enrollmentId ?? '').trim();
      const enrollment = operatorResumeEnrollment({
        workspaceId: ctx.workspaceId,
        workerId: ctx.workerId,
        enrollmentId,
        actorId: typeof req.body?.actorId === 'string' ? req.body.actorId : null,
      });
      if (!enrollment) {
        res.status(404).json({ error: 'Enrollment not found' });
        return;
      }
      res.json({ enrollment });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);