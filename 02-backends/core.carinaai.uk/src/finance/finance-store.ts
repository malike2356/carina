/**
 * Per-user / per-feature cost and revenue rows for living P&L.
 * All money fields are integer minor units (pence/cents) to reconcile to the cent.
 */

import fs from 'fs';
import path from 'path';
import { resolveCarinaHome } from '../config/paths.js';

export type CostService =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'hosting'
  | 'third_party'
  | 'other';

export interface CostRow {
  id: string;
  date: string; // YYYY-MM-DD
  userId: string;
  workspaceId?: string;
  service: CostService;
  feature?: string;
  amountMinor: number;
  currency: string;
  source: 'api' | 'ledger' | 'manual' | 'allocated';
  note?: string;
}

export interface RevenueRow {
  id: string;
  date: string;
  userId: string;
  workspaceId?: string;
  kind: 'subscription' | 'one_time' | 'credits' | 'refund' | 'chargeback';
  amountMinor: number;
  currency: string;
  stripeChargeId?: string;
  source: 'stripe' | 'manual';
}

export interface FinanceStoreShape {
  costs: CostRow[];
  revenue: RevenueRow[];
  pnlSnapshots: Record<string, unknown>;
  lastMonthlyRunAt?: string;
}

const STORE_FILE = 'finance-ledger.json';
const caches = new Map<string, FinanceStoreShape>();

function emptyStore(): FinanceStoreShape {
  return { costs: [], revenue: [], pnlSnapshots: {} };
}

function storeDir(): string {
  return path.join(resolveCarinaHome(), 'finance');
}

function storePath(): string {
  return path.join(storeDir(), STORE_FILE);
}

export function loadFinanceStore(): FinanceStoreShape {
  if (caches.has(STORE_FILE)) return caches.get(STORE_FILE)!;
  const file = storePath();
  if (!fs.existsSync(file)) {
    const value = emptyStore();
    caches.set(STORE_FILE, value);
    return value;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<FinanceStoreShape>;
    const value: FinanceStoreShape = {
      costs: raw.costs ?? [],
      revenue: raw.revenue ?? [],
      pnlSnapshots: raw.pnlSnapshots ?? {},
      lastMonthlyRunAt: raw.lastMonthlyRunAt,
    };
    caches.set(STORE_FILE, value);
    return value;
  } catch {
    const value = emptyStore();
    caches.set(STORE_FILE, value);
    return value;
  }
}

export function saveFinanceStore(store: FinanceStoreShape): void {
  fs.mkdirSync(storeDir(), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2));
  caches.set(STORE_FILE, store);
}

export function mutateFinanceStore(mutator: (store: FinanceStoreShape) => void): FinanceStoreShape {
  const store = structuredClone(loadFinanceStore());
  mutator(store);
  saveFinanceStore(store);
  return store;
}

export function resetFinanceStoreCache(): void {
  caches.clear();
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function monthDateRange(year: number, month: number): { from: string; to: string } {
  const from = `${monthKey(year, month)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${monthKey(year, month)}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export function replaceMonthCosts(year: number, month: number, rows: CostRow[]): void {
  const { from, to } = monthDateRange(year, month);
  mutateFinanceStore((store) => {
    store.costs = store.costs.filter((c) => c.date < from || c.date > to);
    store.costs.push(...rows);
  });
}

export function replaceMonthRevenue(year: number, month: number, rows: RevenueRow[]): void {
  const { from, to } = monthDateRange(year, month);
  mutateFinanceStore((store) => {
    store.revenue = store.revenue.filter((r) => r.date < from || r.date > to);
    store.revenue.push(...rows);
  });
}

export function listCostsInRange(from: string, to: string): CostRow[] {
  return loadFinanceStore().costs.filter((c) => c.date >= from && c.date <= to);
}

export function listRevenueInRange(from: string, to: string): RevenueRow[] {
  return loadFinanceStore().revenue.filter((r) => r.date >= from && r.date <= to);
}

export function sumMinor(rows: Array<{ amountMinor: number }>): number {
  return rows.reduce((s, r) => s + r.amountMinor, 0);
}

export function newFinanceId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
