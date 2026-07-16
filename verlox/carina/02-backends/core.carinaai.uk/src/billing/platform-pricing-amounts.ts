import { pool } from '../memory/db.js';

/** Display tiers shown on admin.hireaiva.co.uk/billing/aiva */
export type AivaBillingDisplayTier = 'starter' | 'team' | 'business';

const PLATFORM_KEYS: Record<AivaBillingDisplayTier, string[]> = {
  starter: ['aiva_starter'],
  team: ['aiva_team', 'aiva_growth'],
  business: ['aiva_business'],
};

/** Defaults match ops.carinaai.uk/pricing catalog and migration seed values. */
export const DEFAULT_AIVA_MONTHLY_GBP: Record<AivaBillingDisplayTier, number | null> = {
  starter: 49,
  team: 99,
  business: 199,
};

export async function loadAivaMonthlyGbpFromPlatform(): Promise<Record<AivaBillingDisplayTier, number | null>> {
  const amounts: Record<AivaBillingDisplayTier, number | null> = { ...DEFAULT_AIVA_MONTHLY_GBP };
  try {
    const result = await pool.query<{ id: string; monthly_gbp: number | null }>(
      `SELECT id, monthly_gbp FROM platform_pricing WHERE id LIKE 'aiva_%'`,
    );
    const byId = new Map(result.rows.map((row) => [row.id, row.monthly_gbp]));
    for (const tier of Object.keys(PLATFORM_KEYS) as AivaBillingDisplayTier[]) {
      for (const id of PLATFORM_KEYS[tier]) {
        if (!byId.has(id)) continue;
        amounts[tier] = byId.get(id) ?? amounts[tier];
        break;
      }
    }
  } catch {
    // Table may be missing in dev; keep defaults.
  }
  return amounts;
}

export function gbpToPence(gbp: number | null): number | null {
  if (gbp === null || gbp === undefined) return null;
  return Math.round(gbp * 100);
}

/** Annual billing discount shown on admin.hireaiva.co.uk billing toggle. */
export const ANNUAL_BILLING_DISCOUNT_PERCENT = 20;

/** Annual list price: 12 months at (100 - discount)% of monthly. */
export function annualTotalPenceFromMonthly(monthlyPence: number | null): number | null {
  if (monthlyPence === null) return null;
  const factor = 12 * (1 - ANNUAL_BILLING_DISCOUNT_PERCENT / 100);
  return Math.round(monthlyPence * factor);
}
