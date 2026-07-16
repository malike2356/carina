import type { Response, Router } from 'express';
import { Router as createRouter } from 'express';
import {
  getChannelMemoryGrouped,
  getChannelMemoryStats,
  purgeChannelMemory,
} from '../agents/ambient/channel-memory-admin.js';

type AdminRequest = { query: Record<string, unknown>; params: Record<string, unknown> };

export function createChannelMemoryAdminRouter(): Router {
  const router = createRouter();

  router.get('/channel-memory/stats', async (_req: AdminRequest, res: Response) => {
    res.json(await getChannelMemoryStats());
  });

  router.get('/channel-memory', async (req: AdminRequest, res: Response) => {
    const channel = String(req.query.channel ?? '').trim();
    if (!channel) {
      res.status(400).json({ error: 'channel query parameter is required' });
      return;
    }
    res.json({
      channel,
      facts: await getChannelMemoryGrouped(channel),
    });
  });

  router.post('/channel-memory/:channel/purge', async (req: AdminRequest, res: Response) => {
    const channel = String(req.params.channel ?? '').trim();
    if (!channel) {
      res.status(400).json({ error: 'channel id is required' });
      return;
    }
    const removed = await purgeChannelMemory(channel);
    res.json({ channel, removed });
  });

  return router;
}
