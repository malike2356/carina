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
  listHubPacks,
  listHubSkills,
  recordPackDownload,
} from './registry.js';
import { seedHubRegistry } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKS_STORAGE = path.resolve(__dirname, '../../../data/hub-packs');
const PUBLIC_DIR = path.join(__dirname, 'public');

function parseBool(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}

export function createSkillsHubApp(): Express {
  const app = express();
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
      await handlePackDownload(req.params.name, res);
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
      await handlePackDownload(req.params.name, res);
    } catch (err) {
      next(err);
    }
  });

  app.post('/packs', async (req, res) => {
    const apiKey = req.headers['x-api-key'] ?? req.headers.authorization;
    const token = String(apiKey ?? '').replace(/^Bearer\s+/i, '');
    if (!config.hub.publishApiKey || token !== config.hub.publishApiKey) {
      res.status(401).json({ error: 'Invalid publish API key' });
      return;
    }
    res.status(501).json({
      error: 'Use carina hub publish <pack-dir> to submit community packs',
    });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: () => void) => {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  });

  return app;
}

async function handlePackDownload(name: string, res: Response): Promise<void> {
  const archivePath = await getPackArchivePath(name);
  if (!archivePath) {
    res.status(404).json({ error: 'Pack not found' });
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
      console.log(`Browse community skills at http://localhost:${config.hub.port}/`);
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
