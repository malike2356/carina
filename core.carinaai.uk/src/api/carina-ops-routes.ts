import express, { type Express, type Request, type Response } from 'express';
import { config } from '../config/index.js';
import { pool } from '../memory/db.js';
import { requireHostedSession, requireOrgMember } from '../gateway/web-auth.js';
import { orgContext } from '../hosted/org-context.js';
import { getOrgPlan, requireFeature, requireOpsPlan } from '../hosted/plan-gates.js';
import { getOrgProfile } from '../hosted/org-service.js';
import {
  dismissOnboardingWizard,
  getOnboardingChecklist,
  markUsageViewed,
} from '../hosted/onboarding-service.js';
import { listModelsForOrg } from '../hosted/ai-platform-models.js';
import {
  addVaultEntry,
  listVaultEntries,
  orgHasByokKey,
  removeVaultEntry,
  toggleVaultEntry,
  VaultLimitError,
  VaultNotFoundError,
} from '../hosted/vault-service.js';
import {
  executeWorkbenchRun,
  listWorkbenchRuns,
  orgHasWorkbenchRun,
  summarizeRun,
  WorkbenchCreditsError,
  WorkbenchInferenceUnavailableError,
  WorkbenchMissingKeyError,
  WorkbenchQuotaError,
  WorkbenchValidationError,
} from '../hosted/workbench-service.js';
import { resolveWorkbenchInferenceMode } from '../hosted/workbench-inference.js';
import {
  getCreditsStatus,
  getTodayUsage,
  getUsageByModel,
  getUsageSummary,
  exportUsageCsv,
} from '../hosted/usage-service.js';
import { getBillingSummary } from '../hosted/billing-summary.js';
import { exportProductAuditCsv, listProductAuditForPlan, writeProductAudit } from '../hosted/product-audit.js';
import {
  createDeploymentForOrg,
  createEnvironmentForOrg,
  listDeploymentsForOrg,
  listEnvironmentsForOrg,
} from '../hosted/deployments-service.js';
import {
  ControlPlaneValidationError,
  createAgentForOrg,
  createBatchForOrg,
  createFileForOrg,
  createMemoryStoreForOrg,
  createSessionForOrg,
  getAnalyticsForOrg,
  getControlPlaneSummary,
  listAgentsForOrg,
  listBatchesForOrg,
  listFilesForOrg,
  listMemoryStoresForOrg,
  listSessionsForOrg,
  listSkillPacksForTenant,
} from '../hosted/control-plane-service.js';
import { UsageMeter } from '../billing/usage-meter.js';
import { StripeService } from '../billing/stripe-service.js';
import {
  CREDIT_TOPUP_PACKS,
  type BillingPlanId,
  type CreditTopupPackId,
} from '../billing/plans.js';
import {
  billingPlanIdFromOrgPlan,
  estimateWorkbenchUsage,
  getOpsCreditUsageSummary,
  getOpsModelMetering,
} from '../billing/ops-metering-service.js';
import { getPlatformMarginSummary } from '../billing/margin-report.js';
import { requireOpsAuth } from '../ops/ops-auth.js';
import { redactSecrets } from '../hosted/redact.js';

async function overviewHandler(req: Request, res: Response): Promise<void> {
  const ctx = req.orgContext!;
  const org = await getOrgProfile(ctx.orgId);
  const memberResult = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::TEXT AS count FROM org_memberships WHERE org_id = $1',
    [ctx.orgId],
  );
  const usageMeter = new UsageMeter();
  const usage = await usageMeter.getMonthlyUsageForOrg(ctx.orgId, ctx.userId);
  const today = await getTodayUsage(ctx.orgId, ctx.userId);
  const hasByok = await orgHasByokKey(ctx.orgId);
  const hasWorkbenchRun = await orgHasWorkbenchRun(ctx.orgId);
  const credits = await getCreditsStatus(ctx.orgId, ctx.userId);

  res.json({
    org: {
      id: ctx.orgId,
      name: org?.name ?? 'Organization',
      plan: org?.plan ?? 'free',
    },
    usage: {
      tokensToday: today.tokens,
      tokensThisMonth: usage,
      costEstimateToday: today.cost,
    },
    credits,
    members: Number(memberResult.rows[0]?.count ?? 1),
    onboarding: {
      hasByok,
      hasWorkbenchRun,
    },
  });
}

