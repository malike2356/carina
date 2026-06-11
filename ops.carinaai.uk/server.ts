import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import session from 'express-session';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { requireAdmin } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { memoriesRouter } from './routes/memories.js';
import { skillsRouter } from './routes/skills.js';
import { ragRouter } from './routes/rag.js';
import { chatRouter } from './routes/chat.js';
import { projectsRouter } from './routes/projects.js';
import { securityRouter } from './routes/security.js';
import { settingsRouter } from './routes/settings.js';
import { operatorRouter } from './routes/operator.js';
import { tenantsRouter } from './routes/tenants.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { packsRouter } from './routes/packs.js';
import { ensureHostedSchema } from './lib/tenants.js';
import { autoPairCarinaFromLocalCore } from './lib/carina-pairing.js';

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
// tsx runs server.ts from the ops root; tsc compiles it one level down into dist/.
const __opsDir = path.basename(__moduleDir) === 'dist' ? path.dirname(__moduleDir) : __moduleDir;
dotenv.config({ path: path.join(__opsDir, '.env') });

const app = express();
const PORT = Number(process.env.OPS_BACKEND_PORT ?? process.env.PORT ?? 4000);
const viewsPath = path.join(__opsDir, 'views');

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', viewsPath);

app.use(express.static(path.join(__opsDir, 'public')));

app.get('/favicon.ico', (_req, res) => {
  res.type('image/svg+xml');
  res.sendFile(path.join(__opsDir, 'public', 'favicon.svg'));
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
    if (view === 'login' || view === 'layout') {
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

app.use(
  session({
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
  res.locals.carinaApiUrl = process.env.CARINA_API_URL ?? 'http://localhost:3333';
  res.locals.webUiUrl = res.locals.carinaApiUrl;
  res.locals.activePath = req.path;
  next();
});

app.use(authRouter);

app.use(requireAdmin);
app.use('/', dashboardRouter);
app.use('/security', securityRouter);
app.use('/memories', memoriesRouter);
app.use('/skills', skillsRouter);
app.use('/packs', packsRouter);
app.use('/rag', ragRouter);
app.use('/chat', chatRouter);
app.use('/projects', projectsRouter);
app.use('/tenants', tenantsRouter);
app.use('/subscriptions', subscriptionsRouter);
app.use('/settings', settingsRouter);
app.use('/operator', operatorRouter);

app.use((_req, res) => {
  res.status(404).render('error', { message: 'Page not found' });
});

const listenHost = process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0';
app.listen(PORT, listenHost, () => {
  console.log(chalk.green(`Carina Platform Admin at http://localhost:${PORT}`));
  console.log(chalk.gray('  Password: ops.carinaai.uk/.env ADMIN_PASSWORD'));
  void ensureHostedSchema()
    .then(() => console.log(chalk.gray('  Hosted schema: ready')))
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(chalk.yellow(`  Hosted schema: skipped (${msg})`));
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
});
