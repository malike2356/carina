import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { isAiWorkersEnabled } from '../workers/aiva-message-handler.js';
import { isEmailIngestionEnabled, isPropreneurBridgeEnabled } from '../workers/aiva-feature-flags.js';
import { getWorker } from '../workers/worker-store.js';
import {
  addSender,
  deleteEmailConnection,
  getEmailConnection,
  getEmailCredentials,
  listRecentDigests,
  listSenders,
  countDigestsForWorker,
  removeSender,
  upsertEmailConnection,
  updateConnectionStatus,
} from '../ingestion/email/email-connection-store.js';
import { testImapConnection } from '../ingestion/email/imap-connector.js';
import { exchangeCodeForTokens, getGmailAuthUrl, isGmailOAuthConfigured } from '../ingestion/email/gmail-oauth.js';
import {
  exchangeOutlookCodeForTokens,
  getOutlookAuthUrl,
  isOutlookOAuthConfigured,
} from '../ingestion/email/outlook-oauth.js';
import { isEmailIngestionEnabled as emailIngestionFlag } from '../workers/aiva-feature-flags.js';
import { pollWorkerInbox } from '../ingestion/email/email-poller.js';
import { updateWorkerConfig, validateAndSetPropreneurBinding, clearPropreneurBinding } from '../workers/worker-bridge-store.js';
import { refreshWorkerSummarySchedule } from '../workers/summary-generator.js';
import { credentialsConfigured } from '../channels/credential-store.js';

export const aivaEmailRouter: ExpressRouter = Router();
aivaEmailRouter.use(requireCloudProxy);

type AivaEmailRequest = Request & { workspaceId?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function resolveWorkspaceId(req: AivaEmailRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  const fromBody = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : '';
  return (fromHeader ?? fromBody ?? fromQuery)?.trim() || null;
}

function encodeGmailOAuthState(workerId: string, workspaceId: string): string {
  return Buffer.from(`${workerId}:${workspaceId}`, 'utf8').toString('base64url');
}

function decodeGmailOAuthState(state: string): { workerId: string; workspaceId: string } | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const [workerId, workspaceId] = decoded.split(':');
    if (!workerId || !workspaceId || !UUID_RE.test(workerId) || !UUID_RE.test(workspaceId)) {
      return null;
    }
    return { workerId, workspaceId };
  } catch {
    return null;
  }
}

