import { Router } from 'express';
import {
  ASSIGNABLE_PLANS,
  BILLING_PLANS,
  normalizePlanId,
  stripeConfigured,
  type BillingPlanId,
} from '../lib/billing-plans.js';
import { fetchAuditLog, formatAuditAction, logAudit, writeOpsAudit } from '../lib/tenant-audit.js';
import { addProviderKey, removeProviderKey, toggleProviderKey } from '../lib/tenant-byok.js';
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
import {
  blockWritesDuringImpersonation,
  endImpersonation,
  getActiveImpersonation,
  startImpersonation,
} from '../lib/support-impersonation.js';

export const tenantsRouter = Router();

tenantsRouter.use(blockWritesDuringImpersonation);

const VALID_TABS = ['overview', 'subscription', 'payments', 'usage', 'packs', 'access', 'byok', 'audit'] as const;
type TenantTab = typeof VALID_TABS[number];

function wantsJson(req: { get(name: string): string | undefined }): boolean {
  const accept = req.get('accept') ?? '';
  const xRequestedWith = req.get('x-requested-with') ?? '';
  return accept.includes('application/json') || xRequestedWith.toLowerCase() === 'fetch';
}

function flashMessage(query: Record<string, unknown>): { text: string | null; isError: boolean } {
  if (query.ok === 'created') return { text: 'Tenant created successfully.', isError: false };
  if (query.ok === 'tier') return { text: 'Tier updated.', isError: false };
  if (query.ok === 'quota') return { text: 'Daily message quota reset.', isError: false };
  if (query.ok === 'schema') return { text: 'Hosted database schema initialized.', isError: false };
  if (query.ok === 'plan') return { text: 'Subscription plan updated.', isError: false };
  if (query.ok === 'access') return { text: 'Access status updated.', isError: false };
  if (query.ok === 'packs') return { text: 'Skill packs updated.', isError: false };
  if (query.ok === 'notes') return { text: 'Notes saved.', isError: false };
  if (query.ok === 'key-saved') return { text: 'Provider key saved.', isError: false };
  if (query.ok === 'key-removed') return { text: 'Provider key removed.', isError: false };
  if (query.ok === 'toggled') return { text: 'Provider key updated.', isError: false };
  if (query.ok === 'impersonation') return { text: 'Impersonation session started (read-only, 15 minutes).', isError: false };
  if (query.ok === 'impersonation-end') return { text: 'Impersonation session ended.', isError: false };
  if (typeof query.err === 'string') return { text: query.err, isError: true };
  return { text: null, isError: false };
}

