import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { requireAdmin } from './middleware/auth.js';
import { requireAllowedIp } from './middleware/ip-allowlist.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { memoriesRouter } from './routes/memories.js';
import { skillsRouter } from './routes/skills.js';
import { ragRouter } from './routes/rag.js';
import { chatRouter } from './routes/chat.js';
import { projectsRouter } from './routes/projects.js';
import { securityRouter } from './routes/security.js';
import { settingsRouter } from './routes/settings.js';
import { operatorRouter, operatorApiRouter } from './routes/operator.js';
import { agentToolsRouter } from './routes/agent-tools.js';
import { tenantsRouter } from './routes/tenants.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { packsRouter } from './routes/packs.js';
import { aiPlatformRouter } from './routes/ai-platform.js';
import { benchmarksRouter } from './routes/benchmarks.js';
import { channelsRouter } from './routes/channels.js';
import { controlCenterRouter } from './routes/control-center.js';
import { mcpRouter } from './routes/mcp.js';
import { tuiRouter } from './routes/tui.js';
import { incidentBlogRouter } from './routes/incident-blog.js';
import { scoutApiProxyRouter, scoutDashboardRouter } from './routes/scout-dashboard.js';
import { carinaToolsProxyRouter } from './routes/carina-tools-proxy.js';
import { governanceRouter } from './routes/governance.js';
import { mutationRouter } from './routes/mutation.js';
import { hrefWithUiVersion } from './lib/callback-url.js';
import { CARINA_BASE } from './lib/carina.js';
import { attachPtyBridge } from './lib/pty-bridge.js';
import { ensureHostedSchema } from './lib/tenants.js';
import { ensureAiPlatformSchema } from './lib/ai-platform.js';
import { ensureStandingOrdersSchema } from './lib/standing-orders-schema.js';
import { ensureAgentToolConfigSchema } from './lib/tool-config.js';
import { autoPairCarinaFromLocalCore } from './lib/carina-pairing.js';
import { bootstrapFirstUser } from './lib/bootstrap-users.js';
import { usersRouter } from './routes/users.js';
import { serverPanelRouter } from './routes/server-panel.js';
import { standingOrdersRouter } from './routes/standing-orders.js';
import { pricingRouter } from './routes/pricing.js';
import { billingConfigRouter } from './routes/billing-config.js';
import { usageGatesRouter } from './routes/usage-gates.js';
import { googleOAuthRouter } from './routes/google-oauth.js';
import { embeddingsRouter } from './routes/embeddings.js';
import { llmProvidersRouter } from './routes/llm-providers.js';
import { humanAssistBridgeRouter } from './routes/human-assist-bridge.js';
import { hostedEmailRouter } from './routes/hosted-email.js';
import { companiesHouseRouter } from './routes/companies-house.js';
import { spreadsheetProcessorRouter } from './routes/spreadsheet-processor.js';
import { provisionBusinessRouter } from './routes/provision-business.js';
import { aiUsageRouter } from './routes/ai-usage.js';
import { aiControlRouter } from './routes/ai-control.js';
import { opsAssistantRouter } from './routes/ops-assistant.js';
import { ensurePricingTable } from './lib/pricing-store.js';
import { ensureBillingConfigTable } from './lib/billing-config-store.js';
import { businessAdminProxyRouter, businessAdminShellRouter, businessAdminApiProxyRouter, businessAdminStaticProxyRouter } from './routes/business-admin-proxy.js';
import { ensureBusinessAdminSession } from './lib/ensure-business-admin.js';
import { PgSessionStore } from './lib/pg-session-store.js';

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
// tsx runs server.ts from the ops root; tsc compiles it one level down into dist/.
const __opsDir = path.basename(__moduleDir) === 'dist' ? path.dirname(__moduleDir) : __moduleDir;
dotenv.config({ path: path.join(__opsDir, '.env') });

const app = express();
const defaultPort = process.env.NODE_ENV === 'production' ? 4002 : 4000;
const PORT = Number(process.env.PORT ?? process.env.OPS_PORT ?? defaultPort);
const viewsPath = path.join(__opsDir, 'views');

