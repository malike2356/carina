import { Router } from 'express';
import {
  ASSIGNABLE_PLANS,
  BILLING_PLANS,
  normalizePlanId,
  stripeConfigured,
  type BillingPlanId,
} from '../lib/billing-plans.js';
import { fetchAuditLog, formatAuditAction } from '../lib/tenant-audit.js';
import {
  createTenantDirect,
  generateTempPassword,
  updateTenantAccess,
  updateTenantNotes,
  updateTenantSubscription,
  type AccessStatus,
  type ProvisioningType,
} from '../lib/tenant-provisioning.js';
import { fetchAvailablePacks, setTenantPacks } from '../lib/tenant-packs.js';
import { parseSelectedPacks } from '../lib/packs.js';
import {
  ensureHostedSchema,
  fetchTenantById,
  fetchTenants,
  fetchTenantSummary,
  hostedTablesReady,
  provisioningLabel,
  resetTenantDailyQuota,
  setTenantTier,
  tenantDisplayName,
} from '../lib/tenants.js';

export const tenantsRouter = Router();

const VALID_TABS = ['overview', 'subscription', 'payments', 'usage', 'packs', 'access', 'audit'] as const;
type TenantTab = typeof VALID_TABS[number];

function flashMessage(query: Record<string, unknown>): { text: string | null; isError: boolean } {
  if (query.ok === 'created') return { text: 'Tenant created successfully.', isError: false };
  if (query.ok === 'tier') return { text: 'Tier updated.', isError: false };
  if (query.ok === 'quota') return { text: 'Daily message quota reset.', isError: false };
  if (query.ok === 'schema') return { text: 'Hosted database schema initialized.', isError: false };
  if (query.ok === 'plan') return { text: 'Subscription plan updated.', isError: false };
  if (query.ok === 'access') return { text: 'Access status updated.', isError: false };
  if (query.ok === 'packs') return { text: 'Skill packs updated.', isError: false };
  if (query.ok === 'notes') return { text: 'Notes saved.', isError: false };
  if (typeof query.err === 'string') return { text: query.err, isError: true };
  return { text: null, isError: false };
}