function requireEmailIngestion(req: AivaEmailRequest, res: Response, next: NextFunction): void {
  if (!isAiWorkersEnabled()) {
    res.status(503).json({ error: 'AI workers are disabled' });
    return;
  }
  if (!isEmailIngestionEnabled()) {
    res.status(503).json({ error: 'Email ingestion is disabled' });
    return;
  }
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    res.status(400).json({ error: 'Valid workspaceId is required' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

async function requireWorker(req: AivaEmailRequest, res: Response, next: NextFunction): Promise<void> {
  const workerId = routeParam(req.params.workerId);
  if (!UUID_RE.test(workerId)) {
    res.status(400).json({ error: 'Invalid workerId' });
    return;
  }
  const worker = await getWorker(req.workspaceId!, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  next();
}

aivaEmailRouter.post('/connect', requireEmailIngestion, async (req: AivaEmailRequest, res: Response) => {
  try {
    if (!credentialsConfigured()) {
      res.status(503).json({ error: 'CHANNEL_CREDENTIAL_KEY is not configured' });
      return;
    }

    const workerId = String(req.body?.workerId ?? '').trim();
    const imapHost = String(req.body?.imapHost ?? '').trim();
    const imapPort = Number(req.body?.imapPort ?? 993);
    const imapTls = req.body?.imapTls !== false;
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (!UUID_RE.test(workerId) || !imapHost || !username || !password) {
      res.status(400).json({ error: 'workerId, imapHost, username, and password are required' });
      return;
    }

    const worker = await getWorker(req.workspaceId!, workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    if (isPropreneurBridgeEnabled() && worker.propreneurTenantSlug) {
      res.status(409).json({
        error: 'This Aiva is bound to Propreneur email ingestion. Configure the mailbox in Propreneur /settings/email-ingestion instead of Carina IMAP.',
        code: 'PROPREENEUR_EMAIL_OWNER',
      });
      return;
    }

    const test = await testImapConnection({ host: imapHost, port: imapPort, tls: imapTls, username, password });
    if (!test.ok) {
      res.status(400).json({ error: test.error ?? 'IMAP connection failed' });
      return;
    }

    const connection = await upsertEmailConnection(workerId, {
      imapHost,
      imapPort,
      imapTls,
      username,
      password,
      status: 'connected',
    });

    res.json({
      ok: true,
      connection: {
        id: connection.id,
        workerId: connection.workerId,
        imapHost: connection.imapHost,
        imapPort: connection.imapPort,
        status: connection.status,
        mailbox: test.mailbox,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaEmailRouter.get('/oauth/gmail/auth-url', requireEmailIngestion, async (req: AivaEmailRequest, res: Response) => {
  try {
    if (!isGmailOAuthConfigured()) {
      res.status(503).json({ error: 'Gmail OAuth is not configured on this server' });
      return;
    }

    const workerId = String(req.query.workerId ?? '').trim();
    if (!UUID_RE.test(workerId)) {
      res.status(400).json({ error: 'Valid workerId is required' });
      return;
    }

    const worker = await getWorker(req.workspaceId!, workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const state = encodeGmailOAuthState(workerId, req.workspaceId!);
    res.json({ authUrl: getGmailAuthUrl(state) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaEmailRouter.post('/oauth/gmail/callback', async (req: AivaEmailRequest, res: Response) => {
  try {
    if (!credentialsConfigured()) {
      res.status(503).json({ error: 'CHANNEL_CREDENTIAL_KEY is not configured' });
      return;
    }
    if (!isGmailOAuthConfigured()) {
      res.status(503).json({ error: 'Gmail OAuth is not configured on this server' });
      return;
    }

    const code = String(req.body?.code ?? '').trim();
    const state = String(req.body?.state ?? '').trim();
    if (!code || !state) {
      res.status(400).json({ error: 'code and state are required' });
      return;
    }

    const decoded = decodeGmailOAuthState(state);
    if (!decoded) {
      res.status(400).json({ error: 'Invalid OAuth state' });
      return;
    }

    const tokens = await exchangeCodeForTokens(code);
    const connection = await upsertEmailConnection(decoded.workerId, {
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      imapTls: true,
      username: tokens.email,
      oauthProvider: 'gmail',
      oauthRefreshToken: tokens.refreshToken,
      status: 'connected',
    });

    res.json({
      ok: true,
      connection: {
        id: connection.id,
        workerId: connection.workerId,
        imapHost: connection.imapHost,
        imapPort: connection.imapPort,
        status: connection.status,
        oauthProvider: connection.oauthProvider,
        username: tokens.email,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaEmailRouter.get('/oauth/outlook/auth-url', requireEmailIngestion, async (req: AivaEmailRequest, res: Response) => {
  try {
    if (!isOutlookOAuthConfigured()) {
      res.status(503).json({ error: 'Microsoft OAuth is not configured on this server' });
      return;
    }

    const workerId = String(req.query.workerId ?? '').trim();
    if (!UUID_RE.test(workerId)) {
      res.status(400).json({ error: 'Valid workerId is required' });
      return;
    }

    const worker = await getWorker(req.workspaceId!, workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const state = encodeGmailOAuthState(workerId, req.workspaceId!);
    res.json({ authUrl: getOutlookAuthUrl(state) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaEmailRouter.post('/oauth/outlook/callback', async (req: AivaEmailRequest, res: Response) => {
  try {
    if (!credentialsConfigured()) {
      res.status(503).json({ error: 'CHANNEL_CREDENTIAL_KEY is not configured' });
      return;
    }
    if (!isOutlookOAuthConfigured()) {
      res.status(503).json({ error: 'Microsoft OAuth is not configured on this server' });
      return;
    }

    const code = String(req.body?.code ?? '').trim();
    const state = String(req.body?.state ?? '').trim();
    const codeVerifier = typeof req.body?.codeVerifier === 'string'
      ? String(req.body.codeVerifier).trim()
      : undefined;
    if (!code || !state) {
      res.status(400).json({ error: 'code and state are required' });
      return;
    }

    const decoded = decodeGmailOAuthState(state);
    if (!decoded) {
      res.status(400).json({ error: 'Invalid OAuth state' });
      return;
    }

    const tokens = await exchangeOutlookCodeForTokens(code, codeVerifier);
    const connection = await upsertEmailConnection(decoded.workerId, {
      imapHost: 'outlook.office365.com',
      imapPort: 993,
      imapTls: true,
      username: tokens.email,
      oauthProvider: 'outlook',
      oauthRefreshToken: tokens.refreshToken,
      status: 'connected',
    });

    res.json({
      ok: true,
      connection: {
        id: connection.id,
        workerId: connection.workerId,
        imapHost: connection.imapHost,
        imapPort: connection.imapPort,
        status: connection.status,
        oauthProvider: connection.oauthProvider,
        username: tokens.email,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaEmailRouter.get('/status/:workerId', requireEmailIngestion, requireWorker, async (req: AivaEmailRequest, res: Response) => {
  try {
    const workerId = routeParam(req.params.workerId);
    const connection = await getEmailConnection(workerId);
    const digests = await listRecentDigests(workerId, 5);
    res.json({
      connected: Boolean(connection),
      connection: connection
        ? {
            imapHost: connection.imapHost,
            imapPort: connection.imapPort,
            status: connection.status,
            lastPollAt: connection.lastPollAt?.toISOString() ?? null,
          }
        : null,
      recentDigests: digests.length,
      digestCount: await countDigestsForWorker(workerId),
      pollingEnabled: emailIngestionFlag(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaEmailRouter.post('/disconnect/:workerId', requireEmailIngestion, requireWorker, async (req: AivaEmailRequest, res: Response) => {
  try {
    const workerId = routeParam(req.params.workerId);
    await deleteEmailConnection(workerId);
    await updateConnectionStatus(workerId, 'disconnected').catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaEmailRouter.get('/senders/:workerId', requireEmailIngestion, requireWorker, async (req: AivaEmailRequest, res: Response) => {
  try {
    const workerId = routeParam(req.params.workerId);
    const connection = await getEmailConnection(workerId);
    if (!connection) {
      res.status(404).json({ error: 'No email connection for worker' });
      return;
    }
    const senders = await listSenders(connection.id);
    res.json({ senders });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaEmailRouter.post('/senders/:workerId', requireEmailIngestion, requireWorker, async (req: AivaEmailRequest, res: Response) => {
  try {
    const workerId = routeParam(req.params.workerId);
    const emailAddress = String(req.body?.emailAddress ?? '').trim().toLowerCase();
    const roleTag = String(req.body?.roleTag ?? 'other').trim();
    if (!emailAddress.includes('@')) {
      res.status(400).json({ error: 'Valid emailAddress is required' });
      return;
    }

    const connection = await getEmailConnection(workerId);
    if (!connection) {
      res.status(404).json({ error: 'No email connection for worker' });
      return;
    }

    const sender = await addSender(connection.id, emailAddress, roleTag);
    res.json({ sender });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaEmailRouter.delete('/senders/:workerId/:senderId', requireEmailIngestion, requireWorker, async (req: AivaEmailRequest, res: Response) => {
  try {
    const workerId = routeParam(req.params.workerId);
    const senderId = routeParam(req.params.senderId);
    const connection = await getEmailConnection(workerId);
    if (!connection) {
      res.status(404).json({ error: 'No email connection for worker' });
      return;
    }
    const removed = await removeSender(connection.id, senderId);
    if (!removed) {
      res.status(404).json({ error: 'Sender not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

function requirePropreneurBridge(req: AivaEmailRequest, res: Response, next: NextFunction): void {
  if (!isAiWorkersEnabled()) {
    res.status(503).json({ error: 'AI workers are disabled' });
    return;
  }
  if (!isPropreneurBridgeEnabled()) {
    res.status(503).json({ error: 'Propreneur bridge is disabled' });
    return;
  }
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    res.status(400).json({ error: 'Valid workspaceId is required' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

aivaEmailRouter.post('/propreneur/bind', requirePropreneurBridge, async (req: AivaEmailRequest, res: Response) => {
  try {
    if (!credentialsConfigured()) {
      res.status(503).json({ error: 'CHANNEL_CREDENTIAL_KEY is not configured' });
      return;
    }

    const workerId = String(req.body?.workerId ?? '').trim();
    const tenantSlug = String(req.body?.tenantSlug ?? '').trim();
    const apiKey = String(req.body?.apiKey ?? '').trim();

    if (!UUID_RE.test(workerId) || !tenantSlug || !apiKey) {
      res.status(400).json({ error: 'workerId, tenantSlug, and apiKey are required' });
      return;
    }

    const worker = await getWorker(req.workspaceId!, workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const result = await validateAndSetPropreneurBinding(req.workspaceId!, workerId, tenantSlug, apiKey);
    res.json({ ok: true, tenantSlug: result.tenantSlug, propertyCount: result.propertyCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaEmailRouter.post('/summary/config/:workerId', requirePropreneurBridge, async (req: AivaEmailRequest, res: Response) => {
  try {
    const workerId = routeParam(req.params.workerId);
    if (!UUID_RE.test(workerId)) {
      res.status(400).json({ error: 'Invalid workerId' });
      return;
    }
    const worker = await getWorker(req.workspaceId!, workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }
    const config = await updateWorkerConfig(req.workspaceId!, workerId, {
      summary: {
        enabled: Boolean(req.body?.enabled),
        deliveryTime: req.body?.deliveryTime ? String(req.body.deliveryTime) : undefined,
        summarySchedule: req.body?.summarySchedule ? String(req.body.summarySchedule) : undefined,
        deliveryChannel: req.body?.deliveryChannel ? String(req.body.deliveryChannel) : 'telegram',
        includeAudio: Boolean(req.body?.includeAudio),
        sections: Array.isArray(req.body?.sections) ? req.body.sections.map(String) : undefined,
      },
    });
    await refreshWorkerSummarySchedule(workerId);
    res.json({ config });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaEmailRouter.post('/poll/:workerId', requireEmailIngestion, requireWorker, async (req: AivaEmailRequest, res: Response) => {
  try {
    const workerId = routeParam(req.params.workerId);
    const worker = await getWorker(req.workspaceId!, workerId);
    if (isPropreneurBridgeEnabled() && worker?.propreneurTenantSlug) {
      res.status(409).json({
        error: 'This Aiva is bound to Propreneur email ingestion. Poll the mailbox from Propreneur instead.',
        code: 'PROPREENEUR_EMAIL_OWNER',
      });
      return;
    }
    const result = await pollWorkerInbox(workerId);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Credential probe for ops (does not expose password)
aivaEmailRouter.get('/credentials-check/:workerId', requireEmailIngestion, requireWorker, async (req: AivaEmailRequest, res: Response) => {
  const workerId = routeParam(req.params.workerId);
  const creds = await getEmailCredentials(workerId);
  res.json({ configured: Boolean(creds?.username) });
});
