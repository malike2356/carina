import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import { resolveCarinaHome } from '../config/paths.js';

export interface WorkspacePreset {
  id: string;
  name: string;
  sessionId: string;
  preview: string;
  provider?: string;
  theme?: string;
  createdAt: string;
  updatedAt: string;
}

interface PresetIndex {
  version: number;
  presets: WorkspacePreset[];
}

export const workspacePresetsApiRouter: ExpressRouter = Router();

function presetsAuth(req: Request, res: Response, next: NextFunction): void {
  if (isControlAuthorized(req)) {
    next();
    return;
  }
  if (req.session?.webAuthed) {
    next();
    return;
  }
  if (req.session?.hostedAccountId) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

workspacePresetsApiRouter.use(presetsAuth);

function indexPath(): string {
  return path.join(resolveCarinaHome(), 'workspace-presets.json');
}

async function readIndex(): Promise<PresetIndex> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw) as PresetIndex;
    if (!Array.isArray(parsed.presets)) return { version: 1, presets: [] };
    return parsed;
  } catch {
    return { version: 1, presets: [] };
  }
}

async function writeIndex(index: PresetIndex): Promise<void> {
  await fs.mkdir(resolveCarinaHome(), { recursive: true });
  await fs.writeFile(indexPath(), JSON.stringify(index, null, 2), 'utf8');
}

workspacePresetsApiRouter.get('/', async (_req: Request, res: Response) => {
  const index = await readIndex();
  res.json({ presets: index.presets });
});

workspacePresetsApiRouter.post('/', async (req: Request, res: Response) => {
  const name = String(req.body?.name ?? '').trim();
  const sessionId = String(req.body?.sessionId ?? '').trim();
  if (!name || !sessionId) {
    res.status(400).json({ error: 'name and sessionId are required' });
    return;
  }
  const now = new Date().toISOString();
  const preset: WorkspacePreset = {
    id: randomUUID(),
    name,
    sessionId,
    preview: String(req.body?.preview ?? '').slice(0, 120),
    provider: req.body?.provider ? String(req.body.provider) : undefined,
    theme: req.body?.theme ? String(req.body.theme) : undefined,
    createdAt: now,
    updatedAt: now,
  };
  const index = await readIndex();
  index.presets = index.presets.filter((p) => p.name !== name);
  index.presets.unshift(preset);
  index.presets = index.presets.slice(0, 24);
  await writeIndex(index);
  res.status(201).json(preset);
});

workspacePresetsApiRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id ?? '');
  const index = await readIndex();
  const before = index.presets.length;
  index.presets = index.presets.filter((p) => p.id !== id);
  if (index.presets.length === before) {
    res.status(404).json({ error: 'Preset not found' });
    return;
  }
  await writeIndex(index);
  res.status(204).send();
});
