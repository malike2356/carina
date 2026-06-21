import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import session from 'express-session';
import chalk from 'chalk';
import { config } from './config/index.js';
import { initDb, pool } from './db.js';
import { initRedis, getRedis } from './redis.js';
import { requireApiKey, requireApiKeySse } from './middleware/auth.js';
import { requireScoutPro } from './middleware/plan-gate.js';
import { accountRouter } from './api/account.js';
import { provisionRouter } from './api/provision.js';
import { requireProvisionSecret } from './middleware/provision-auth.js';
import { eventsRouter } from './api/events.js';
import { heartbeatRouter } from './api/heartbeat.js';
import { sseRouter, initSseSubscriber } from './api/sse.js';
import { statusRouter } from './api/status.js';
import { killRouter } from './api/kill.js';
import { resumeRouter } from './api/resume.js';
import { policyRouter } from './api/policy.js';
import { policyEvaluateRouter } from './api/policy-evaluate.js';
import { jitPrivilegesRouter } from './api/jit-privileges.js';
import { attackSurfaceRouter } from './api/attack-surface.js';
import { responseTerminalRouter } from './api/response-terminal.js';
import { simulationRouter } from './api/simulation.js';
import { autoRemediationRouter } from './api/auto-remediation.js';
import { policyPacksRouter } from './api/policy-packs.js';
import { tripwiresRouter } from './api/tripwires.js';
import { statsRouter } from './api/stats.js';
import { adminRouter } from './api/admin.js';
import { getPlatformDashboardUrl, syncConfiguredAlertChannels } from './lib/alert-channels.js';
import { anomaliesRouter } from './api/anomalies.js';
import { honeypotsRouter } from './api/honeypots.js';
import { rateControlRouter } from './api/rate-control.js';
import { memoryControlRouter } from './api/memory-control.js';
import { instancesRouter } from './api/instances.js';
import { blockSessionRouter } from './api/block-session.js';
import { quarantineRouter } from './api/quarantine.js';
import { egressControlRouter } from './api/egress-control.js';
import { exportRouter } from './api/export.js';
import { dashboardRouter } from './api/dashboard.js';
import { markersRouter } from './api/markers.js';
import { deceptionRouter } from './api/deception.js';
import { killswitchRouter } from './api/killswitch-status.js';
import { auditSearchRouter } from './api/audit-search.js';
import { complianceRouter } from './api/compliance.js';
import { compliancePublicRouter } from './api/compliance-soc.js';
import { publicTrustRouter } from './api/public-trust.js';
import { readinessRouter } from './api/readiness.js';
import { trustEnterpriseRouter } from './api/trust-enterprise.js';
import { securityPostureRouter } from './api/security-posture.js';
import { incidentsRouter } from './api/incidents.js';
import { findingsRouter } from './api/findings.js';
import { targetsRouter } from './api/targets.js';
import { scansRouter } from './api/scans.js';
import { scoutScoreRouter } from './api/scout-score.js';
import { reportsRouter } from './api/reports.js';
import { attackSurfaceDashboardRouter } from './api/attack-surface-dashboard.js';
import { freeScanRouter } from './api/free-scan.js';
import { startScanWorker } from './engines/worker.js';
import { startScanScheduler } from './engines/scan-scheduler.js';
import { approvalsRouter } from './api/approvals.js';
import { governanceRouter } from './api/governance.js';
import { industryTemplatesRouter } from './api/industry-templates.js';
import { requireOperatorAuth } from './middleware/operator-auth.js';
import { resolveScoutCorsOrigin } from './lib/cors.js';
import { startScheduler } from './scheduler.js';
import { startProxyServer } from './proxy/openai-proxy.js';
import { actionsRouter } from './api/actions.js';
import { seedPlaybooks } from './actions/seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: config.auth.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.SCOUT_COOKIE_SECURE === 'true'
        || (process.env.NODE_ENV === 'production' && process.env.SCOUT_COOKIE_SECURE !== 'false'),
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  }),
);

const scoutCorsOrigin = process.env.SCOUT_CORS_ORIGIN
  ?? (process.env.NODE_ENV === 'production' ? '' : '*');

