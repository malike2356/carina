import { Router } from 'express';
import { syncSoc2Evidence } from '../lib/compliance-sync.js';
import { getAivaTrustSummary } from '../lib/aiva-trust-summary.js';

export const governanceRouter = Router();

governanceRouter.get('/', (_req, res) => {
  res.render('governance/index', { title: 'Governance' });
});

governanceRouter.get('/soc2', (req, res) => {
  res.render('governance/soc2', { title: 'SOC2', query: req.query });
});

governanceRouter.post('/soc2/sync', async (req, res) => {
  const refresh = req.body?.refresh === '1' || req.body?.refresh === true || req.query.refresh === '1';
  try {
    const result = await syncSoc2Evidence({ refresh });
    if (req.headers.accept?.includes('application/json')) {
      res.json(result);
      return;
    }
    const params = new URLSearchParams({
      synced: '1',
      inserted: String(result.inserted),
      controls: String(result.controlsTouched.length),
    });
    res.redirect(`/governance/soc2?${params.toString()}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (req.headers.accept?.includes('application/json')) {
      res.status(500).json({ error: message });
      return;
    }
    res.redirect(`/governance/soc2?sync_error=${encodeURIComponent(message)}`);
  }
});

governanceRouter.get('/trust', (_req, res) => {
  res.render('governance/trust', {
    title: 'Blockchain Trust',
    publicTrustUrl: process.env.PUBLIC_TRUST_URL?.trim() || 'https://carinaai.uk/trust',
    scoutTrustDocsUrl: process.env.SCOUT_TRUST_DOCS_URL?.trim()
      || 'https://console.labyrinthscout.com/docs/trust/platform.html',
  });
});

governanceRouter.get('/trust/aiva-summary', async (_req, res) => {
  try {
    res.json(await getAivaTrustSummary());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: message || 'Failed to load Aiva trust summary' });
  }
});

governanceRouter.get('/posture', (_req, res) => {
  res.render('governance/posture', { title: 'Security Posture' });
});

governanceRouter.get('/audit', (_req, res) => {
  res.render('governance/audit', { title: 'Audit Logs' });
});
