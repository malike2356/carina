import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import {
  createWorkerChannel,
  deleteWorkerChannel,
  generateEmailSlug,
  listWorkspaceChannels,
  readChannelCredentials,
  setChannelEnabled,
} from './channel-store.js';
import { registerChannel, unregisterChannel } from './worker-registry.js';
import { getWorker } from '../workers/worker-store.js';
import { registerTelegramWebhook } from './adapters/telegram-adapter.js';
import { normalizeSmsNumber } from './adapters/sms-adapter.js';
import {
  ensureDiscordGateway,
  resolveDiscordApplicationId,
  stopDiscordGateway,
} from './adapters/discord-gateway.js';
import { processAivaMessage } from '../workers/aiva-process-message.js';
import { getAdapter } from './adapter-registry.js';
import type { AivaChannelName } from './types.js';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { assertCanAddConnectedChannel } from '../billing/aiva-plan-gates.js';
import {
  isSocialAivaChannel,
  socialCredentialsComplete,
} from './social-channel-utils.js';
import { getConfiguredChannels } from '../api/channel-config-api.js';
import { listChannelSummaries } from './channel-requirements.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const channelsApiRouter: ExpressRouter = Router();
channelsApiRouter.use(requireCloudProxy);

// GET /api/channels/overview
// Dashboard sync: merges worker-linked channels (Cloud/Aiva) with conversationally-configured
// channels from channel_configurations (self-hosted + all Carina instances).
// No workspace requirement - works for self-hosted single-tenant installs.
channelsApiRouter.get('/overview', async (req: Request, res: Response) => {
  const header = req.headers['x-workspace-id'];
  const workspaceId = (Array.isArray(header) ? header[0] : header)?.trim() || null;

  const conversational = await getConfiguredChannels(workspaceId);
  const confMap = new Map(conversational.map((c) => [c.channelId, c]));

  const channels = listChannelSummaries().map(({ id, name, aliases }) => {
    const conf = confMap.get(id);
    return {
      id,
      name,
      aliases,
      configured: Boolean(conf),
      status: conf?.status ?? 'not_configured',
      requiresRestart: conf?.requiresRestart ?? false,
      testedAt: conf?.testedAt ?? null,
      source: 'conversational' as const,
    };
  });

  res.json({ channels });
});

type ChannelRequest = Request & { workspaceId?: string };

function resolveWorkspaceId(req: ChannelRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  return fromHeader?.trim() || null;
}

