import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { SHIELD_CHANNELS, type ShieldChannel } from './types.js';
import {
  createProtection,
  getMessage,
  getProtection,
  listEvents,
  listMessages,
  listProtections,
  updateProtection,
  workspaceShieldMetrics,
} from './store.js';
import { acceptAndProcess } from './ingest.js';
import { destroyMessage, releaseMessage } from './quarantine.js';
import { getShieldAdapter, shieldAdaptersHealth } from './adapters/registry.js';
import { resolveWorkspacePlanTier } from '../billing/aiva-plan-gates.js';

export const channelShieldRouter: ExpressRouter = Router();
channelShieldRouter.use(requireCloudProxy);

type ShieldReq = Request & { workspaceId?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function resolveWorkspaceId(req: ShieldReq): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  const fromBody = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : '';
  return (fromHeader ?? fromBody ?? fromQuery)?.trim() || null;
}

function requireWorkspace(req: ShieldReq, res: Response, next: () => void): void {
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    res.status(400).json({ error: 'workspaceId is required' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

const PAID_TIERS = new Set(['starter', 'growth', 'team', 'business']);

async function requirePaidTier(req: ShieldReq, res: Response, next: () => void): Promise<void> {
  try {
    const planTier = await resolveWorkspacePlanTier(req.workspaceId!);
    if (!PAID_TIERS.has(planTier)) {
      res.status(402).json({ error: 'Channel Shield requires an Aiva paid plan', planTier });
      return;
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

channelShieldRouter.use(requireWorkspace);

channelShieldRouter.get('/health', async (_req, res) => {
  const adapters = await shieldAdaptersHealth();
  res.json({ ok: adapters.every((a) => a.ok), adapters });
});

channelShieldRouter.get('/metrics', requirePaidTier, async (req: ShieldReq, res) => {
  const metrics = await workspaceShieldMetrics(req.workspaceId!);
  const adapters = await shieldAdaptersHealth();
  res.json({
    ...metrics,
    sandbox: {
      configured: Boolean(process.env.WARDEN_SANDBOX_URL || process.env.SCOUT_WARDEN_URL),
      adapters,
    },
  });
});

channelShieldRouter.get('/protections', requirePaidTier, async (req: ShieldReq, res) => {
  const channel = typeof req.query.channel === 'string' ? (req.query.channel as ShieldChannel) : undefined;
  const rows = await listProtections(req.workspaceId!, channel);
  res.json({ protections: rows });
});

channelShieldRouter.post('/protections', requirePaidTier, async (req: ShieldReq, res) => {
  const channel = String(req.body?.channel ?? '') as ShieldChannel;
  const externalKey = String(req.body?.externalKey ?? '').trim();
  if (!SHIELD_CHANNELS.includes(channel) || !externalKey) {
    res.status(400).json({ error: 'channel and externalKey required' });
    return;
  }
  const protection = await createProtection({
    workspaceId: req.workspaceId!,
    channel,
    externalKey,
    deliveryTarget: req.body?.deliveryTarget ?? {},
    policy: req.body?.policy,
  });
  res.status(201).json({ protection });
});

channelShieldRouter.patch('/protections/:id', requirePaidTier, async (req: ShieldReq, res) => {
  const id = routeParam(req.params.id);
  const existing = await getProtection(id);
  if (!existing || existing.workspaceId !== req.workspaceId) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const updated = await updateProtection(id, {
    mode: req.body?.mode,
    status: req.body?.status,
    deliveryTarget: req.body?.deliveryTarget,
    policy: req.body?.policy,
  });
  res.json({ protection: updated });
});

channelShieldRouter.post('/protections/:id/verify', requirePaidTier, async (req: ShieldReq, res) => {
  const id = routeParam(req.params.id);
  const existing = await getProtection(id);
  if (!existing || existing.workspaceId !== req.workspaceId) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const adapter = getShieldAdapter(existing.channel);
  const health = await adapter.health();
  const updated = await updateProtection(id, {
    status: health.ok ? 'active' : 'verify_pending',
  });
  res.json({ protection: updated, health });
});

channelShieldRouter.get('/messages', requirePaidTier, async (req: ShieldReq, res) => {
  const channel = typeof req.query.channel === 'string' ? (req.query.channel as ShieldChannel) : undefined;
  const quarantineOnly = req.query.quarantine === '1' || req.query.quarantine === 'true';
  const messages = await listMessages(req.workspaceId!, { channel, quarantineOnly });
  res.json({ messages });
});

channelShieldRouter.get('/messages/:id', requirePaidTier, async (req: ShieldReq, res) => {
  const message = await getMessage(routeParam(req.params.id));
  if (!message || message.workspaceId !== req.workspaceId) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const events = await listEvents(message.id);
  res.json({ message, events });
});

channelShieldRouter.post('/messages/:id/release', requirePaidTier, async (req: ShieldReq, res) => {
  const message = await getMessage(routeParam(req.params.id));
  if (!message || message.workspaceId !== req.workspaceId) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  try {
    await releaseMessage(message.id, String(req.body?.actor ?? 'operator'), {
      approver: req.body?.approver ? String(req.body.approver) : undefined,
    });
    res.json({ ok: true, message: await getMessage(message.id) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

channelShieldRouter.post('/messages/:id/destroy', requirePaidTier, async (req: ShieldReq, res) => {
  const message = await getMessage(routeParam(req.params.id));
  if (!message || message.workspaceId !== req.workspaceId) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  await destroyMessage(message.id, String(req.body?.actor ?? 'operator'));
  res.json({ ok: true, message: await getMessage(message.id) });
});

/** Per-channel webhook ingress (authenticated by adapter). */
channelShieldRouter.post('/ingress/:channel/:protectionId', async (req: Request, res: Response) => {
  const channel = routeParam(req.params.channel) as ShieldChannel;
  if (!SHIELD_CHANNELS.includes(channel)) {
    res.status(404).json({ error: 'unknown channel' });
    return;
  }
  const protection = await getProtection(routeParam(req.params.protectionId));
  if (!protection || protection.channel !== channel) {
    res.status(404).json({ error: 'protection not found' });
    return;
  }
  const adapter = getShieldAdapter(channel);
  const ingress = {
    headers: Object.fromEntries(
      Object.entries(req.headers).filter(([, v]) => typeof v === 'string') as Array<[string, string]>,
    ),
    body: req.body,
    rawBody: typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}),
    query: Object.fromEntries(
      Object.entries(req.query).filter(([, v]) => typeof v === 'string') as Array<[string, string]>,
    ),
  };
  if (!(await adapter.authenticateIngress(ingress))) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  try {
    const envelope = await adapter.ingest(ingress, protection);
    const message = await acceptAndProcess(envelope, protection);
    res.status(202).json({
      accepted: true,
      messageId: message.id,
      verdict: (await getMessage(message.id))?.verdict ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/** Thin email-shield aliases. */
export const emailShieldAliasRouter: ExpressRouter = Router();
emailShieldAliasRouter.use(requireCloudProxy);
emailShieldAliasRouter.use((req, _res, next) => {
  if (!req.query.channel) (req.query as Record<string, string>).channel = 'email';
  next();
});
emailShieldAliasRouter.use(channelShieldRouter);
