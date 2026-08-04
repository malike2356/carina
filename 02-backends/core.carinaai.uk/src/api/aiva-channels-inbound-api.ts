import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
  Router,
  type Router as ExpressRouter,
} from 'express';
import { getAdapter } from '../channels/adapter-registry.js';
import {
  getWorkerChannelByWorkerAndChannel,
  readChannelCredentials,
} from '../channels/channel-store.js';
import { handleParsedInbound } from '../channels/message-router.js';
import {
  handleMetaWorkerWebhookChallenge,
} from '../channels/adapters/meta-worker-adapter.js';
import {
  buildTwitterWorkerCrcResponse,
  parseTwitterWorkerInbound,
} from '../channels/adapters/twitter-worker-adapter.js';
import { isSocialChannel } from '../channels/social-channel-utils.js';
import type { AivaChannelName } from '../channels/types.js';
import type { RegistryEntry } from '../channels/worker-registry.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const aivaChannelsInboundRouter: ExpressRouter = Router();

function headerMap(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function parseChannelParam(value: string): AivaChannelName | null {
  const channel = value.trim().toLowerCase();
  if (!isSocialChannel(channel)) return null;
  return channel;
}

function parseJsonBody(rawBody: Buffer): unknown {
  return JSON.parse(rawBody.toString()) as unknown;
}

async function loadEnabledWorkerChannel(
  workerId: string,
  channel: AivaChannelName,
  res: Response,
): Promise<ReturnType<typeof getWorkerChannelByWorkerAndChannel> extends Promise<infer T> ? T : never> {
  if (!UUID_RE.test(workerId)) {
    res.status(400).json({ error: 'Invalid workerId' });
    return null;
  }

  const row = await getWorkerChannelByWorkerAndChannel(workerId, channel);
  if (!row || !row.enabled) {
    res.status(404).json({ error: 'Channel not found' });
    return null;
  }
  return row;
}

aivaChannelsInboundRouter.get(
  '/:channel/:workerId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = parseChannelParam(String(req.params.channel));
      const workerId = String(req.params.workerId);
      if (!channel) {
        res.status(404).json({ error: 'Unknown channel' });
        return;
      }

      if (channel === 'twitter') {
        const crcToken = String(req.query.crc_token ?? '');
        if (!crcToken) {
          res.sendStatus(403);
          return;
        }
        const row = await getWorkerChannelByWorkerAndChannel(workerId, channel);
        const credentials = row ? readChannelCredentials(row) : {};
        const crc = buildTwitterWorkerCrcResponse(crcToken, credentials);
        if (!crc) {
          res.sendStatus(403);
          return;
        }
        res.status(200).json(crc);
        return;
      }

      if (channel === 'instagram' || channel === 'messenger') {
        const row = await getWorkerChannelByWorkerAndChannel(workerId, channel);
        if (!row) {
          res.sendStatus(404);
          return;
        }
        const credentials = readChannelCredentials(row);
        const challenge = handleMetaWorkerWebhookChallenge(
          req.query as Record<string, unknown>,
          credentials,
        );
        if (!challenge) {
          res.sendStatus(403);
          return;
        }
        res.status(200).send(challenge);
        return;
      }

      res.sendStatus(404);
    } catch (err) {
      next(err);
    }
  },
);

aivaChannelsInboundRouter.post(
  '/:channel/:workerId',
  express.raw({ type: '*/*', limit: '2mb' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = parseChannelParam(String(req.params.channel));
      const workerId = String(req.params.workerId);
      if (!channel) {
        res.status(404).json({ error: 'Unknown channel' });
        return;
      }

      const row = await loadEnabledWorkerChannel(workerId, channel, res);
      if (!row) return;

      const adapter = getAdapter(channel);
      if (!adapter) {
        res.status(404).json({ error: 'No adapter for channel' });
        return;
      }

      const rawBody = req.body as Buffer;
      const credentials = readChannelCredentials(row);
      if (!adapter.verify(headerMap(req), rawBody, credentials)) {
        res.status(401).json({ error: 'invalid webhook' });
        return;
      }

      res.status(200).json({ ok: true });

      let payload: unknown;
      try {
        payload = parseJsonBody(rawBody);
      } catch {
        console.warn(`[aiva-inbound] invalid JSON for ${channel}:${workerId}`);
        return;
      }

      const inbound = channel === 'twitter'
        ? parseTwitterWorkerInbound(payload, workerId, row.workspaceId, credentials)
        : adapter.parse(payload, workerId, row.workspaceId);
      if (!inbound) return;

      const entry: RegistryEntry = {
        workerId: row.workerId,
        workspaceId: row.workspaceId,
        channelRowId: row.id,
        credentialBlob: row.credentials.encrypted ?? '',
      };
      await handleParsedInbound(inbound, row.identifier, entry);
    } catch (err) {
      next(err);
    }
  },
);

export function mountAivaSocialInbound(app: Express): void {
  app.use('/api/aiva/channels/inbound', aivaChannelsInboundRouter);
}
