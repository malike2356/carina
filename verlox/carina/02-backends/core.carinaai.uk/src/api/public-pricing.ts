// @ts-nocheck
import { Router } from 'express';
import { pool } from '../memory/db.js';
export const publicPricingRouter: ReturnType<typeof Router> = Router();
function priceFromEnv(name, fallback) {
    const raw = process.env[name]?.trim() || fallback;
    if (raw.toLowerCase() === 'null')
        return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : Number(fallback);
}
function buildBasePrices() {
    return {
        carina_developer: priceFromEnv('PRICE_CARINA_DEVELOPER', '49'),
        carina_ops_starter: priceFromEnv('PRICE_CARINA_OPS_STARTER', '99'),
        carina_ops_team: priceFromEnv('PRICE_CARINA_OPS_TEAM', '199'),
        carina_extra_deployment: priceFromEnv('PRICE_CARINA_EXTRA_DEPLOYMENT', '99'),
        carina_enterprise: priceFromEnv('PRICE_CARINA_ENTERPRISE', 'null'),
        aiva_starter: priceFromEnv('PRICE_AIVA_STARTER', '49'),
        aiva_growth: priceFromEnv('PRICE_AIVA_GROWTH', process.env.PRICE_AIVA_TEAM?.trim() || '99'),
        aiva_team: priceFromEnv('PRICE_AIVA_TEAM', '99'),
        aiva_business: priceFromEnv('PRICE_AIVA_BUSINESS', '199'),
        aiva_seat_addon: priceFromEnv('PRICE_AIVA_SEAT_ADDON', '49'),
        scout_monitor: priceFromEnv('PRICE_SCOUT_MONITOR', '99'),
        scout_govern: priceFromEnv('PRICE_SCOUT_GOVERN', '199'),
        scout_team: priceFromEnv('PRICE_SCOUT_TEAM', '399'),
        mutant_aiva_key_basic: priceFromEnv('PRICE_MUTANT_AIVA_KEY_BASIC', '0'),
        mutant_aiva_key_pro: priceFromEnv('PRICE_MUTANT_AIVA_KEY_PRO', '0'),
    };
}
publicPricingRouter.get('/', async (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=60');
    try {
        const result = await pool.query(`SELECT id, monthly_gbp FROM platform_pricing`);
        const prices = buildBasePrices();
        for (const row of result.rows) {
            prices[row.id] = row.monthly_gbp;
        }
        res.json({ currency: 'GBP', symbol: process.env.PRICE_SYMBOL ?? '£', prices });
    }
    catch {
        res.json({ currency: 'GBP', symbol: process.env.PRICE_SYMBOL ?? '£', prices: buildBasePrices() });
    }
});
publicPricingRouter.options('/', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.status(204).end();
});
