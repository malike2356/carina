import fs from 'fs';
import path from 'path';
import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { CARINA_DATA_DIR, CARINA_HOME } from '../config/paths.js';

export const curatorApiRouter: ExpressRouter = Router();

const DATA_DIR = process.env.CARINA_DATA_DIR ?? CARINA_DATA_DIR ?? path.join(CARINA_HOME, 'data');

curatorApiRouter.get('/last-run', (_req: Request, res: Response) => {
  const file = path.join(DATA_DIR, 'curator-last-run.txt');
  if (!fs.existsSync(file)) {
    res.json({ lastRun: null });
    return;
  }
  res.json({ lastRun: fs.readFileSync(file, 'utf-8').trim() });
});

curatorApiRouter.get('/report', (_req: Request, res: Response) => {
  const dir = process.env.CARINA_SKILL_CURATOR_REPORT_DIR ?? path.join(DATA_DIR, 'curator-reports');
  if (!fs.existsSync(dir)) {
    res.json({ reports: [] });
    return;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse().slice(0, 5);
  const reports = files.map((f) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as unknown;
    } catch {
      return null;
    }
  }).filter(Boolean);
  res.json({ reports });
});