function requireWorkspace(req: ChannelRequest, res: Response, next: NextFunction): void {
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required (X-Workspace-Id header)' });
    return;
  }
  if (!UUID_RE.test(workspaceId)) {
    res.status(400).json({ error: 'Invalid workspaceId' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

channelsApiRouter.get('/', requireWorkspace, async (req: ChannelRequest, res: Response) => {
  const channels = await listWorkspaceChannels(req.workspaceId!);
  res.json({
    channels: channels.map((row) => ({
      id: row.id,
      workerId: row.workerId,
      channel: row.channel,
      identifier: row.identifier,
      enabled: row.enabled,
      verified: row.verified,
      hasCredentials: Boolean(row.credentials.encrypted),
    })),
  });
});

channelsApiRouter.post('/', requireWorkspace, async (req: ChannelRequest, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const workerId = String(req.body?.workerId ?? '');
    const channel = String(req.body?.channel ?? '') as AivaChannelName;
    let identifier = String(req.body?.identifier ?? '').trim();
    const credentials = (req.body?.credentials ?? {}) as Record<string, string>;

    const worker = await getWorker(workspaceId, workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    if (channel === 'email' && !identifier) {
      identifier = generateEmailSlug(worker.name, worker.id);
      credentials.from_address = identifier;
    }

    if (channel === 'telegram' && credentials.bot_token) {
      identifier = workerId;
      await registerTelegramWebhook(credentials.bot_token, workerId);
    }

    if (channel === 'whatsapp' && credentials.phone_number_id) {
      identifier = credentials.phone_number_id;
    }

    if (channel === 'slack' && credentials.team_id) {
      identifier = credentials.team_id;
    }

    if (channel === 'web') {
      identifier = `web:${workerId}`;
    }

    if (channel === 'sms') {
      const fromNumber = normalizeSmsNumber(String(credentials.from_number ?? ''));
      if (!fromNumber || !credentials.account_sid?.trim() || !credentials.auth_token?.trim()) {
        res.status(400).json({ error: 'SMS requires account_sid, auth_token, and from_number' });
        return;
      }
      credentials.from_number = fromNumber;
      identifier = fromNumber;
    }

    if (channel === 'discord' && credentials.bot_token) {
      identifier = await resolveDiscordApplicationId(credentials.bot_token);
      credentials.application_id = identifier;
    }

    if (channel === 'teams' && credentials.app_id) {
      identifier = credentials.app_id.trim();
      if (!credentials.app_password?.trim()) {
        res.status(400).json({ error: 'Teams requires app_id and app_password' });
        return;
      }
    }

    if (isSocialAivaChannel(channel)) {
      if (!identifier) identifier = 'pending';
      if (!socialCredentialsComplete(channel, credentials)) {
        res.status(400).json({ error: 'OAuth connection required', code: 'OAUTH_REQUIRED' });
        return;
      }
      if (channel === 'linkedin' && credentials.member_id) {
        identifier = credentials.member_id.trim();
      }
      if (channel === 'instagram' && credentials.instagram_business_account_id) {
        identifier = credentials.instagram_business_account_id.trim();
      }
      if (channel === 'messenger' && credentials.page_id) {
        identifier = credentials.page_id.trim();
      }
      if (channel === 'twitter' && credentials.user_id) {
        identifier = credentials.user_id.trim();
      }
      if (channel === 'tiktok' && credentials.open_id) {
        identifier = credentials.open_id.trim();
      }
    }

    if (!identifier) {
      res.status(400).json({ error: 'identifier is required' });
      return;
    }

    const gate = await assertCanAddConnectedChannel(workspaceId, workerId, channel);
    if (!gate.allowed) {
      res.status(403).json({
        error: `Starter plan allows ${gate.limit} channels (web + 1). Upgrade to Team for all channels.`,
        code: 'PLAN_UPGRADE_REQUIRED',
        planTier: gate.planTier,
        planRequired: 'team',
        channelLimit: gate.limit,
        connectedCount: gate.connected,
      });
      return;
    }

    const row = await createWorkerChannel({
      workerId,
      workspaceId,
      channel,
      identifier,
      credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
    });

    registerChannel(channel, identifier, {
      workerId,
      workspaceId,
      channelRowId: row.id,
      credentialBlob: row.credentials.encrypted ?? '',
    });

    if (channel === 'discord' && credentials.bot_token) {
      try {
        await ensureDiscordGateway(identifier, credentials.bot_token, workerId, workspaceId);
      } catch (err) {
        console.warn('[channels-api] discord gateway start failed:', err);
      }
    }

    res.status(201).json({ channel: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

channelsApiRouter.delete('/:id', requireWorkspace, async (req: ChannelRequest, res: Response) => {
  const channelId = String(req.params.id);
  const channels = await listWorkspaceChannels(req.workspaceId!);
  const existing = channels.find((c) => c.id === channelId);
  if (!existing) {
    res.status(404).json({ error: 'Channel not found' });
    return;
  }

  await deleteWorkerChannel(req.workspaceId!, channelId);
  if (existing.channel === 'discord') {
    await stopDiscordGateway(existing.identifier);
  }
  unregisterChannel(existing.channel, existing.identifier);
  res.json({ ok: true });
});

channelsApiRouter.patch('/:id/enable', requireWorkspace, async (req: ChannelRequest, res: Response) => {
  const channelId = String(req.params.id);
  const enabled = Boolean(req.body?.enabled);
  const row = await setChannelEnabled(req.workspaceId!, channelId, enabled);
  if (!row) {
    res.status(404).json({ error: 'Channel not found' });
    return;
  }

  if (enabled) {
    registerChannel(row.channel, row.identifier, {
      workerId: row.workerId,
      workspaceId: row.workspaceId,
      channelRowId: row.id,
      credentialBlob: row.credentials.encrypted ?? '',
    });
  } else {
    unregisterChannel(row.channel, row.identifier);
  }

  res.json({ channel: row });
});

channelsApiRouter.get('/:id/test', requireWorkspace, async (req: ChannelRequest, res: Response) => {
  const channelId = String(req.params.id);
  const channels = await listWorkspaceChannels(req.workspaceId!);
  const row = channels.find((c) => c.id === channelId);
  if (!row) {
    res.status(404).json({ error: 'Channel not found' });
    return;
  }

  const adapter = getAdapter(row.channel);
  if (!adapter) {
    res.status(400).json({ error: `No adapter for ${row.channel}` });
    return;
  }

  const credentials = readChannelCredentials(row);
  const testContact = String(req.query.contactId ?? credentials.test_contact ?? 'test');
  const reply = await processAivaMessage({
    workerId: row.workerId,
    workspaceId: row.workspaceId,
    userMessage: 'This is a channel connectivity test from Carina.',
    channel: row.channel,
    contactId: testContact,
  });

  if (row.channel !== 'web') {
    await adapter.send(
      { channel: row.channel, contactId: testContact, content: reply || 'Test OK' },
      credentials,
    );
  }

  res.json({ ok: true, reply });
});