function parseTab(value: unknown): TenantTab {
  const tab = String(value ?? 'overview');
  return VALID_TABS.includes(tab as TenantTab) ? tab as TenantTab : 'overview';
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

tenantsRouter.get('/new', async (req, res) => {
  try {
    const ready = await hostedTablesReady();
    if (!ready) await ensureHostedSchema();
    const { packs } = await fetchAvailablePacks();
    const flash = flashMessage(req.query as Record<string, unknown>);
    res.render('tenant-create', {
      title: 'Create tenant',
      ready: true,
      availablePacks: packs,
      plans: ASSIGNABLE_PLANS.map((id) => BILLING_PLANS[id]),
      message: flash.text,
      messageIsError: flash.isError,
      form: {
        displayName: '',
        email: '',
        companyName: '',
        plan: 'free',
        provisioningType: 'manual',
        accessStatus: 'active',
        skillPacks: [] as string[],
        notes: '',
        generatePassword: true,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

tenantsRouter.post('/', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const email = String(body.email ?? '').trim();
    const displayName = String(body.displayName ?? '').trim();
    const companyName = String(body.companyName ?? '').trim();
    const plan = normalizePlanId(body.plan);
    const provisioningType = (body.provisioningType === 'trial' ? 'trial' : 'manual') as ProvisioningType;
    const accessStatus = (['active', 'suspended', 'trial'].includes(String(body.accessStatus))
      ? String(body.accessStatus)
      : 'active') as AccessStatus;
    const notes = String(body.notes ?? '').trim();
    const skillPacks = parseSelectedPacks(body);
    const generatePassword = body.generatePassword === 'on' || body.generatePassword === 'true';
    const password = generatePassword
      ? generateTempPassword()
      : String(body.password ?? '');

    const result = await createTenantDirect({
      email,
      password,
      displayName,
      companyName,
      plan,
      provisioningType,
      accessStatus,
      skillPacks,
      notes,
    });

    const params = new URLSearchParams({
      ok: 'created',
      tab: 'overview',
      email: result.tempPassword ? email : '',
    });
    if (result.tempPassword) {
      params.set('tempPassword', result.tempPassword);
      params.set('apiKey', result.apiKey);
    }
    res.redirect(`/tenants/${result.userId}?${params.toString()}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect(`/tenants/new?err=${encodeURIComponent(message)}`);
  }
});

tenantsRouter.get('/', async (req, res) => {
  try {
    const ready = await hostedTablesReady();
    const summary = ready ? await fetchTenantSummary() : null;
    const tierFilter = String(req.query.tier ?? '').trim();
    const provisioningFilter = String(req.query.provisioning ?? '').trim();
    const accessFilter = String(req.query.access ?? '').trim();

    const tenants = ready
      ? await fetchTenants({
          tier: tierFilter || undefined,
          provisioningType: provisioningFilter || undefined,
          accessStatus: accessFilter || undefined,
        })
      : [];

    const flash = flashMessage(req.query as Record<string, unknown>);
    res.render('tenants', {
      title: 'Tenants',
      ready,
      summary,
      tenants,
      tierFilter,
      provisioningFilter,
      accessFilter,
      provisioningLabel,
      tenantDisplayName,
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

    const tab = parseTab(req.query.tab);
    const flash = flashMessage(req.query as Record<string, unknown>);
    const auditLog = tab === 'audit' ? await fetchAuditLog(req.params.id) : [];
    const { packs: availablePacks } = await fetchAvailablePacks();

    const tempPassword = typeof req.query.tempPassword === 'string' ? req.query.tempPassword : null;
    const createdApiKey = typeof req.query.apiKey === 'string' ? req.query.apiKey : null;

    res.render('tenant-detail', {
      title: tenantDisplayName(tenant),
      tenant,
      tab,
      auditLog,
      formatAuditAction,
      availablePacks,
      plans: ASSIGNABLE_PLANS.map((id) => BILLING_PLANS[id]),
      provisioningLabel,
      tenantDisplayName,
      stripeConfigured: stripeConfigured(),
      message: flash.text,
      messageIsError: flash.isError,
      tempPassword,
      createdApiKey,
      freeDailyLimit: Number(process.env.HOSTED_FREE_DAILY_MESSAGES ?? 100),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

tenantsRouter.post('/:id/tier', async (req, res) => {
  const tier = req.body?.tier === 'pro' ? 'pro' : 'free';
  const id = req.params.id;
  try {
    const ok = await setTenantTier(id, tier);
    if (!ok) {
      res.redirect(`/tenants/${id}?err=Tenant+not+found&tab=access`);
      return;
    }
    res.redirect(`/tenants/${id}?ok=tier&tab=access`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect(`/tenants/${id}?err=${encodeURIComponent(message)}&tab=access`);
  }
});

tenantsRouter.post('/:id/reset-quota', async (req, res) => {
  const id = req.params.id;
  try {
    const ok = await resetTenantDailyQuota(id);
    if (!ok) {
      res.redirect(`/tenants/${id}?err=Tenant+not+found&tab=usage`);
      return;
    }
    res.redirect(`/tenants/${id}?ok=quota&tab=usage`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect(`/tenants/${id}?err=${encodeURIComponent(message)}&tab=usage`);
  }
});

tenantsRouter.post('/:id/subscription', async (req, res) => {
  const id = req.params.id;
  try {
    const plan = normalizePlanId(req.body?.plan) as BillingPlanId;
    const ok = await updateTenantSubscription(id, plan, 'manual');
    if (!ok) {
      res.redirect(`/tenants/${id}?err=Tenant+not+found&tab=subscription`);
      return;
    }
    res.redirect(`/tenants/${id}?ok=plan&tab=subscription`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect(`/tenants/${id}?err=${encodeURIComponent(message)}&tab=subscription`);
  }
});

tenantsRouter.post('/:id/access', async (req, res) => {
  const id = req.params.id;
  const accessStatus = (['active', 'suspended', 'trial'].includes(String(req.body?.accessStatus))
    ? String(req.body.accessStatus)
    : 'active') as AccessStatus;
  try {
    const ok = await updateTenantAccess(id, accessStatus);
    if (!ok) {
      res.redirect(`/tenants/${id}?err=Tenant+not+found&tab=access`);
      return;
    }
    res.redirect(`/tenants/${id}?ok=access&tab=access`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect(`/tenants/${id}?err=${encodeURIComponent(message)}&tab=access`);
  }
});

tenantsRouter.post('/:id/packs', async (req, res) => {
  const id = req.params.id;
  try {
    const selected = parseSelectedPacks(req.body as Record<string, unknown>);
    await setTenantPacks(id, selected);
    res.redirect(`/tenants/${id}?ok=packs&tab=packs`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect(`/tenants/${id}?err=${encodeURIComponent(message)}&tab=packs`);
  }
});

tenantsRouter.post('/:id/notes', async (req, res) => {
  const id = req.params.id;
  try {
    const notes = String(req.body?.notes ?? '');
    const ok = await updateTenantNotes(id, notes);
    if (!ok) {
      res.redirect(`/tenants/${id}?err=Tenant+not+found&tab=overview`);
      return;
    }
    res.redirect(`/tenants/${id}?ok=notes&tab=overview`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect(`/tenants/${id}?err=${encodeURIComponent(message)}&tab=overview`);
  }
});
