import { Router, type Request, type Response } from 'express';
import { pool } from '../memory/db.js';

export const publicPricingRouter = Router();

const FALLBACK: Record<string, number | null> = {
  aiva_starter: 49,
  aiva_team: 99,
  aiva_business: 299,
  scout_monitor: 49,
  scout_govern: 79,
};

publicPricingRouter.get('/', async (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60');

  try {
    const result = await pool.query<{ id: string; monthly_gbp: number | null }>(
      `SELECT id, monthly_gbp FROM platform_pricing`,
    );
    const prices: Record<string, number | null> = { ...FALLBACK };
    for (const row of result.rows) {
      prices[row.id] = row.monthly_gbp;
    }
    res.json({ currency: 'GBP', symbol: '£', prices });
  } catch {
    res.json({ currency: 'GBP', symbol: '£', prices: FALLBACK });
  }
});

publicPricingRouter.options('/', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});
