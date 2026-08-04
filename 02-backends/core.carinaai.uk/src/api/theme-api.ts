import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { deleteTheme, listThemes, saveTheme, type WorkspaceTheme } from '../ui/theme-store.js';

export type { WorkspaceTheme };

export const themeApiRouter: ExpressRouter = Router();

themeApiRouter.get('/', async (_req: Request, res: Response) => {
  res.json({ themes: await listThemes() });
});

themeApiRouter.post('/', async (req: Request, res: Response) => {
  const { name, bg, accent, surface, text, muted, border } = req.body as Partial<WorkspaceTheme>;
  if (!name || !bg || !accent) {
    res.status(400).json({ error: 'name, bg, accent required' });
    return;
  }
  const theme: WorkspaceTheme = {
    name,
    bg,
    surface: surface ?? bg,
    text: text ?? '#e4e4e9',
    muted: muted ?? '#575768',
    accent,
    border: border ?? 'rgba(255,255,255,0.07)',
    createdAt: new Date().toISOString(),
  };
  res.json({ theme: await saveTheme(theme) });
});

themeApiRouter.delete('/:name', async (req: Request, res: Response) => {
  const name = String(req.params.name ?? '');
  const deleted = await deleteTheme(name);
  if (!deleted) {
    res.status(404).json({ error: 'Theme not found' });
    return;
  }
  res.json({ ok: true });
});
