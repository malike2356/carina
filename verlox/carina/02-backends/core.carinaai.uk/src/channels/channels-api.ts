import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import {
  deleteWorkerChannel,
  listWorkspaceChannels,
  readChannelCredentials,
  setChannelEnabled,
} from './channel-store.js';
import { registerChannel, unregisterChannel } from './worker-registry.js';
import { stopDiscordGateway } from './adapters/discord-gateway.js';
import { processAivaMessage } from '../workers/aiva-process-message.js';
import { getAdapter } from './adapter-registry.js';
import type { AivaChannelName } from './types.js';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { getConfiguredChannels } from '../api/channel-config-api.js';
import { listChannelSummaries } from './channel-requirements.js';
import {
  connectWorkerChannel,
  WorkerChannelConnectError,
} from './worker-channel-connect.js';

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
    const identifier = String(req.body?.identifier ?? '').trim();
    const credentials = (req.body?.credentials ?? {}) as Record<string, string>;

    const row = await connectWorkerChannel({
      workerId,
      workspaceId,
      channel,
      identifier,
      credentials,
    });

    res.status(201).json({ channel: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof WorkerChannelConnectError) {
      res.status(err.statusCode).json({
        error: msg,
        code: err.code,
        ...(err.details ?? {}),
      });
      return;
    }
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
