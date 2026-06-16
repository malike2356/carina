import { execSync } from 'node:child_process';
import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import {
  buildServeCommands,
  getCatalog,
  getCatalogEntry,
  getHardwareProfile,
  listFittingModels,
  recommendModels,
  resolveTier,
  searchCatalog,
} from '../cookbook/index.js';
import type { ServeBackend, ServeCommands } from '../cookbook/types.js';

export const cookbookApiRouter: ExpressRouter = Router();
export const playbookApiRouter = cookbookApiRouter;

function runDownloadCommands(commands: ServeCommands): { ok: boolean; commands: string[]; error?: string } {
  const download = commands.download.filter((c) => !c.startsWith('#'));
  if (download.length === 0) {
    return { ok: false, commands: download, error: 'No download commands available for this model' };
  }
  for (const cmd of download) {
    try {
      execSync(cmd, { stdio: 'inherit', shell: '/bin/bash', timeout: 600_000 });
    } catch (err) {
      return {
        ok: false,
        commands: download,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
  return { ok: true, commands: download };
}

cookbookApiRouter.get('/hardware', (_req: Request, res: Response) => {
  const profile = getHardwareProfile();
  const tier = resolveTier(profile);
  res.json({ ...profile, tier });
});

cookbookApiRouter.get('/models', (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').trim();
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 40)));
  const catalog = q ? searchCatalog(q) : getCatalog();
  res.json({ models: catalog.slice(0, limit), total: catalog.length });
});

cookbookApiRouter.get('/recommend', (_req: Request, res: Response) => {
  const profile = getHardwareProfile();
  const recommendations = recommendModels(profile);
  const fitting = listFittingModels(profile);
  res.json({ profile, tier: resolveTier(profile), recommendations, fitting });
});

cookbookApiRouter.post('/serve', (req: Request, res: Response) => {
  const { modelId, backend = 'ollama' } = req.body as { modelId?: string; backend?: string };
  if (!modelId) {
    res.status(400).json({ error: 'modelId is required' });
    return;
  }
  const entry = getCatalogEntry(modelId);
  if (!entry) {
    res.status(404).json({ error: `Unknown model: ${modelId}` });
    return;
  }
  try {
    const commands = buildServeCommands(entry, backend as ServeBackend);
    res.json({ commands });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

cookbookApiRouter.post('/pull', (req: Request, res: Response) => {
  const { modelId } = req.body as { modelId?: string };
  if (!modelId) {
    res.status(400).json({ error: 'modelId is required' });
    return;
  }
  const entry = getCatalogEntry(modelId);
  if (!entry) {
    res.status(404).json({ error: `Unknown model: ${modelId}` });
    return;
  }
  try {
    const commands = buildServeCommands(entry, 'ollama');
    const result = runDownloadCommands(commands);
    if (!result.ok) {
      res.status(500).json(result);
      return;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