function safeJsonBody(body: unknown): unknown {
  return redactSecrets(body);
}

function handleServiceError(res: Response, err: unknown): void {
  if (err instanceof WorkbenchValidationError || err instanceof WorkbenchMissingKeyError) {
    res.status(err.statusCode).json(safeJsonBody({ error: err.message }));
    return;
  }
  if (err instanceof WorkbenchInferenceUnavailableError) {
    res.status(err.statusCode).json(safeJsonBody({
      error: err.message,
      byokAvailable: err.byokAvailable,
      managedAvailable: err.managedAvailable,
    }));
    return;
  }
  if (err instanceof WorkbenchQuotaError) {
    res.status(429).json(safeJsonBody({
      error: 'quota_exceeded',
      used: err.used,
      limit: err.limit,
    }));
    return;
  }
  if (err instanceof WorkbenchCreditsError) {
    res.status(429).json(safeJsonBody({
      error: err.code,
      message: err.message,
      modelClass: err.modelClass,
      used: err.used,
      limit: err.limit,
      remaining: err.remaining,
    }));
    return;
  }
  if (err instanceof VaultLimitError) {
    res.status(402).json(safeJsonBody({ error: 'upgrade_required', message: err.message, upgradeUrl: '/ops/billing' }));
    return;
  }
  if (err instanceof VaultNotFoundError) {
    res.status(404).json(safeJsonBody({ error: err.message }));
    return;
  }
  if (err instanceof ControlPlaneValidationError) {
    res.status(err.statusCode).json(safeJsonBody({ error: err.message }));
    return;
  }
  throw err;
}