app.set('trust proxy', 1);
app.use(requireAllowedIp);
app.set('view engine', 'ejs');
app.set('views', viewsPath);

app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  next();
});

app.use(express.static(path.join(__opsDir, 'public')));

app.get('/favicon.ico', (_req, res) => {
  res.type('image/png');
  res.sendFile(path.join(__opsDir, 'public', 'brand', 'carina-icon.png'));
});

app.use((req, res, next) => {
  const original = res.render.bind(res) as (
    view: string,
    options?: object,
    callback?: (err: Error, html: string) => void,
  ) => void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).render = function renderWithLayout(
    view: string,
    options?: object,
    callback?: (err: Error, html: string) => void,
  ) {
    const opts = (options ?? {}) as Record<string, unknown>;
    if (view === 'login' || view === 'layout' || view === 'tui' || opts.bare) {
      return original(view, opts, callback);
    }
    original(view, opts, (err, html) => {
      if (err) {
        if (callback) callback(err, '');
        else next(err);
        return;
      }
      original('layout', { ...opts, body: html, title: opts.title }, callback);
    });
  };
  next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const sessionStore = new PgSessionStore();

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET ?? 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

app.use((req, res, next) => {
  const uiVersion = process.env.UI_VERSION ?? '20260730k';
  res.locals.carinaApiUrl = CARINA_BASE;
  res.locals.webUiUrl = process.env.CARINA_HOSTED_APP_URL ?? 'https://app.carinaai.uk';
  res.locals.uiVersion = uiVersion;
  res.locals.withV = (href: string) => hrefWithUiVersion(href, uiVersion);
  res.locals.activePath = req.path;
  res.locals.session = req.session;
  next();
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'carina-ops',
    revision: process.env.BUILD_REVISION ?? 'unknown',
    imageDigest: process.env.IMAGE_DIGEST ?? 'unknown',
    buildTime: process.env.BUILD_TIME ?? 'unknown',
  });
});

app.use(authRouter);

// Hashed Next.js assets for embedded business admin (public; filenames are content-addressed).
app.use('/business-inner/_next', businessAdminStaticProxyRouter);
app.use('/business/_next', businessAdminStaticProxyRouter);

app.use(requireAdmin);
app.get('/trust', (_req, res) => {
  res.redirect(302, hrefWithUiVersion('/governance/trust', res.locals.uiVersion as string));
});
app.use('/', dashboardRouter);
app.use('/security', securityRouter);
app.use('/channels', channelsRouter);
app.use('/memories', memoriesRouter);
app.use('/skills', skillsRouter);
app.use('/packs', packsRouter);
app.use('/rag', ragRouter);
app.use('/embeddings', embeddingsRouter);
app.use('/llm-providers', llmProvidersRouter);
app.use('/chat', chatRouter);
app.use('/projects', projectsRouter);
app.use('/admin/incident-blog', incidentBlogRouter);
app.use('/tenants', tenantsRouter);
app.use('/subscriptions', subscriptionsRouter);
app.use('/control-center', controlCenterRouter);
app.use('/mcp', mcpRouter);
app.use('/settings', settingsRouter);
app.use('/operator', operatorRouter);
app.use('/operator/api', operatorApiRouter);
app.use('/tui', tuiRouter);
app.use('/ai-platform', aiPlatformRouter);
app.use('/benchmarks', benchmarksRouter);
app.use('/admin/agent-tools', agentToolsRouter);
app.use('/agent-tools', agentToolsRouter);
app.use('/standing-orders', standingOrdersRouter);

