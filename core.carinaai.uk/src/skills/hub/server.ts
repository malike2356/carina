import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { type Express, type Request, type Response } from 'express';
import { config } from '../../config/index.js';
import { initHubDb } from './migrations.js';
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
      input.trust = {
        ...input.trust,
        publisher: 'community',
        validation: 'pending',
        verified: false,
      };
      await upsertHubMarketplaceEntry(input);
      res.status(201).json({ id: input.id, pendingVerification: true });
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
