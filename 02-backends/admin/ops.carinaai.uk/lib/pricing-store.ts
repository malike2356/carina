import { query } from './db.js';

export type PricingRow = {
  id: string;
  label: string;
  monthly_gbp: number | null;
  updated_at: string;
};

const SEED: { id: string; label: string; monthly_gbp: number | null }[] = [
  { id: 'aiva_starter', label: 'Aiva Starter', monthly_gbp: 149 },
  { id: 'aiva_team', label: 'Aiva Growth', monthly_gbp: 349 },
  { id: 'aiva_business', label: 'Aiva Enterprise', monthly_gbp: null },
  { id: 'aiva_seat_addon', label: 'Aiva extra AI Employee', monthly_gbp: 49 },
  { id: 'scout_monitor', label: 'Scout Monitor', monthly_gbp: 49 },
  { id: 'scout_govern', label: 'Scout Govern', monthly_gbp: 79 },
];

export async function ensurePricingTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS platform_pricing (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      monthly_gbp INTEGER,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  for (const row of SEED) {
    await query(
      `INSERT INTO platform_pricing (id, label, monthly_gbp)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [row.id, row.label, row.monthly_gbp],
    );
  }
}

export async function getPricing(): Promise<PricingRow[]> {
  const result = await query<PricingRow>(
    `SELECT id, label, monthly_gbp, updated_at FROM platform_pricing ORDER BY id`,
  );
  return result.rows;
}

export async function upsertPrice(id: string, monthlyGbp: number | null): Promise<void> {
  await query(
    `UPDATE platform_pricing SET monthly_gbp = $2, updated_at = NOW() WHERE id = $1`,
    [id, monthlyGbp],
  );
}
