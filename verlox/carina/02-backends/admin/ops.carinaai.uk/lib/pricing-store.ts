import { query } from './db.js';

export type PricingGroup = 'carina' | 'aiva' | 'scout' | 'addons' | 'separated';

export const PRICING_GROUP_LABELS: Record<PricingGroup, string> = {
  carina: 'Carina platform',
  aiva: 'Aiva managed product',
  scout: 'Labyrinth Scout',
  addons: 'Add-ons',
  separated: 'Separated products',
};

type CatalogRow = {
  id: string;
  label: string;
  monthly_gbp: number | null;
  group?: PricingGroup;
  helpText?: string;
};

const CATALOG: CatalogRow[] = [
  { id: 'carina_developer', label: 'Carina Developer', monthly_gbp: 49, group: 'carina', helpText: 'Entry developer workspace pricing shown on carinaai.uk/pricing.' },
  { id: 'carina_ops_starter', label: 'Carina Builder', monthly_gbp: 99, group: 'carina', helpText: 'Public Carina pricing page Builder plan.' },
  { id: 'carina_ops_team', label: 'Carina Scale', monthly_gbp: 199, group: 'carina', helpText: 'Public Carina pricing page Scale plan.' },
  { id: 'carina_extra_deployment', label: 'Additional Carina deployment', monthly_gbp: 99, group: 'carina', helpText: 'Displayed as the per-deployment add-on.' },
  { id: 'carina_enterprise', label: 'Carina Enterprise', monthly_gbp: null, group: 'carina', helpText: 'Custom price, leave blank.' },
  { id: 'aiva_starter', label: 'Aiva Starter', monthly_gbp: 49 },
  { id: 'aiva_team', label: 'Aiva Team', monthly_gbp: 99 },
  { id: 'aiva_business', label: 'Aiva Business', monthly_gbp: 199 },
  { id: 'aiva_seat_addon', label: 'Aiva extra AI Employee', monthly_gbp: 49 },
  { id: 'scout_monitor', label: 'Scout Monitor', monthly_gbp: 99, group: 'scout' },
  { id: 'scout_govern', label: 'Scout Govern', monthly_gbp: 199, group: 'scout' },
  { id: 'scout_team', label: 'Scout Team', monthly_gbp: 399, group: 'scout' },
  { id: 'mutant_aiva_key_basic', label: 'Mutant Aiva key Basic', monthly_gbp: 0, group: 'separated', helpText: 'Visibility only for independent product pricing.' },
  { id: 'mutant_aiva_key_pro', label: 'Mutant Aiva key Pro', monthly_gbp: 0, group: 'separated', helpText: 'Visibility only for independent product pricing.' },
];

const SEED = CATALOG.map((row) => ({
  ...row,
  group: (row.group ?? 'aiva') as PricingGroup,
  helpText: row.helpText ?? '',
}));

const CATALOG_BY_ID = new Map(SEED.map((row) => [row.id, row]));

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
  for (const row of SEED) {
    await query(`UPDATE platform_pricing SET label = $2 WHERE id = $1`, [row.id, row.label]);
  }
  await query(`UPDATE platform_pricing
     SET monthly_gbp = 99, updated_at = NOW()
     WHERE id = 'scout_monitor' AND (monthly_gbp IS NULL OR monthly_gbp IN (49, 149))`);
  await query(`UPDATE platform_pricing
     SET monthly_gbp = 199, updated_at = NOW()
     WHERE id = 'scout_govern' AND (monthly_gbp IS NULL OR monthly_gbp IN (79, 149, 349))`);
  await query(`UPDATE platform_pricing
     SET monthly_gbp = 49, updated_at = NOW()
     WHERE id = 'aiva_starter' AND (monthly_gbp IS NULL OR monthly_gbp IN (149))`);
  await query(`UPDATE platform_pricing
     SET monthly_gbp = 99, updated_at = NOW()
     WHERE id IN ('aiva_team', 'aiva_growth') AND (monthly_gbp IS NULL OR monthly_gbp IN (349))`);
  await query(`UPDATE platform_pricing
     SET monthly_gbp = 199, updated_at = NOW()
     WHERE id = 'aiva_business' AND (monthly_gbp IS NULL OR monthly_gbp IN (149, 349))`);
  await query(`UPDATE platform_pricing
     SET monthly_gbp = 99, updated_at = NOW()
     WHERE id = 'carina_ops_starter' AND (monthly_gbp IS NULL OR monthly_gbp IN (199))`);
  await query(`UPDATE platform_pricing
     SET monthly_gbp = 199, updated_at = NOW()
     WHERE id = 'carina_ops_team' AND (monthly_gbp IS NULL OR monthly_gbp IN (599))`);
}

export async function getPricing(): Promise<Array<Record<string, unknown>>> {
  const result = await query(
    `SELECT id, label, monthly_gbp, updated_at::text AS updated_at FROM platform_pricing`,
  );
  const rows: Array<Record<string, unknown>> = result.rows.map((row: Record<string, unknown>) => {
    const catalog = CATALOG_BY_ID.get(String(row.id));
    const group = catalog?.group ?? 'addons';
    return {
      ...row,
      group,
      groupLabel: PRICING_GROUP_LABELS[group],
      helpText: catalog?.helpText ?? '',
    };
  });
  const order = new Map(SEED.map((row, index) => [row.id, index]));
  return rows.sort((a, b) => {
    const aOrder = order.get(String(a.id)) ?? 10_000;
    const bOrder = order.get(String(b.id)) ?? 10_000;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.id).localeCompare(String(b.id));
  });
}

export async function upsertPrice(id: string, monthlyGbp: number | null): Promise<void> {
  await query(
    `UPDATE platform_pricing SET monthly_gbp = $2, updated_at = NOW() WHERE id = $1`,
    [id, monthlyGbp],
  );
}