app.use('/pricing', pricingRouter);
app.use('/billing-config', billingConfigRouter);
app.use('/usage-gates', usageGatesRouter);
app.use('/google-oauth', googleOAuthRouter);
app.use('/hosted-email', hostedEmailRouter);
app.use('/companies-house', companiesHouseRouter);
app.use('/human-assist-bridge', humanAssistBridgeRouter);
app.use('/spreadsheet-processor', spreadsheetProcessorRouter);
app.use('/ai-usage', aiUsageRouter);
app.use('/ai-control', aiControlRouter);
app.use('/ops-assistant', opsAssistantRouter);
app.use('/admin/provision-business', provisionBusinessRouter);
app.use('/governance', governanceRouter);
app.use('/mutation', mutationRouter);
app.use('/users', usersRouter);
app.use('/server', serverPanelRouter);

app.use('/dashboard', requireAdmin, scoutDashboardRouter);
app.use('/scout-api', requireAdmin, scoutApiProxyRouter);
app.use('/scout', requireAdmin, scoutDashboardRouter);
app.use('/business-inner', requireAdmin, ensureBusinessAdminSession, businessAdminProxyRouter);
app.use('/api/admin', requireAdmin, ensureBusinessAdminSession, businessAdminApiProxyRouter);
app.use('/business', requireAdmin, ensureBusinessAdminSession, businessAdminShellRouter);
app.use('/api/carina-ops/tools', requireAdmin, carinaToolsProxyRouter);

app.use((req, res) => {
  const path = (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';
  if (path.startsWith('/scout-api') || path.startsWith('/api/')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.status(404).render('error', { message: 'Page not found' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ops] unhandled error:', err);
  if (res.headersSent) return;
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).render('error', { message });
});

const listenHost = process.env.BIND_HOST ?? (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');
const server = createServer(app);
attachPtyBridge(server);

server.listen(PORT, listenHost, () => {
  console.log(chalk.green(`Carina Platform Admin at http://localhost:${PORT}`));
  console.log(chalk.gray(`  PTY bridge: ws://localhost:${PORT}/ws/tui`));
  console.log(chalk.gray('  Browser TUI: http://localhost:' + PORT + '/tui'));
  console.log(chalk.gray('  Login: ops.carinaai.uk/login (email + password)'));
  void bootstrapFirstUser()
    .then(() => console.log(chalk.gray('  Ops users: ready')))
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(chalk.yellow(`  Ops users: skipped (${msg})`));
    });
  void ensureHostedSchema()
    .then(() => console.log(chalk.gray('  Hosted schema: ready')))
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(chalk.yellow(`  Hosted schema: skipped (${msg})`));
    });
  void ensureAiPlatformSchema()
    .then(() => console.log(chalk.gray('  AI platform schema: ready')))
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(chalk.yellow(`  AI platform schema: skipped (${msg})`));
    });
  void ensureStandingOrdersSchema()
    .then(() => console.log(chalk.gray('  Standing orders schema: ready')))
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(chalk.yellow(`  Standing orders schema: skipped (${msg})`));
    });
  void ensureAgentToolConfigSchema()
    .then(() => console.log(chalk.gray('  Agent tool config: ready')))
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(chalk.yellow(`  Agent tool config: skipped (${msg})`));
    });
  void ensurePricingTable()
    .then(() => console.log(chalk.gray('  Platform pricing: ready')))
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(chalk.yellow(`  Platform pricing: skipped (${msg})`));
    });
  void ensureBillingConfigTable()
    .then(() => console.log(chalk.gray('  Billing config: ready')))
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(chalk.yellow(`  Billing config: skipped (${msg})`));
    });
  void autoPairCarinaFromLocalCore()
    .then((result) => {
      if (result.ok && result.auto) {
        console.log(chalk.gray('  Carina auto-pair: connected from local core .env'));
      } else if (result.ok && result.alreadyPaired) {
        console.log(chalk.gray('  Carina auto-pair: already connected'));
      }
    })
    .catch(() => undefined);
  void sessionStore.pruneExpired()
    .then((n) => console.log(chalk.gray(`  Session store: postgres (pruned ${n} expired)`)))
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(chalk.yellow(`  Session store: postgres init warning (${msg})`));
    });
  setInterval(() => {
    void sessionStore.pruneExpired().catch(() => undefined);
  }, 60 * 60 * 1000).unref();
});
