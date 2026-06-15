import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';

export interface WorkspaceTheme {
  name: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
  createdAt: string;
}

const operatorThemes = new Map<string, WorkspaceTheme>();

export const themeApiRouter: ExpressRouter = Router();

themeApiRouter.get('/', (_req: Request, res: Response) => {
  res.json({ themes: Array.from(operatorThemes.values()) });
});

themeApiRouter.post('/', (req: Request, res: Response) => {
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
  operatorThemes.set(name, theme);
  res.json({ theme });
});

themeApiRouter.delete('/:name', (req: Request, res: Response) => {
  const name = String(req.params.name ?? '');
  operatorThemes.delete(name);
  res.json({ ok: true });
});
