import { Router } from 'express';
import { fetchChannelStatusReports } from '../lib/channel-status.js';

export const channelsRouter = Router();

channelsRouter.get('/', async (_req, res) => {
  try {
    const { channels, policyFlags } = await fetchChannelStatusReports();
    res.render('channels', {
      title: 'Channels',
      channels,
      policyFlags,
      carinaApiUrl: process.env.CARINA_API_URL ?? 'http://localhost:3333',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});
