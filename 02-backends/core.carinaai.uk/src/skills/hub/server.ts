import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { type Express, type Request, type Response } from 'express';
import { config } from '../../config/index.js';
import { initHubDb, hubPool } from './migrations.js';
import { authorizeOps } from '../../ops/ops-auth.js';
import {
  createSubmission,
  getSubmission,
  publishSubmission,
  reviewSubmission,
  sendPublicationEmail,
  sendRejectionEmail,
  sendSubmissionConfirmation,
  validateSubmissionInput,
} from './marketplace-submissions.js';
import {
  getHubPack,
  getHubSkill,
  getPackArchivePath,
  getRegistrySummary,
  listAuthorPacks,
  listHubPacks,
  listHubSkills,
  recordPackDownload,
} from './registry.js';
import { packRequiresLicense, validatePackLicense } from './pack-licenses.js';
import { seedHubRegistry } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKS_STORAGE = path.resolve(__dirname, '../../../data/hub-packs');
const PUBLIC_DIR = path.join(__dirname, 'public');

const HUB_CORS_ORIGINS = new Set([
  config.product.marketingUrl,
  `https://www.${config.product.domain}`,
  config.product.docsUrl,
  config.product.hubUrl,
  config.product.skillsUrl,
  'http://localhost:3001',
  'http://127.0.0.1:3001',
]);

const PUBLISH_RATE_WINDOW_MS = 60 * 60 * 1000;
const PUBLISH_RATE_MAX = 20;
const publishRateHits = new Map<string, number[]>();

const REVIEW_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const reviewRateHits = new Map<string, number>();

function reviewRateLimit(authorId: string, packName: string, skillName: string, res: Response): boolean {
  const key = `${authorId}:${packName}:${skillName}`;
  const last = reviewRateHits.get(key) ?? 0;
  const now = Date.now();
  if (now - last < REVIEW_RATE_WINDOW_MS) {
    res.status(429).json({ error: 'You have already submitted a review for this skill recently.' });
    return false;
  }
  reviewRateHits.set(key, now);
  return true;
}

