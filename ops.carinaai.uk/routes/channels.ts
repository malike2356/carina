import { Router } from 'express';
import { fetchChannelStatusReports } from '../lib/channel-status.js';
import { CARINA_BASE } from '../lib/carina.js';

export const channelsRouter = Router();

channelsRouter.get('/', async (_req, res) => {
  try {
    const { channels, policyFlags } = await fetchChannelStatusReports();
    res.render('channels', {
      title: 'Channels',
      channels,
      policyFlags,
      carinaApiUrl: CARINA_BASE,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});