export function mountCarinaOpsRoutes(app: Express): void {
  if (!config.carinaOps.productEnabled) return;

  const router = express.Router();
  router.use(express.json());

  router.get('/health', (_req, res) => {
    res.json({ ok: true, product: 'carina-ops' });
  });

  router.get('/admin/margins', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (_req, res) => {
    const summary = await getPlatformMarginSummary();
    res.json(safeJsonBody(summary));
  });

  router.use(requireHostedSession);
  router.use(requireOpsPlan('carina_ops_starter'));

  router.get('/overview', requireOrgMember('usage.read'), overviewHandler);

  router.get('/models', requireOrgMember('usage.read'), async (req, res) => {
    const ctx = orgContext(req);
    const plan = billingPlanIdFromOrgPlan(await getOrgPlan(ctx.orgId));
    const models = await listModelsForOrg(ctx.orgId);
    const metering = await getOpsModelMetering(ctx.orgId, plan);
    res.json({ models, ...metering });
  });

  router.post('/workbench/estimate', requireOrgMember('workbench.run'), async (req, res) => {
    const ctx = orgContext(req);
    const prompt = String(req.body?.prompt ?? '');
    const provider = String(req.body?.provider ?? '').trim();
    const model = String(req.body?.model ?? '').trim();
    if (!provider || !model) {
      res.status(400).json(safeJsonBody({ error: 'provider and model are required' }));
      return;
    }
    const planId = billingPlanIdFromOrgPlan(await getOrgPlan(ctx.orgId));
    const inferenceMode = await resolveWorkbenchInferenceMode(ctx.userId, provider);
    if (!inferenceMode) {
      res.status(400).json(safeJsonBody({
        error: 'No inference path available for this provider. Add a Vault key or enable managed inference.',
        allowed: false,
        inferenceMode: null,
      }));
      return;
    }
    const estimate = await estimateWorkbenchUsage({
      orgId: ctx.orgId,
      planId,
      provider,
      model,
      prompt,
      byok: inferenceMode === 'byok',
    });
    res.json(safeJsonBody({ ...estimate, inferenceMode }));
  });

  router.get('/vault', requireOrgMember('vault.read'), async (req, res) => {
    const ctx = orgContext(req);
    const entries = await listVaultEntries(ctx.orgId);
    res.json({ entries });
  });

  router.post('/vault', requireOrgMember('vault.write'), async (req, res) => {
    const ctx = orgContext(req);
    try {
      await addVaultEntry(ctx.orgId, ctx.userId, {
        provider: String(req.body?.provider ?? '').trim(),
        apiKey: String(req.body?.apiKey ?? ''),
        baseUrl: req.body?.baseUrl ? String(req.body.baseUrl) : undefined,
        model: req.body?.model ? String(req.body.model) : undefined,
      }, ctx.userId);
      res.status(201).json({ ok: true });
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  router.delete('/vault/:provider', requireOrgMember('vault.write'), async (req, res) => {
    const ctx = orgContext(req);
    const provider = String(req.params.provider);
    try {
      await removeVaultEntry(ctx.orgId, ctx.userId, provider, ctx.userId);
      res.json({ ok: true });
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  router.patch('/vault/:provider', requireOrgMember('vault.write'), async (req, res) => {
    const ctx = orgContext(req);
    const provider = String(req.params.provider);
    try {
      await toggleVaultEntry(
        ctx.orgId,
        provider,
        Boolean(req.body?.enabled),
        ctx.userId,
      );
      res.json({ ok: true });
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  router.post('/workbench/run', requireOrgMember('workbench.run'), async (req, res) => {
    const ctx = orgContext(req);
    try {
      const result = await executeWorkbenchRun({
        orgId: ctx.orgId,
        tenantId: ctx.userId,
        actorUserId: ctx.userId,
        prompt: String(req.body?.prompt ?? ''),
        provider: String(req.body?.provider ?? ''),
        model: String(req.body?.model ?? ''),
        title: req.body?.title ? String(req.body.title) : undefined,
        inferencePreference: req.body?.inferenceMode === 'managed' || req.body?.inferenceMode === 'byok'
          ? req.body.inferenceMode
          : 'auto',
        req,
      });
      res.json(safeJsonBody(result));
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  router.get('/workbench/runs', requireOrgMember('usage.read'), async (req, res) => {
    const ctx = orgContext(req);
    const limit = Number(req.query.limit ?? 20);
    const runs = await listWorkbenchRuns(ctx.orgId, limit);
    res.json({ runs: runs.map(summarizeRun) });
  });

  router.get('/usage', requireOrgMember('usage.read'), async (req, res) => {
    const ctx = orgContext(req);
    const days = Number(req.query.days ?? 30);
    const summary = await getUsageSummary(ctx.orgId, ctx.userId, days);
    const byModel = await getUsageByModel(ctx.orgId, ctx.userId, days);
    const plan = await getOrgPlan(ctx.orgId) as BillingPlanId;
    const credits = await getOpsCreditUsageSummary(ctx.orgId, plan);
    res.json({ summary, byModel, credits });
  });

  router.get(
    '/usage/export',
    requireOrgMember('usage.read'),
    requireFeature('exports'),
    async (req, res) => {
      const ctx = orgContext(req);
      const days = Number(req.query.days ?? 30);
      const format = String(req.query.format ?? 'csv');
      if (format !== 'csv') {
        res.status(400).json({ error: 'format must be csv' });
        return;
      }
      const csv = await exportUsageCsv(ctx.orgId, ctx.userId, days);
      await writeProductAudit({
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'exports.usage_downloaded',
        resourceType: 'usage_export',
        details: { days },
        req,
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="carina-ops-usage-${ctx.orgId}.csv"`,
      );
      res.send(csv);
    },
  );

  router.post('/topup', requireOrgMember('billing.write'), async (req, res) => {
    const ctx = orgContext(req);
    const packId = String(req.body?.packId ?? '') as CreditTopupPackId;
    if (!(packId in CREDIT_TOPUP_PACKS)) {
      res.status(400).json({ error: 'packId must be small or large' });
      return;
    }
    if (!config.hosted.stripeSecretKey) {
      res.status(503).json({ error: 'Billing is not configured' });
      return;
    }
    const origin = `${req.protocol}://${req.get('host') ?? 'localhost'}`;
    try {
      const stripeService = new StripeService();
      const session = await stripeService.createTopupCheckoutSession({
        tenantId: ctx.userId,
        orgId: ctx.orgId,
        email: ctx.email,
        packId,
        successUrl: `${origin}/ops/billing?topup=success`,
        cancelUrl: `${origin}/ops/billing?topup=cancel`,
      });
      await writeProductAudit({
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'billing.topup_checkout_started',
        resourceType: 'credit_topup',
        details: { packId },
        req,
      });
      res.json({ url: session.url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.get('/credits', requireOrgMember('usage.read'), async (req, res) => {
    const ctx = orgContext(req);
    const credits = await getCreditsStatus(ctx.orgId, ctx.userId);
    res.json(credits);
  });

  router.get('/billing/summary', requireOrgMember('billing.read'), async (req, res) => {
    const ctx = orgContext(req);
    const summary = await getBillingSummary(ctx.orgId, ctx.userId);
    res.json({
      ...summary,
      canUpgrade: ctx.role === 'owner',
    });
  });

  router.get('/audit', requireOrgMember('audit.read'), async (req, res) => {
    const ctx = orgContext(req);
    const plan = await getOrgPlan(ctx.orgId);
    const limit = Number(req.query.limit ?? 50);
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const result = await listProductAuditForPlan(ctx.orgId, plan, { limit, cursor });
    res.json(result);
  });

  router.get(
    '/audit/export',
    requireOrgMember('audit.read'),
    requireFeature('exports'),
    async (req, res) => {
      const ctx = orgContext(req);
      const format = String(req.query.format ?? 'csv');
      if (format !== 'csv') {
        res.status(400).json({ error: 'format must be csv' });
        return;
      }
      const plan = await getOrgPlan(ctx.orgId);
      const csv = await exportProductAuditCsv(ctx.orgId, plan);
      await writeProductAudit({
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'exports.audit_downloaded',
        resourceType: 'audit_export',
        req,
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="carina-ops-audit-${ctx.orgId}.csv"`,
      );
      res.send(csv);
    },
  );

  router.get('/onboarding', requireOrgMember('usage.read'), async (req, res) => {
    const ctx = orgContext(req);
    const checklist = await getOnboardingChecklist(ctx.orgId, ctx.userId);
    res.json(checklist);
  });

  router.post('/onboarding/dismiss', requireOrgMember('org.settings.write'), async (req, res) => {
    const ctx = orgContext(req);
    await dismissOnboardingWizard(ctx.orgId, ctx.userId);
    res.json({ ok: true });
  });

  router.post('/onboarding/usage-viewed', requireOrgMember('usage.read'), async (req, res) => {
    const ctx = orgContext(req);
    await markUsageViewed(ctx.orgId, ctx.userId);
    res.json({ ok: true });
  });

  router.get(
    '/deployments',
    requireOrgMember('deployments.read'),
    requireFeature('deployments'),
    async (req, res) => {
      const ctx = orgContext(req);
      const deployments = await listDeploymentsForOrg(ctx.orgId);
      res.json({ deployments });
    },
  );

  router.post(
    '/deployments',
    requireOrgMember('org.settings.write'),
    requireFeature('deployments'),
    async (req, res) => {
      const ctx = orgContext(req);
      const deployment = await createDeploymentForOrg(
        ctx.orgId,
        {
          name: String(req.body?.name ?? '').trim(),
          environmentId: req.body?.environmentId ? String(req.body.environmentId) : undefined,
          model: req.body?.model ? String(req.body.model) : undefined,
          provider: req.body?.provider ? String(req.body.provider) : undefined,
          version: req.body?.version ? String(req.body.version) : undefined,
          notes: req.body?.notes ? String(req.body.notes) : undefined,
        },
        ctx.userId,
      );
      res.status(201).json({ deployment });
    },
  );

  router.get(
    '/environments',
    requireOrgMember('deployments.read'),
    requireFeature('deployments'),
    async (req, res) => {
      const ctx = orgContext(req);
      const environments = await listEnvironmentsForOrg(ctx.orgId);
      res.json({ environments });
    },
  );

  router.post(
    '/environments',
    requireOrgMember('org.settings.write'),
    requireFeature('deployments'),
    async (req, res) => {
      const ctx = orgContext(req);
      const environment = await createEnvironmentForOrg(
        ctx.orgId,
        {
          name: String(req.body?.name ?? '').trim(),
          slug: req.body?.slug ? String(req.body.slug) : undefined,
          apiBaseUrl: req.body?.apiBaseUrl ? String(req.body.apiBaseUrl) : undefined,
          notes: req.body?.notes ? String(req.body.notes) : undefined,
        },
        ctx.userId,
      );
      res.status(201).json({ environment });
    },
  );

  router.get('/platform/summary', requireOrgMember('usage.read'), async (req, res) => {
    const ctx = orgContext(req);
    const summary = await getControlPlaneSummary(ctx.orgId, ctx.userId);
    res.json({ summary });
  });

  router.get('/files', requireOrgMember('usage.read'), async (req, res) => {
    const ctx = orgContext(req);
    const files = await listFilesForOrg(ctx.orgId);
    res.json({ files });
  });

  router.post('/files', requireOrgMember('org.settings.write'), async (req, res) => {
    const ctx = orgContext(req);
    try {
      const file = await createFileForOrg(
        ctx.orgId,
        {
          name: String(req.body?.name ?? ''),
          mimeType: req.body?.mimeType ? String(req.body.mimeType) : undefined,
          sizeBytes: req.body?.sizeBytes != null ? Number(req.body.sizeBytes) : undefined,
          storageUri: req.body?.storageUri ? String(req.body.storageUri) : undefined,
          notes: req.body?.notes ? String(req.body.notes) : undefined,
        },
        ctx.userId,
      );
      res.status(201).json({ file });
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  router.get('/batches', requireOrgMember('usage.read'), async (req, res) => {
    const ctx = orgContext(req);
    const batches = await listBatchesForOrg(ctx.orgId);
    res.json({ batches });
  });

  router.post('/batches', requireOrgMember('workbench.run'), async (req, res) => {
    const ctx = orgContext(req);
    try {
      const batch = await createBatchForOrg(
        ctx.orgId,
        {
          name: String(req.body?.name ?? ''),
          inputCount: req.body?.inputCount != null ? Number(req.body.inputCount) : undefined,
          notes: req.body?.notes ? String(req.body.notes) : undefined,
        },
        ctx.userId,
      );
      res.status(201).json({ batch });
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  router.get('/agents', requireOrgMember('usage.read'), async (req, res) => {
    const ctx = orgContext(req);
    const agents = await listAgentsForOrg(ctx.orgId);
    res.json({ agents });
  });

  router.post('/agents', requireOrgMember('org.settings.write'), async (req, res) => {
    const ctx = orgContext(req);
    try {
      const agent = await createAgentForOrg(
        ctx.orgId,
        {
          name: String(req.body?.name ?? ''),
          slug: req.body?.slug ? String(req.body.slug) : undefined,
          provider: req.body?.provider ? String(req.body.provider) : undefined,
          model: req.body?.model ? String(req.body.model) : undefined,
          instructions: req.body?.instructions ? String(req.body.instructions) : undefined,
        },
        ctx.userId,
      );
      res.status(201).json({ agent });
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  router.get('/sessions', requireOrgMember('usage.read'), async (req, res) => {
    const ctx = orgContext(req);
    const limit = Number(req.query.limit ?? 50);
    const sessions = await listSessionsForOrg(ctx.orgId, limit);
    res.json({ sessions });
  });

  router.post('/sessions', requireOrgMember('workbench.run'), async (req, res) => {
    const ctx = orgContext(req);
    try {
      const session = await createSessionForOrg(
        ctx.orgId,
        {
          title: req.body?.title ? String(req.body.title) : undefined,
          channel: req.body?.channel ? String(req.body.channel) : undefined,
          agentId: req.body?.agentId ? String(req.body.agentId) : undefined,
        },
        ctx.userId,
      );
      res.status(201).json({ session });
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  router.get('/memory-stores', requireOrgMember('usage.read'), async (req, res) => {
    const ctx = orgContext(req);
    const stores = await listMemoryStoresForOrg(ctx.orgId);
    res.json({ stores });
  });

  router.post('/memory-stores', requireOrgMember('org.settings.write'), async (req, res) => {
    const ctx = orgContext(req);
    try {
      const store = await createMemoryStoreForOrg(
        ctx.orgId,
        {
          name: String(req.body?.name ?? ''),
          slug: req.body?.slug ? String(req.body.slug) : undefined,
          storeType: req.body?.storeType ? String(req.body.storeType) : undefined,
          notes: req.body?.notes ? String(req.body.notes) : undefined,
        },
        ctx.userId,
      );
      res.status(201).json({ store });
    } catch (err) {
      handleServiceError(res, err);
    }
  });

  router.get('/skills', requireOrgMember('usage.read'), async (req, res) => {
    const ctx = orgContext(req);
    const packs = await listSkillPacksForTenant(ctx.userId);
    res.json({ packs });
  });

  router.get('/analytics', requireOrgMember('usage.read'), async (req, res) => {
    const ctx = orgContext(req);
    const days = Number(req.query.days ?? 30);
    const analytics = await getAnalyticsForOrg(ctx.orgId, days);
    res.json(analytics);
  });

  app.use('/api/carina-ops', router);
}
