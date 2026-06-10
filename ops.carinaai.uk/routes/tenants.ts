import { Router } from 'express';
import {
  ensureHostedSchema,
  fetchTenantById,
  fetchTenants,
  fetchTenantSummary,
  hostedTablesReady,
  resetTenantDailyQuota,
  setTenantTier,
} from '../lib/tenants.js';

export const tenantsRouter = Router();

function flashMessage(query: Record<string, unknown>): { text: string | null; isError: boolean } {
  if (query.ok === 'tier') return { text: 'Tier updated.', isError: false };
  if (query.ok === 'quota') return { text: 'Daily message quota reset.', isError: false };
  if (query.ok === 'schema') return { text: 'Hosted database schema initialized.', isError: false };
  if (typeof query.err === 'string') return { text: query.err, isError: true };
  return { text: null, isError: false };
}

tenantsRouter.post('/init-schema', async (_req, res) => {
  try {
    await ensureHostedSchema();
    res.redirect('/tenants?ok=schema');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect(`/tenants?err=${encodeURIComponent(message)}`);
  }
});

tenantsRouter.get('/', async (req, res) => {
  try {
    const ready = await hostedTablesReady();
    const summary = ready ? await fetchTenantSummary() : null;
    const tenants = ready ? await fetchTenants() : [];
    const tierFilter = String(req.query.tier ?? '').trim();

    const flash = flashMessage(req.query as Record<string, unknown>);
    res.render('tenants', {
      title: 'Tenants',
      ready,
      summary,
      tenants: tierFilter
        ? tenants.filter((t) => t.tier === tierFilter)
        : tenants,
      tierFilter,
      message: flash.text,
      messageIsError: flash.isError,
      hostedAppUrl: process.env.CARINA_HOSTED_APP_URL ?? 'https://app.carinaai.uk',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

tenantsRouter.get('/:id', async (req, res) => {
  try {
    const tenant = await fetchTenantById(req.params.id);
    if (!tenant) {
      res.status(404).render('error', { message: 'Tenant not found' });
      return;
    }
    const flash = flashMessage(req.query as Record<string, unknown>);
    res.render('tenant-detail', {
      title: 'Tenant',
      tenant,
      message: flash.text,
      messageIsError: flash.isError,
      freeDailyLimit: Number(process.env.HOSTED_FREE_DAILY_MESSAGES ?? 100),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

tenantsRouter.post('/:id/tier', async (req, res) => {
  const tier = req.body?.tier === 'pro' ? 'pro' : 'free';
  try {
    const ok = await setTenantTier(req.params.id, tier);
    if (!ok) {
      res.redirect(`/tenants/${req.params.id}?err=Tenant+not+found`);
      return;
    }
    res.redirect(`/tenants/${req.params.id}?ok=tier`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect(`/tenants/${req.params.id}?err=${encodeURIComponent(message)}`);
  }
});

tenantsRouter.post('/:id/reset-quota', async (req, res) => {
  try {
    const ok = await resetTenantDailyQuota(req.params.id);
    if (!ok) {
      res.redirect(`/tenants/${req.params.id}?err=Tenant+not+found`);
      return;
    }
    res.redirect(`/tenants/${req.params.id}?ok=quota`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect(`/tenants/${req.params.id}?err=${encodeURIComponent(message)}`);
  }
});
