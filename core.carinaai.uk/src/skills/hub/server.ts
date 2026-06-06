import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { config } from '../../config/index.js';
import { hubPool, initHubDb } from './migrations.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKS_STORAGE = path.resolve(__dirname, '../../../data/hub-packs');

export async function startSkillsHub(): Promise<void> {
  await fs.mkdir(PACKS_STORAGE, { recursive: true });
  await initHubDb();
  await seedPropertyUkIfEmpty();

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/packs', async (_req, res) => {
    const result = await hubPool.query(
      `SELECT name, version, description, author, skill_count, download_count, created_at
       FROM skill_packs ORDER BY name`,
    );
    res.json({ packs: result.rows });
  });

  app.get('/packs/:name', async (req, res) => {
    const result = await hubPool.query(
      `SELECT name, version, description, author, skill_count, download_count, created_at
       FROM skill_packs WHERE name = $1`,
      [req.params.name],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Pack not found' });
      return;
    }
    res.json(result.rows[0]);
  });

  app.get('/packs/:name/download', async (req, res) => {
    const result = await hubPool.query(
      'SELECT archive_path FROM skill_packs WHERE name = $1',
      [req.params.name],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Pack not found' });
      return;
    }
    const archivePath = String(result.rows[0].archive_path);
    await hubPool.query(
      'UPDATE skill_packs SET download_count = download_count + 1 WHERE name = $1',
      [req.params.name],
    );
    res.download(archivePath);
  });

  app.post('/packs', async (req, res) => {
    const apiKey = req.headers['x-api-key'] ?? req.headers.authorization;
    const token = String(apiKey ?? '').replace(/^Bearer\s+/i, '');
    if (!config.hub.publishApiKey || token !== config.hub.publishApiKey) {
      res.status(401).json({ error: 'Invalid publish API key' });
      return;
    }
    res.status(501).json({
      error: 'Upload via POST /packs requires multipart; use CLI publish script for now',
    });
  });

  await new Promise<void>((resolve) => {
    app.listen(config.hub.port, () => {
      console.log(`Skills Hub ready at http://localhost:${config.hub.port}`);
      resolve();
    });
  });
}

async function seedPropertyUkIfEmpty(): Promise<void> {
  const existing = await hubPool.query('SELECT 1 FROM skill_packs WHERE name = $1', [
    'property-uk',
  ]);
  if ((existing.rowCount ?? 0) > 0) return;

  const { buildPropertyUkArchive } = await import('./build-pack.js');
  const archivePath = await buildPropertyUkArchive(PACKS_STORAGE);
  await hubPool.query(
    `INSERT INTO skill_packs (name, version, description, author, skill_count, archive_path)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      'property-uk',
      '1.0.0',
      'UK property entrepreneurship knowledge pack',
      'VERLOX Ltd',
      6,
      archivePath,
    ],
  );
}

const isMain = process.argv[1]?.includes('hub/server');
if (isMain) {
  startSkillsHub().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
