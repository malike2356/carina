import { execSync } from 'node:child_process';
import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import { CYBER_TOOLS } from '../tools/cyber-tools-registry.js';

export const cyberToolsApiRouter: ExpressRouter = Router();

function resolveInternalKey(): string {
  return (
    process.env.CARINA_INTERNAL_KEY?.trim() ||
    process.env.CARINA_CLOUD_INTERNAL_KEY?.trim() ||
    ''
  );
}

function isAuthorized(req: Request): boolean {
  if (isControlAuthorized(req)) return true;
  const expected = resolveInternalKey();
  if (!expected) return false;
  return String(req.headers['x-internal-key'] ?? '').trim() === expected;
}

cyberToolsApiRouter.use((req: Request, res: Response, next) => {
  if (isAuthorized(req)) { next(); return; }
  res.status(401).json({ error: 'Unauthorized' });
});

cyberToolsApiRouter.get('/cyber', (_req: Request, res: Response) => {
  const tools = CYBER_TOOLS.map((t) => ({
    name: t.name,
    category: t.category,
    requiredTier: t.requiredTier,
    binary: t.binary,
    description: t.description,
    triggers: t.triggers,
    upgradeNote: t.upgradeNote ?? null,
  }));
  res.json({ tools, total: tools.length });
});

cyberToolsApiRouter.get('/cyber/health', (_req: Request, res: Response) => {
  const health = CYBER_TOOLS.map((t) => {
    let installed = false;
    try {
      execSync(`which ${t.binary}`, { stdio: 'ignore', timeout: 3000 });
      installed = true;
    } catch {
      installed = false;
    }
    return { name: t.name, binary: t.binary, installed };
  });

  const installedCount = health.filter((h) => h.installed).length;
  res.json({ health, installedCount, total: health.length });
});
