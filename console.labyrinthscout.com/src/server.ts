import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import session from 'express-session';
import chalk from 'chalk';
import { config } from './config/index.js';
import { initDb, pool } from './db.js';
import { initRedis, getRedis } from './redis.js';
import { requireApiKey } from './middleware/auth.js';
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
import { statsRouter } from './api/stats.js';
import { adminRouter } from './api/admin.js';
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
import { killswitchRouter } from './api/killswitch-status.js';
import { auditSearchRouter } from './api/audit-search.js';
import { complianceRouter } from './api/compliance.js';
import { publicTrustRouter } from './api/public-trust.js';
import { startScheduler } from './scheduler.js';
import { startProxyServer } from './proxy/openai-proxy.js';

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
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Scout-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

function serveDashboard(_req: express.Request, res: express.Response): void {
  try {
    const htmlPath = path.join(PUBLIC, 'dashboard.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const escaped = config.auth.apiKey.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const injection = `<script>window.__SCOUT_KEY = '${escaped}';</script>`;
    html = html.replace('<!-- __SCOUT_KEY_INJECTION__ -->', injection);
    res.type('html').send(html);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout] Dashboard serve failed:', msg);
    res.status(500).send('Dashboard unavailable');
  }
}

function redirectHtml(stem: string) {
  return (_req: express.Request, res: express.Response): void => {
    res.redirect(301, stem);
  };
}

function servePublicPage(file: string) {
  return (_req: express.Request, res: express.Response): void => {
    res.sendFile(path.join(PUBLIC, file));
  };
}

app.get('/', serveDashboard);
app.get('/dashboard', serveDashboard);
app.get('/dashboard.html', redirectHtml('/dashboard'));
app.get('/pricing', servePublicPage('pricing.html'));
app.get('/pricing.html', redirectHtml('/pricing'));
app.use(express.static(PUBLIC));

app.use('/account', accountRouter);
app.use('/api/internal', requireProvisionSecret, provisionRouter);
app.use('/api/public/trust', publicTrustRouter);

app.use('/api/events', requireApiKey, eventsRouter);
app.use('/api/heartbeat', requireApiKey, heartbeatRouter);
app.use('/api/status', requireApiKey, statusRouter);
app.use('/api/kill', requireApiKey, killRouter);
app.use('/api/resume', requireApiKey, resumeRouter);
app.use('/api/policy', requireApiKey, policyRouter);
app.use('/api/stats', requireApiKey, statsRouter);
app.use('/api/admin', requireApiKey, adminRouter);
app.use('/api/anomalies', requireApiKey, anomaliesRouter);
app.use('/api/honeypots', requireApiKey, honeypotsRouter);
app.use('/api/rate-limit', requireApiKey, rateControlRouter);
app.use('/api/memory', requireApiKey, memoryControlRouter);
app.use('/api/instances', requireApiKey, instancesRouter);
app.use('/api/export', requireApiKey, exportRouter);
app.use('/api/dashboard', requireApiKey, dashboardRouter);
app.use('/api/admin/scout', requireApiKey, markersRouter);
app.use('/api/sessions', requireApiKey, blockSessionRouter);
app.use('/api/quarantine', requireApiKey, quarantineRouter);
app.use('/api/egress', requireApiKey, egressControlRouter);
app.use('/api/killswitch', requireApiKey, killswitchRouter);
app.use('/api/audit', requireApiKey, auditSearchRouter);
app.use('/api/compliance', requireApiKey, complianceRouter);
app.use('/api/stream', sseRouter);

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
  await initRedis();
  await initSseSubscriber();
  startScheduler();
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