function parseTab(value: unknown): TenantTab {
  const tab = String(value ?? 'overview');
  return VALID_TABS.includes(tab as TenantTab) ? tab as TenantTab : 'overview';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidTenantId(value: string): boolean {
  return UUID_RE.test(value);
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

tenantsRouter.post('/impersonation/end', async (req, res) => {
  try {
    const active = getActiveImpersonation(req);
    await endImpersonation(req);
    if (active) {
      res.redirect(`/tenants/${active.tenantId}?ok=impersonation-end&tab=overview`);
      return;
    }
    res.redirect('/tenants?ok=impersonation-end');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect(`/tenants?err=${encodeURIComponent(message)}`);
  }
});

tenantsRouter.get('/:id', async (req, res) => {
  try {
    const tenantId = String(req.params.id ?? '');
    if (!isValidTenantId(tenantId)) {
      res.status(404).render('error', { message: 'Tenant not found' });
      return;
    }

    const tenant = await fetchTenantById(tenantId);
    if (!tenant) {
      res.status(404).render('error', { message: 'Tenant not found' });
      return;
    }

    const tab = parseTab(req.query.tab);
    const impersonation = getActiveImpersonation(req);
    const isImpersonating = Boolean(impersonation && impersonation.tenantId === tenantId);
    await writeOpsAudit({
      tenantId,
      orgId: impersonation?.orgId ?? undefined,
      action: tab === 'byok' ? 'tenant.byok.view' : 'tenant.view',
      details: { tab, impersonating: isImpersonating },
    });
    const flash = flashMessage(req.query as Record<string, unknown>);
    const auditLog = tab === 'audit' ? await fetchAuditLog(tenantId) : [];
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
      impersonation: isImpersonating ? impersonation : null,
      isImpersonating,
      hostedAppUrl: process.env.CARINA_HOSTED_APP_URL ?? 'https://app.carinaai.uk',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

tenantsRouter.post('/:id/impersonate', async (req, res) => {
  const tenantId = String(req.params.id ?? '');
  if (!isValidTenantId(tenantId)) {
    res.status(404).render('error', { message: 'Tenant not found' });
    return;
  }
  try {
    const tenant = await fetchTenantById(tenantId);
    if (!tenant) {
      res.status(404).render('error', { message: 'Tenant not found' });
      return;
    }
    await startImpersonation(req, tenantId);
    res.redirect(`/tenants/${tenantId}?ok=impersonation&tab=overview`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect(`/tenants/${tenantId}?err=${encodeURIComponent(message)}&tab=overview`);
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
  if (!isValidTenantId(id)) {
    res.status(404).render('error', { message: 'Tenant not found' });
    return;
  }
  try {
    const plan = normalizePlanId(req.body?.plan) as BillingPlanId;
    const ok = await updateTenantSubscription(id, plan, 'manual');
    if (!ok) {
      res.redirect(`/tenants/${id}?err=Tenant+not+found&tab=subscription`);
      return;
    }
    await writeOpsAudit({
      tenantId: id,
      action: 'tenant.plan_override',
      details: { plan },
    });
    if (wantsJson(req)) {
      res.json({ ok: true, plan, message: 'Subscription plan updated.' });
      return;
    }
    res.redirect(`/tenants/${id}?ok=plan&tab=subscription`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (wantsJson(req)) {
      res.status(500).json({ error: message });
      return;
    }
    res.redirect(`/tenants/${id}?err=${encodeURIComponent(message)}&tab=subscription`);
  }
});

tenantsRouter.post('/:id/access', async (req, res) => {
  const id = req.params.id;
  if (!isValidTenantId(id)) {
    res.status(404).render('error', { message: 'Tenant not found' });
    return;
  }
  const accessStatus = (['active', 'suspended', 'trial'].includes(String(req.body?.accessStatus))
    ? String(req.body.accessStatus)
    : 'active') as AccessStatus;
  try {
    const ok = await updateTenantAccess(id, accessStatus);
    if (!ok) {
      res.redirect(`/tenants/${id}?err=Tenant+not+found&tab=access`);
      return;
    }
    if (accessStatus === 'suspended') {
      await writeOpsAudit({
        tenantId: id,
        action: 'tenant.suspend',
        details: { accessStatus },
      });
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

tenantsRouter.post('/:id/provider-keys', async (req, res) => {
  const { provider, apiKey, baseUrl, model } = req.body as {
    provider?: string; apiKey?: string; baseUrl?: string; model?: string;
  };
  if (!provider?.trim() || !apiKey?.trim()) {
    return res.redirect(`/tenants/${req.params.id}?tab=byok&err=provider+and+API+key+required`);
  }
  try {
    await addProviderKey(
      req.params.id,
      provider.trim(),
      apiKey.trim(),
      baseUrl?.trim(),
      model?.trim(),
    );
    await logAudit('byok_key_added', { provider: provider.trim() }, req.params.id);
    if (wantsJson(req)) {
      res.json({ ok: true, message: 'Provider key saved.' });
      return;
    }
    res.redirect(`/tenants/${req.params.id}?tab=byok&ok=key-saved`);
  } catch (err) {
    if (wantsJson(req)) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
      return;
    }
    res.redirect(`/tenants/${req.params.id}?tab=byok&err=${encodeURIComponent(String(err))}`);
  }
});

tenantsRouter.post('/:id/provider-keys/:provider/remove', async (req, res) => {
  try {
    await removeProviderKey(req.params.id, req.params.provider);
    await logAudit('byok_key_removed', { provider: req.params.provider }, req.params.id);
    if (wantsJson(req)) {
      res.json({ ok: true, message: 'Provider key removed.' });
      return;
    }
    res.redirect(`/tenants/${req.params.id}?tab=byok&ok=key-removed`);
  } catch (err) {
    if (wantsJson(req)) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
      return;
    }
    res.redirect(`/tenants/${req.params.id}?tab=byok&err=${encodeURIComponent(String(err))}`);
  }
});

tenantsRouter.post('/:id/provider-keys/:provider/toggle', async (req, res) => {
  const enabled = req.body.enabled === 'true';
  try {
    await toggleProviderKey(req.params.id, req.params.provider, enabled);
    if (wantsJson(req)) {
      res.json({ ok: true, message: enabled ? 'Provider key enabled.' : 'Provider key disabled.' });
      return;
    }
    res.redirect(`/tenants/${req.params.id}?tab=byok&ok=toggled`);
  } catch (err) {
    if (wantsJson(req)) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
      return;
    }
    res.redirect(`/tenants/${req.params.id}?tab=byok&err=${encodeURIComponent(String(err))}`);
  }
});