app.use((_req, res, next) => {
  const origin = _req.headers.origin;
  const allowedOrigin = resolveScoutCorsOrigin(scoutCorsOrigin, origin);
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Scout-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

function redirectHtml(stem: string) {
  return (_req: express.Request, res: express.Response): void => {
    res.redirect(301, stem);
  };
}

function serveGovernance(_req: express.Request, res: express.Response): void {
  try {
    const htmlPath = path.join(PUBLIC, 'governance.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const escaped = config.auth.apiKey.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const injection = `<script>window.__SCOUT_KEY = '${escaped}';</script>`;
    html = html.replace('<!-- __SCOUT_KEY_INJECTION__ -->', injection);
    res.type('html').send(html);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout] Governance serve failed:', msg);
    res.status(500).send('Governance dashboard unavailable');
  }
}

function serveDashboardEmbed(_req: express.Request, res: express.Response): void {
  try {
    const html = fs.readFileSync(path.join(PUBLIC, 'dashboard.html'), 'utf8');
    res.type('html').send(html);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout] Dashboard embed serve failed:', msg);
    res.status(500).send('Dashboard embed unavailable');
  }
}

function servePublicPage(file: string) {
  return (_req: express.Request, res: express.Response): void => {
    res.sendFile(path.join(PUBLIC, file));
  };
}

app.get('/favicon.ico', (_req, res) => {
  res.type('image/svg+xml');
  res.sendFile(path.join(PUBLIC, 'favicon.svg'));
});

app.get('/', servePublicPage('index.html'));
app.get('/checkout', servePublicPage('checkout.html'));
app.get('/checkout.html', redirectHtml('/checkout'));

const OPS_SCOUT_URL = process.env.OPS_SCOUT_URL ?? 'https://ops.carinaai.uk/scout';
const OPS_LOGIN_URL = process.env.OPS_LOGIN_URL ?? 'https://ops.carinaai.uk/login';

app.get('/dashboard/login', (_req, res) => {
  res.redirect(301, `${OPS_LOGIN_URL}?callbackUrl=${encodeURIComponent(OPS_SCOUT_URL)}`);
});
app.get('/dashboard/login.html', (_req, res) => {
  res.redirect(301, `${OPS_LOGIN_URL}?callbackUrl=${encodeURIComponent(OPS_SCOUT_URL)}`);
});
app.get('/dashboard', (_req, res) => res.redirect(301, OPS_SCOUT_URL));
app.get('/dashboard.html', (_req, res) => res.redirect(301, OPS_SCOUT_URL));
app.get('/embed/dashboard.html', serveDashboardEmbed);

app.get('/governance', serveGovernance);
app.get('/governance.html', redirectHtml('/governance'));
app.get('/pricing', servePublicPage('pricing.html'));
app.get('/pricing.html', redirectHtml('/pricing'));
app.get('/free', servePublicPage('free/index.html'));
app.get('/audit/:token', servePublicPage('audit.html'));
app.use(express.static(PUBLIC));

app.use('/account', accountRouter);
app.use('/api/internal', requireProvisionSecret, provisionRouter);
app.use('/api/public/trust', publicTrustRouter);
app.use('/api/public/compliance', compliancePublicRouter);
app.use('/api/v1/free-scan', freeScanRouter);
app.use('/api/readiness', readinessRouter);

app.use('/api/events', requireApiKey, eventsRouter);
app.use('/api/heartbeat', requireApiKey, heartbeatRouter);
app.use('/api/status', requireApiKey, statusRouter);
app.use('/api/kill', requireApiKey, requireScoutPro, killRouter);
app.use('/api/resume', requireApiKey, requireScoutPro, resumeRouter);
app.use('/api/policy', requireApiKey, policyRouter);
app.use('/api/policy', requireApiKey, policyEvaluateRouter);
app.use('/api/jit', requireApiKey, requireScoutPro, jitPrivilegesRouter);
app.use('/api/surface', requireApiKey, requireScoutPro, attackSurfaceRouter);
app.use('/api/response-terminal', requireApiKey, requireScoutPro, responseTerminalRouter);
app.use('/api/simulation', requireApiKey, requireScoutPro, simulationRouter);
app.use('/api/auto-remediation', requireApiKey, requireScoutPro, autoRemediationRouter);
app.use('/api/policy-packs', requireApiKey, requireScoutPro, policyPacksRouter);
app.use('/api/tripwires', requireApiKey, requireScoutPro, tripwiresRouter);
app.use('/api/stats', requireApiKey, statsRouter);
app.use('/api/admin', requireApiKey, adminRouter);
app.use('/api/anomalies', requireApiKey, anomaliesRouter);
app.use('/api/honeypots', requireApiKey, requireScoutPro, honeypotsRouter);
app.use('/api/deception', requireApiKey, requireScoutPro, deceptionRouter);
app.use('/api/rate-limit', requireApiKey, rateControlRouter);
app.use('/api/memory', requireApiKey, memoryControlRouter);
app.use('/api/instances', requireApiKey, instancesRouter);
app.use('/api/export', requireApiKey, requireScoutPro, exportRouter);
app.use('/api/dashboard', requireApiKey, dashboardRouter);
app.use('/api/admin/scout', requireApiKey, markersRouter);
app.use('/api/sessions', requireApiKey, requireScoutPro, blockSessionRouter);
app.use('/api/quarantine', requireApiKey, requireScoutPro, quarantineRouter);
app.use('/api/egress', requireApiKey, requireScoutPro, egressControlRouter);
app.use('/api/killswitch', requireApiKey, requireScoutPro, killswitchRouter);
app.use('/api/audit', requireApiKey, auditSearchRouter);
app.use('/api/compliance', requireApiKey, requireScoutPro, complianceRouter);
app.use('/api/security', requireApiKey, securityPostureRouter);
app.use('/api/trust', requireApiKey, requireScoutPro, trustEnterpriseRouter);
app.use('/api/incidents', requireApiKey, requireScoutPro, incidentsRouter);
app.use('/api/targets', requireApiKey, requireScoutPro, targetsRouter);
app.use('/api/findings', requireApiKey, requireScoutPro, findingsRouter);
app.use('/api/scans', requireApiKey, requireScoutPro, scansRouter);
app.use('/api/score', requireApiKey, requireScoutPro, scoutScoreRouter);
app.use('/api/reports', requireApiKey, requireScoutPro, reportsRouter);
app.use('/api/attack-surface', requireApiKey, requireScoutPro, attackSurfaceDashboardRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/governance/templates', requireApiKey, industryTemplatesRouter);
app.use('/api/governance', requireOperatorAuth, governanceRouter);
app.use('/api/actions', requireApiKey, actionsRouter);
app.use('/api/stream', requireApiKeySse, sseRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[scout:error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

async function shutdown(signal: string): Promise<void> {
  console.log(chalk.gray(`\n[scout] ${signal} received, shutting down...`));
  const redis = getRedis();
  if (redis) redis.disconnect();
  await pool.end().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

async function main(): Promise<void> {
  console.log(chalk.bold.hex('#d4af37')('LABYRINTH SCOUT') + chalk.gray(' - starting up'));

  await initDb();
  try {
    await seedPlaybooks();
    console.log(chalk.gray('[scout] Action playbooks seeded'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(chalk.yellow(`[scout] Action playbook seed skipped: ${msg}`));
  }
  try {
    const syncedChannels = await syncConfiguredAlertChannels();
    if (syncedChannels.length > 0) {
      console.log(chalk.gray(`[scout] Synced alert channels: ${syncedChannels.join(', ')}`));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(chalk.yellow(`[scout] Alert channel sync skipped: ${msg}`));
  }
  try {
    process.env.SCOUT_DASHBOARD_URL = await getPlatformDashboardUrl();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(chalk.yellow(`[scout] Platform dashboard URL not loaded: ${msg}`));
  }
  await initRedis();
  await initSseSubscriber();
  startScheduler();
  startScanWorker();
  startScanScheduler();
  startProxyServer();

  app.listen(config.port, () => {
    console.log(chalk.green(`[scout] Listening on http://localhost:${config.port}`));
    console.log(chalk.gray(`[scout] Dashboard: http://localhost:${config.port}/dashboard.html`));
    console.log(chalk.gray('[scout] Ready to receive events from Carina instances'));
  });
}

main().catch((err) => {
  console.error(chalk.red('[scout] Fatal startup error:'), err);
  process.exit(1);
});
