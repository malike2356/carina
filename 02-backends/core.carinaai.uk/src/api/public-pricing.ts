import { Router, type IRouter, type Request, type Response } from 'express';
import { pool } from '../memory/db.js';

export const publicPricingRouter: IRouter = Router();

type PublicPriceMap = Record<string, number | null>;

function priceFromEnv(name: string, fallback: string): number | null {
  const raw = process.env[name]?.trim() || fallback;
  if (raw.toLowerCase() === 'null') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number(fallback);
}

function buildBasePrices(): PublicPriceMap {
  return {
    aiva_starter: priceFromEnv('PRICE_AIVA_STARTER', '149'),
    aiva_growth: priceFromEnv('PRICE_AIVA_GROWTH', process.env.PRICE_AIVA_TEAM?.trim() || '349'),
    aiva_team: priceFromEnv('PRICE_AIVA_TEAM', '349'),
    aiva_business: priceFromEnv('PRICE_AIVA_BUSINESS', 'null'),
    aiva_seat_addon: priceFromEnv('PRICE_AIVA_SEAT_ADDON', '49'),
    scout_monitor: priceFromEnv('PRICE_SCOUT_MONITOR', '49'),
    scout_govern: priceFromEnv('PRICE_SCOUT_GOVERN', '79'),
    mutant_aiva_key_basic: priceFromEnv('PRICE_MUTANT_AIVA_KEY_BASIC', '0'),
    mutant_aiva_key_pro: priceFromEnv('PRICE_MUTANT_AIVA_KEY_PRO', '0'),
  };
}

publicPricingRouter.get('/', async (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60');

  try {
    const result = await pool.query<{ id: string; monthly_gbp: number | null }>(
      `SELECT id, monthly_gbp FROM platform_pricing`,
    );
    const prices: PublicPriceMap = buildBasePrices();
    for (const row of result.rows) {
      prices[row.id] = row.monthly_gbp;
    }
    res.json({ currency: 'GBP', symbol: process.env.PRICE_SYMBOL ?? '£', prices });
  } catch {
    res.json({ currency: 'GBP', symbol: process.env.PRICE_SYMBOL ?? '£', prices: buildBasePrices() });
  }
});

publicPricingRouter.options('/', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});
