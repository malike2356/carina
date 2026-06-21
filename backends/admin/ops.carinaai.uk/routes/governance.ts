import { Router } from 'express';

export const governanceRouter = Router();

governanceRouter.get('/', (_req, res) => {
  res.render('governance/index', { title: 'Governance' });
});

governanceRouter.get('/soc2', (_req, res) => {
  res.render('governance/soc2', { title: 'SOC2' });
});

governanceRouter.get('/trust', (_req, res) => {
  res.render('governance/trust', { title: 'Trust Verify' });
});

governanceRouter.get('/posture', (_req, res) => {
  res.render('governance/posture', { title: 'Security Posture' });
});

governanceRouter.get('/audit', (_req, res) => {
  res.render('governance/audit', { title: 'Audit Logs' });
});
