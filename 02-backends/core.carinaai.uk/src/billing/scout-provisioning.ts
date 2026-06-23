import { config } from '../config/index.js';
import { normalizePlanId, type BillingPlanId } from './plans.js';

export interface ProvisionResult {
  accountId: string;
  created: boolean;
  setupToken: string;
}

function scoutPlanFromBilling(plan: BillingPlanId): string {
  const normalized = normalizePlanId(plan);
  if (normalized === 'scout_monitor') return 'scout_monitor';
  if (normalized === 'enterprise') return 'enterprise';
  return 'scout_pro';
}

export async function provisionScoutTenant(opts: {
  email: string;
  tenantId: string;
  licenseKey: string;
  plan?: BillingPlanId;
}): Promise<ProvisionResult | null> {
  const scoutUrl = (config.labyrinth.url || process.env.LABYRINTH_URL || '').replace(/\/+$/, '');
  const secret = process.env.SCOUT_PROVISION_SECRET || config.labyrinth.apiKey || '';
  if (!scoutUrl || !secret) {
    console.warn('[carina:scout-provision] Skipped: LABYRINTH_URL or SCOUT_PROVISION_SECRET not set');
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${scoutUrl}/api/internal/provision-tenant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Scout-Provision-Secret': secret,
      },
      body: JSON.stringify({
        email: opts.email,
        carinaTenantId: opts.tenantId,
        licenseKey: opts.licenseKey,
        plan: scoutPlanFromBilling(opts.plan ?? 'scout_pro'),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[carina:scout-provision] HTTP ${res.status}: ${text}`);
      return null;
    }
    return (await res.json()) as ProvisionResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[carina:scout-provision] failed:', msg);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncScoutTenantPlan(opts: {
  tenantId: string;
  plan: BillingPlanId;
}): Promise<boolean> {
  const scoutUrl = (config.labyrinth.url || process.env.LABYRINTH_URL || '').replace(/\/+$/, '');
  const secret = process.env.SCOUT_PROVISION_SECRET || config.labyrinth.apiKey || '';
  if (!scoutUrl || !secret) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${scoutUrl}/api/internal/sync-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Scout-Provision-Secret': secret,
      },
      body: JSON.stringify({
        carinaTenantId: opts.tenantId,
        plan: scoutPlanFromBilling(opts.plan),
      }),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