function hubCorsMiddleware(req: Request, res: Response, next: () => void): void {
  const origin = req.headers.origin;
  if (origin && HUB_CORS_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, X-Api-Key, X-Pack-Manifest, X-Pack-Featured',
    );
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

function publishRateLimit(req: Request, res: Response): boolean {
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown')
    .split(',')[0]
    .trim();
  const now = Date.now();
  const hits = (publishRateHits.get(ip) ?? []).filter((t) => now - t < PUBLISH_RATE_WINDOW_MS);
  if (hits.length >= PUBLISH_RATE_MAX) {
    res.status(429).json({ error: 'Publish rate limit exceeded. Try again later.' });
    return false;
  }
  hits.push(now);
  publishRateHits.set(ip, hits);
  return true;
}

function parseBool(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}

export function createSkillsHubApp(): Express {
  const app = express();
  app.use(hubCorsMiddleware);

  app.post(
    '/api/packs/publish',
    express.raw({
      type: ['application/gzip', 'application/octet-stream', 'application/x-gzip'],
      limit: '100mb',
    }),
    async (req, res, next) => {
      try {
        if (!publishRateLimit(req, res)) return;
        const apiKey = req.headers['x-api-key'] ?? req.headers.authorization;
        const token = String(apiKey ?? '').replace(/^Bearer\s+/i, '');
        if (!config.hub.publishApiKey || token !== config.hub.publishApiKey) {
          res.status(401).json({ error: 'Invalid publish API key' });
          return;
        }

        const manifestHeader = String(req.headers['x-pack-manifest'] ?? '');
        if (!manifestHeader) {
          res.status(400).json({ error: 'X-Pack-Manifest header is required' });
          return;
        }

        const archiveBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
        if (archiveBuffer.length === 0) {
          res.status(400).json({ error: 'Pack archive body is required' });
          return;
        }

        JSON.parse(Buffer.from(manifestHeader, 'base64url').toString('utf8'));

        const { publishPackArchiveBuffer } = await import('./publish-pack.js');
        const result = await publishPackArchiveBuffer(archiveBuffer, PACKS_STORAGE, {
          featured: req.headers['x-pack-featured'] === 'true',
        });
        res.status(201).json({
          ...result,
          pendingVerification: req.headers['x-pack-featured'] !== 'true',
        });
      } catch (err) {
        next(err);
      }
    },
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.static(PUBLIC_DIR));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'carina-skills-hub' });
  });

  app.get('/api/registry', async (_req, res, next) => {
    try {
      res.json(await getRegistrySummary());
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/packs', async (req, res, next) => {
    try {
      const packs = await listHubPacks({
        q: String(req.query.q ?? ''),
        category: req.query.category ? String(req.query.category) : undefined,
        featured: parseBool(req.query.featured),
      });
      res.json({ packs });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/packs/:name', async (req, res, next) => {
    try {
      const pack = await getHubPack(req.params.name);
      if (!pack) {
        res.status(404).json({ error: 'Pack not found' });
        return;
      }
      const skills = await listHubSkills({ pack: pack.name, limit: 500 });
      res.json({ ...pack, skills });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/packs/:name/download', async (req, res, next) => {
    try {
      await handlePackDownload(req.params.name, res, req);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/skills', async (req, res, next) => {
    try {
      const skills = await listHubSkills({
        q: String(req.query.q ?? ''),
        pack: req.query.pack ? String(req.query.pack) : undefined,
        category: req.query.category ? String(req.query.category) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json({ skills });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/skills/:pack/:name', async (req, res, next) => {
    try {
      const skill = await getHubSkill(req.params.pack, req.params.name);
      if (!skill) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }
      const pack = await getHubPack(req.params.pack);
      res.json({ ...skill, pack });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/v1/skills/:pack/:name/reviews', async (req, res, next) => {
    try {
      const { pack, name } = req.params;
      const { rating, body, author_id } = req.body as {
        rating?: unknown;
        body?: unknown;
        author_id?: unknown;
      };

      const ratingNum = Number(rating);
      if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        res.status(400).json({ error: 'rating must be an integer 1-5' });
        return;
      }
      const authorId = String(author_id ?? '').trim();
      if (!authorId || authorId.length > 128) {
        res.status(400).json({ error: 'author_id is required (max 128 chars)' });
        return;
      }
      const reviewBody = String(body ?? '').trim().slice(0, 2000);

      if (!reviewRateLimit(authorId, pack, name, res)) return;

      const { hubPool } = await import('./migrations.js');
      await hubPool.query(
        `INSERT INTO hub_skill_reviews (pack_name, skill_name, author_id, rating, body)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ON CONSTRAINT hub_skill_reviews_unique_author
         DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body`,
        [pack, name, authorId, ratingNum, reviewBody],
      );

      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/v1/skills/:pack/:name/reviews', async (req, res, next) => {
    try {
      const { pack, name } = req.params;
      const limit = Math.min(Number(req.query.limit ?? 20), 100);
      const offset = Number(req.query.offset ?? 0);

      const { hubPool } = await import('./migrations.js');
      const result = await hubPool.query<{
        id: string;
        author_id: string;
        rating: number;
        body: string;
        created_at: string;
      }>(
        `SELECT id, author_id, rating, body, created_at
         FROM hub_skill_reviews
         WHERE pack_name = $1 AND skill_name = $2
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [pack, name, limit, offset],
      );

      const countResult = await hubPool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM hub_skill_reviews WHERE pack_name = $1 AND skill_name = $2`,
        [pack, name],
      );

      res.json({
        reviews: result.rows,
        total: Number(countResult.rows[0]?.count ?? 0),
        limit,
        offset,
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/categories', async (_req, res, next) => {
    try {
      const summary = await getRegistrySummary();
      res.json({ categories: summary.categories });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/marketplace', async (req, res, next) => {
    try {
      const { queryMarketplaceCatalog } = await import('./marketplace-catalog.js');
      const packs = await listHubPacks();
      const result = await queryMarketplaceCatalog({
        kind: req.query.kind ? String(req.query.kind) as import('./marketplace-types.js').MarketplaceEntryKind : undefined,
        q: String(req.query.q ?? ''),
        category: req.query.category ? String(req.query.category) : undefined,
        featured: parseBool(req.query.featured),
        verified: parseBool(req.query.verified),
        publisher: req.query.publisher
          ? String(req.query.publisher) as import('./marketplace-types.js').MarketplacePublisher
          : undefined,
      }, { hubPacks: packs, includeHubDb: true });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/marketplace/:id', async (req, res, next) => {
    try {
      const { getMarketplaceEntry } = await import('./marketplace-catalog.js');
      const packs = await listHubPacks();
      const entry = await getMarketplaceEntry(req.params.id, { hubPacks: packs, includeHubDb: true });
      if (!entry) {
        res.status(404).json({ error: 'Marketplace entry not found' });
        return;
      }
      res.json({ entry });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/marketplace/publish', async (req, res, next) => {
    try {
      if (!publishRateLimit(req, res)) return;
      const apiKey = req.headers['x-api-key'] ?? req.headers.authorization;
      const token = String(apiKey ?? '').replace(/^Bearer\s+/i, '');
      if (!config.hub.publishApiKey || token !== config.hub.publishApiKey) {
        res.status(401).json({ error: 'Invalid publish API key' });
        return;
      }
      const { validateMarketplaceEntryInput } = await import('./marketplace-validate.js');
      const { upsertHubMarketplaceEntry } = await import('./marketplace-registry.js');
      const input = validateMarketplaceEntryInput(req.body, 'publish body');
      const { scanSkillContent } = await import('./hub-security-scanner.js');
      const contentToScan = [
        input.description,
        input.name,
        JSON.stringify(input.install),
      ].join('\n');
      const verdict = await scanSkillContent(contentToScan);
      input.trust = {
        ...input.trust,
        publisher: 'community',
        validation: verdict.passed ? 'passed' : 'pending',
        verified: false,
      };
      await upsertHubMarketplaceEntry(input);
      res.status(201).json({
        id: input.id,
        pendingVerification: !verdict.passed,
        badge: verdict.badge,
        flags: verdict.passed ? [] : verdict.flags,
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/author/packs', async (req, res, next) => {
    try {
      const apiKey = req.headers['x-api-key'] ?? req.headers.authorization;
      const token = String(apiKey ?? '').replace(/^Bearer\s+/i, '');
      if (!config.hub.publishApiKey || token !== config.hub.publishApiKey) {
        res.status(401).json({ error: 'Invalid publish API key' });
        return;
      }
      const author = String(req.query.author ?? '').trim();
      if (!author) {
        res.status(400).json({ error: 'author query parameter is required' });
        return;
      }
      const packs = await listAuthorPacks(author);
      res.json({ packs });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/ecosystem/metrics', async (_req, res, next) => {
    try {
      const { buildEcosystemMetrics } = await import('./ecosystem-metrics.js');
      res.json(await buildEcosystemMetrics());
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/shared-skills', async (req, res, next) => {
    try {
      const { listSharedSkillsFromStore } = await import('./shared-skills-store.js');
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const skills = await listSharedSkillsFromStore(PACKS_STORAGE, limit);
      res.json({ skills, count: skills.length });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/shared-skills/publish', async (req, res, next) => {
    try {
      if (!publishRateLimit(req, res)) return;
      const apiKey = req.headers['x-api-key'] ?? req.headers.authorization;
      const token = String(apiKey ?? '').replace(/^Bearer\s+/i, '');
      if (!config.hub.publishApiKey || token !== config.hub.publishApiKey) {
        res.status(401).json({ error: 'Invalid publish API key' });
        return;
      }
      const { publishSharedSkillsToStore } = await import('./shared-skills-store.js');
      const published = await publishSharedSkillsToStore(PACKS_STORAGE, req.body);
      res.status(201).json({ published, url: '/api/shared-skills' });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/packs/:name/checkout', async (req, res, next) => {
    try {
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      if (!email) {
        res.status(400).json({ error: 'email is required' });
        return;
      }
      const { createPackCheckoutSession } = await import('./billing/pack-checkout.js');
      const result = await createPackCheckoutSession({
        packName: req.params.name,
        email,
        successUrl: req.body?.successUrl ? String(req.body.successUrl) : undefined,
        cancelUrl: req.body?.cancelUrl ? String(req.body.cancelUrl) : undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/packs/:name/license/fulfill', async (req, res, next) => {
    try {
      const sessionId = String(req.body?.sessionId ?? req.query.session_id ?? '').trim();
      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }
      const { fulfillPackCheckoutSession } = await import('./billing/pack-checkout.js');
      const license = await fulfillPackCheckoutSession(sessionId);
      if (!license || license.packName !== req.params.name) {
        res.status(404).json({ error: 'License not available for this session' });
        return;
      }
      res.json({ license });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/packs/:name/license/validate', async (req, res, next) => {
    try {
      const token = String(req.query.token ?? req.headers['x-pack-license'] ?? '').trim();
      if (!token) {
        res.status(400).json({ error: 'token is required' });
        return;
      }
      const valid = await validatePackLicense(req.params.name, token);
      res.json({ valid, packName: req.params.name });
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/webhooks/stripe/packs',
    express.raw({ type: 'application/json' }),
    async (req, res, next) => {
      try {
        const signature = String(req.headers['stripe-signature'] ?? '');
        const { constructPackWebhookEvent, handlePackCheckoutCompleted } =
          await import('./billing/pack-checkout.js');
        const event = constructPackWebhookEvent(req.body as Buffer, signature);
        if (event.type === 'checkout.session.completed') {
          await handlePackCheckoutCompleted(event.data.object as import('stripe').Stripe.Checkout.Session);
        }
        res.json({ received: true });
      } catch (err) {
        next(err);
      }
    },
  );

  // Legacy API paths (docs + install-pack)
  app.get('/packs', async (req, res, next) => {
    try {
      const packs = await listHubPacks({ q: String(req.query.q ?? '') });
      res.json({ packs });
    } catch (err) {
      next(err);
    }
  });

  app.get('/packs/:name', async (req, res, next) => {
    try {
      const pack = await getHubPack(req.params.name);
      if (!pack) {
        res.status(404).json({ error: 'Pack not found' });
        return;
      }
      res.json(pack);
    } catch (err) {
      next(err);
    }
  });

  app.get('/packs/:name/download', async (req, res, next) => {
    try {
      await handlePackDownload(req.params.name, res, req);
    } catch (err) {
      next(err);
    }
  });

  app.post('/packs', async (req, res, next) => {
    try {
      if (!publishRateLimit(req, res)) return;
      const apiKey = req.headers['x-api-key'] ?? req.headers.authorization;
      const token = String(apiKey ?? '').replace(/^Bearer\s+/i, '');
      if (!config.hub.publishApiKey || token !== config.hub.publishApiKey) {
        res.status(401).json({ error: 'Invalid publish API key' });
        return;
      }

      const body = req.body as { packDir?: string; featured?: boolean };
      const packDir = body?.packDir?.trim();
      if (!packDir) {
        res.status(400).json({ error: 'packDir is required in JSON body' });
        return;
      }

      const { publishPackDirectory } = await import('./publish-pack.js');
      const result = await publishPackDirectory(packDir, PACKS_STORAGE, {
        featured: body.featured === true,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // ---- Submission rate limiting (3 per email per day) ----
  const SUBMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
  const submitHits = new Map<string, number[]>();

  function submissionRateLimit(email: string, res: Response): boolean {
    const now = Date.now();
    const hits = (submitHits.get(email) ?? []).filter((t) => now - t < SUBMIT_WINDOW_MS);
    if (hits.length >= 3) {
      res.status(429).json({ error: 'Rate limit: max 3 submissions per email per day.' });
      return false;
    }
    hits.push(now);
    submitHits.set(email, hits);
    return true;
  }

  // ---- Submission routes ----

  app.post('/api/submissions', async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const errors = validateSubmissionInput(body);
      if (errors.length > 0) {
        res.status(400).json({ error: 'validation_failed', details: errors });
        return;
      }
      const email = String(body.authorEmail ?? '').trim().toLowerCase();
      if (!submissionRateLimit(email, res)) return;

      const sub = await createSubmission({
        packName: String(body.packName).trim(),
        version: String(body.version).trim(),
        authorHandle: String(body.authorHandle).trim(),
        authorEmail: email,
        description: String(body.description).trim(),
        category: body.category ? String(body.category).trim() : undefined,
        pricingTier: String(body.pricingTier ?? 'free').trim(),
        priceGbpCents: typeof body.priceGbpCents === 'number' ? body.priceGbpCents : undefined,
        packArchiveUrl: String(body.packArchiveUrl).trim(),
      });

      void sendSubmissionConfirmation(sub).catch(() => {});
      res.status(201).json({ submissionId: sub.id, status: 'pending' });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/submissions', async (req, res, next) => {
    try {
      if (!authorizeOps(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const status = String(req.query.status ?? '').trim() || null;
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
      const offset = (page - 1) * limit;
      const [rows, countRows] = await Promise.all([
        hubPool.query(
          `SELECT * FROM pack_submissions
           WHERE ($1::text IS NULL OR status = $1)
           ORDER BY submitted_at DESC LIMIT $2 OFFSET $3`,
          [status, limit, offset],
        ),
        hubPool.query(
          `SELECT COUNT(*) AS total FROM pack_submissions WHERE ($1::text IS NULL OR status = $1)`,
          [status],
        ),
      ]);
      const total = parseInt(String((countRows.rows[0] as Record<string, string>).total ?? '0'), 10);
      res.json({ submissions: rows.rows, total, page, limit });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/submissions/:id', async (req, res, next) => {
    try {
      if (!authorizeOps(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const sub = await getSubmission(req.params.id);
      if (!sub) { res.status(404).json({ error: 'Submission not found' }); return; }
      res.json({ submission: sub });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/submissions/:id', async (req, res, next) => {
    try {
      if (!authorizeOps(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const action = String(req.body?.action ?? '').trim() as 'approve' | 'reject';
      if (action !== 'approve' && action !== 'reject') {
        res.status(400).json({ error: 'action must be approve or reject' });
        return;
      }
      const sub = await reviewSubmission(req.params.id, action, req.body?.reviewerNotes as string | undefined);
      if (!sub) { res.status(404).json({ error: 'Submission not found or not pending' }); return; }
      if (action === 'reject') void sendRejectionEmail(sub).catch(() => {});
      res.json({ submission: sub });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/submissions/:id/publish', async (req, res, next) => {
    try {
      if (!authorizeOps(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const sub = await publishSubmission(req.params.id);
      if (!sub) { res.status(404).json({ error: 'Submission not found or not approved' }); return; }
      void sendPublicationEmail(sub).catch(() => {});
      res.json({ submission: sub });
    } catch (err) {
      next(err);
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: () => void) => {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  });

  return app;
}

async function handlePackDownload(name: string, res: Response, req?: Request): Promise<void> {
  const pack = await getHubPack(name);
  if (!pack) {
    res.status(404).json({ error: 'Pack not found' });
    return;
  }

  if (packRequiresLicense(pack.pricing_tier, pack.price_gbp_cents)) {
    const token = String(
      req?.query.license ?? req?.headers['x-pack-license'] ?? '',
    ).trim();
    if (!token || !(await validatePackLicense(name, token))) {
      res.status(402).json({
        error: 'Premium pack license required',
        packName: name,
        pricingTier: pack.pricing_tier,
        priceGbpCents: pack.price_gbp_cents,
        checkoutPath: `/api/packs/${encodeURIComponent(name)}/checkout`,
      });
      return;
    }
  }

  const archivePath = await getPackArchivePath(name);
  if (!archivePath) {
    res.status(404).json({ error: 'Pack archive not found' });
    return;
  }
  await recordPackDownload(name);
  // install_count tracks unique installs separately from download_count (which tracks all downloads)
  void hubPool.query(
    `UPDATE skill_packs SET install_count = install_count + 1 WHERE name = $1`,
    [name],
  ).catch(() => {});
  res.download(archivePath);
}

export async function startSkillsHub(): Promise<void> {
  await fs.mkdir(PACKS_STORAGE, { recursive: true });
  await initHubDb();
  const seeded = await seedHubRegistry(PACKS_STORAGE);
  console.log(`Skills Hub registry: ${seeded.packs} packs, ${seeded.skills} skills indexed`);

  const app = createSkillsHubApp();
  await new Promise<void>((resolve) => {
    app.listen(config.hub.port, () => {
      console.log(`Skills Hub ready at http://localhost:${config.hub.port}`);
      console.log(`Public registry: ${config.product.hubUrl}/ (local browse: http://localhost:${config.hub.port}/)`);
      resolve();
    });
  });
}

const isMain = process.argv[1]?.includes('hub/server');
if (isMain) {
  startSkillsHub().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
