import express, { type Express, type Request, type Response } from 'express';
import { config } from '../config/index.js';
import { pool } from '../memory/db.js';
import { requireHostedSession, requireOrgMember } from '../gateway/web-auth.js';
import { orgContext } from '../hosted/org-context.js';
import {
  createCustomDomainForOrg,
  deleteCustomDomainForOrg,
  dnsVerificationRecordName,
  listCustomDomainsForOrg,
  setCanonicalCustomDomain,
  verificationTxtValue,
  verifyCustomDomainDns,
} from '../hosted/custom-domain-service.js';
import { getPartnerBillingSummary } from '../hosted/partner-billing.js';
import {
  createClientOrganizationForPartner,
  createPartnerAccount,
  getPartnerForOrg,
  getPartnerOwnedByOrg,
  listClientOrganizations,
} from '../hosted/partner-service.js';
import {
  getPartnerPackCatalog,
  savePartnerPackCatalog,
} from '../hosted/partner-pack-catalog.js';
import {
  applyVerticalTemplate,
  buildPackStorefront,
  toggleStorefrontPack,
} from '../skills/hub/pack-storefront.js';
import {
  normalizePackCatalogRecord,
  type PackCatalogRecord,
} from '../skills/hub/pack-ownership.js';
import { loadTenantWorkspaceConfig, saveTenantWorkspaceConfig } from '../hosted/tenant-workspace-config.js';
import { listAvailablePacks } from '../skills/index.js';
import { normalizeWhiteLabelTier } from '../billing/white-label-plans.js';
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
import {
  createPartnerApiKey,
  listPartnerApiKeys,
  revokePartnerApiKey,
  type PartnerApiKeyScope,
} from '../hosted/partner-api-key-service.js';
import { emitPlatformEvent } from '../billing/platform-event-emitter.js';
import { reportAllPartnerUsage, reportMonthlyUsage } from '../billing/metered-billing.js';
import { hubPool } from '../skills/hub/migrations.js';
import { runHealthProbe, calculateSlaReport } from '../ops/health-probe.js';

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

  router.post('/internal/partners/:partnerId/keys', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    const { partnerId } = req.params;
    const label = String(req.body?.label ?? '').trim();
    if (!label) {
      res.status(400).json({ error: 'label is required' });
      return;
    }
    const key = await createPartnerApiKey({
      partnerId,
      label,
      scopes: Array.isArray(req.body?.scopes) ? req.body.scopes : undefined,
      rateLimitRpm: typeof req.body?.rateLimitRpm === 'number' ? req.body.rateLimitRpm : undefined,
      monthlyCapEvents: typeof req.body?.monthlyCapEvents === 'number' ? req.body.monthlyCapEvents : undefined,
      revenueShareBps: typeof req.body?.revenueShareBps === 'number' ? req.body.revenueShareBps : undefined,
    });
    res.status(201).json({ key });
  });

  router.get('/internal/partners/:partnerId/keys', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    const keys = await listPartnerApiKeys(req.params.partnerId);
    res.json({ keys });
  });

  router.delete('/internal/partners/:partnerId/keys/:keyId', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    const revoked = await revokePartnerApiKey(req.params.keyId, req.params.partnerId);
    if (!revoked) {
      res.status(404).json({ error: 'Key not found or already revoked' });
      return;
    }
    res.json({ revoked: true });
  });

  router.post('/internal/billing/calculate-author-earnings', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    const now = new Date();
    const monthParam = String(req.body?.billingMonth ?? '').trim();
    const billingMonth = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    try {
      // Query hub DB for premium packs with installs this month
      const packsResult = await hubPool.query(
        `SELECT name, install_count, author_email, author_share_bps, price_gbp_cents
         FROM skill_packs
         WHERE price_gbp_cents > 0 AND install_count > 0 AND author_email IS NOT NULL`,
      );

      let upserted = 0;
      for (const row of packsResult.rows as Record<string, unknown>[]) {
        const installs = Number(row.install_count ?? 0);
        const priceGbpCents = Number(row.price_gbp_cents ?? 0);
        const authorShareBps = Number(row.author_share_bps ?? 7000);
        const grossPence = installs * priceGbpCents;
        const authorPence = Math.floor(grossPence * authorShareBps / 10000);
        const carinaPence = grossPence - authorPence;

        await pool.query(
          `INSERT INTO author_earnings
             (author_email, pack_name, billing_month, installs, gross_pence, author_pence, carina_pence)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (author_email, pack_name, billing_month)
           DO UPDATE SET
             installs = EXCLUDED.installs,
             gross_pence = EXCLUDED.gross_pence,
             author_pence = EXCLUDED.author_pence,
             carina_pence = EXCLUDED.carina_pence`,
          [row.author_email, row.name, billingMonth, installs, grossPence, authorPence, carinaPence],
        );
        upserted++;
      }

      res.json({ billingMonth, packsProcessed: upserted });
    } catch (err) {
      res.status(500).json({ error: 'earnings_failed', message: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post('/internal/billing/report-usage', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    const partnerId = typeof req.body?.partnerId === 'string' ? req.body.partnerId.trim() : '';
    try {
      if (partnerId) {
        await reportMonthlyUsage(partnerId);
        res.json({ reported: true, partnerId });
      } else {
        await reportAllPartnerUsage();
        res.json({ reported: true, scope: 'all' });
      }
    } catch (err) {
      res.status(500).json({ error: 'report_failed', message: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post('/internal/ops/health-probe', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (_req, res) => {
    try {
      await runHealthProbe();
      res.json({ probed: true });
    } catch (err) {
      res.status(500).json({ error: 'probe_failed', message: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/internal/ops/sla-report', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    const month = String(req.query.month ?? '').trim() || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'month must be YYYY-MM' });
      return;
    }
    try {
      const report = await calculateSlaReport(month);
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: 'sla_report_failed', message: err instanceof Error ? err.message : String(err) });
    }
  });

  // ---- Partner self-service API key routes (ops-token + X-Core-Org-Id) ----
  // Called from app.carinaai.uk via proxyToCoreApi: ops token authenticates the caller,
  // X-Core-Org-Id carries the workspace's coreOrgId stored in the app DB.

  const VALID_SCOPES: PartnerApiKeyScope[] = ['session', 'memory', 'skills', 'analytics'];

  function resolveOrgIdFromHeader(req: Request, res: Response): string | null {
    const raw = req.headers['x-core-org-id'];
    const orgId = Array.isArray(raw) ? raw[0] : raw;
    if (!orgId || !/^[0-9a-f-]{36}$/i.test(orgId)) {
      res.status(400).json({ error: 'x-core-org-id header is required and must be a valid UUID' });
      return null;
    }
    return orgId;
  }

  router.get('/partner/api-keys', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    const orgId = resolveOrgIdFromHeader(req, res);
    if (!orgId) return;
    const partner = await getPartnerOwnedByOrg(orgId);
    if (!partner) { res.status(403).json({ error: 'not_a_partner' }); return; }
    const keys = await listPartnerApiKeys(partner.id);
    res.json({ keys });
  });

  router.post('/partner/api-keys', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    const orgId = resolveOrgIdFromHeader(req, res);
    if (!orgId) return;
    const partner = await getPartnerOwnedByOrg(orgId);
    if (!partner) { res.status(403).json({ error: 'not_a_partner' }); return; }

    const label = String(req.body?.label ?? '').trim();
    if (!label) { res.status(400).json({ error: 'label is required' }); return; }

    const rawScopes: string[] = Array.isArray(req.body?.scopes) ? req.body.scopes : ['session'];
    const scopes = rawScopes.filter((s): s is PartnerApiKeyScope => VALID_SCOPES.includes(s as PartnerApiKeyScope));
    if (scopes.length === 0) { res.status(400).json({ error: 'at least one valid scope required: session, memory, skills, analytics' }); return; }

    const rateLimitRpm = Number(req.body?.rateLimitRpm ?? 60);
    if (!Number.isInteger(rateLimitRpm) || rateLimitRpm < 1 || rateLimitRpm > 600) {
      res.status(400).json({ error: 'rateLimitRpm must be an integer between 1 and 600' }); return;
    }
    const monthlyCapEvents = Number(req.body?.monthlyCapEvents ?? 100000);

    const result = await createPartnerApiKey({ partnerId: partner.id, label, scopes, rateLimitRpm, monthlyCapEvents });
    void emitPlatformEvent({ orgId, partnerId: partner.id, eventType: 'webhook_delivery', metadata: { action: 'api_key_created', keyId: result.id, label } }).catch(() => {});
    res.status(201).json({ key: result });
  });

  router.delete('/partner/api-keys/:keyId', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    const orgId = resolveOrgIdFromHeader(req, res);
    if (!orgId) return;
    const partner = await getPartnerOwnedByOrg(orgId);
    if (!partner) { res.status(403).json({ error: 'not_a_partner' }); return; }
    const revoked = await revokePartnerApiKey(String(req.params.keyId), partner.id);
    if (!revoked) { res.status(404).json({ error: 'Key not found or already revoked' }); return; }
    res.status(204).end();
  });

  // ---- Partner self-service usage routes (ops-token + X-Core-Org-Id) ----

  function parseUsageDateRange(
    req: Request,
    res: Response,
    maxDays: number,
  ): { fromDate: Date; toDate: Date } | null {
    const from = String(req.query.from ?? '').trim();
    const to = String(req.query.to ?? '').trim();
    if (!from || !to) { res.status(400).json({ error: 'from and to query params are required' }); return null; }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) { res.status(400).json({ error: 'from and to must be valid ISO dates' }); return null; }
    if ((toDate.getTime() - fromDate.getTime()) / 86_400_000 > maxDays) {
      res.status(400).json({ error: `Maximum date range is ${maxDays} days` }); return null;
    }
    return { fromDate, toDate };
  }

  router.get('/partner/usage', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    const orgId = resolveOrgIdFromHeader(req, res);
    if (!orgId) return;
    const partner = await getPartnerOwnedByOrg(orgId);
    if (!partner) { res.status(403).json({ error: 'not_a_partner' }); return; }

    const range = parseUsageDateRange(req, res, 90);
    if (!range) return;
    const { fromDate, toDate } = range;
    const partnerId = partner.id;
    const groupBy = String(req.query.groupBy ?? 'day');
    const orgIdParam = String(req.query.orgId ?? '').trim();

    let filteredOrgId: string | null = null;
    if (orgIdParam) {
      const check = await pool.query(
        `SELECT id FROM organizations WHERE id = $1 AND partner_id = $2 LIMIT 1`,
        [orgIdParam, partnerId],
      );
      if ((check.rowCount ?? 0) === 0) { res.status(403).json({ error: 'org_not_found' }); return; }
      filteredOrgId = orgIdParam;
    }

    const baseWhere = filteredOrgId
      ? `WHERE e.partner_id = $1 AND e.created_at >= $2 AND e.created_at < $3 AND e.org_id = $4`
      : `WHERE e.partner_id = $1 AND e.created_at >= $2 AND e.created_at < $3`;
    const params: unknown[] = filteredOrgId
      ? [partnerId, fromDate, toDate, filteredOrgId]
      : [partnerId, fromDate, toDate];

    let seriesRows: Record<string, unknown>[] = [];
    if (groupBy === 'model') {
      const r = await pool.query(
        `SELECT e.model AS group_key, COUNT(*) AS events,
                SUM(e.tokens_in) AS tokens_in, SUM(e.tokens_out) AS tokens_out,
                SUM(e.tool_calls) AS tool_calls, SUM(e.skill_calls) AS skill_calls
         FROM platform_events e ${baseWhere}
         GROUP BY 1 ORDER BY events DESC`,
        params,
      );
      seriesRows = r.rows as Record<string, unknown>[];
    } else if (groupBy === 'event_type') {
      const r = await pool.query(
        `SELECT e.event_type AS group_key, COUNT(*) AS events,
                SUM(e.tokens_in) AS tokens_in, SUM(e.tokens_out) AS tokens_out,
                SUM(e.tool_calls) AS tool_calls, SUM(e.skill_calls) AS skill_calls
         FROM platform_events e ${baseWhere}
         GROUP BY 1 ORDER BY events DESC`,
        params,
      );
      seriesRows = r.rows as Record<string, unknown>[];
    } else {
      const r = await pool.query(
        `SELECT DATE_TRUNC('day', e.created_at) AS day, COUNT(*) AS events,
                SUM(e.tokens_in) AS tokens_in, SUM(e.tokens_out) AS tokens_out,
                SUM(e.tool_calls) AS tool_calls, SUM(e.skill_calls) AS skill_calls
         FROM platform_events e ${baseWhere}
         GROUP BY 1 ORDER BY 1`,
        params,
      );
      seriesRows = r.rows as Record<string, unknown>[];
    }

    const totals = seriesRows.reduce<{ events: number; tokensIn: number; tokensOut: number; toolCalls: number; skillCalls: number }>(
      (acc, row) => {
        acc.events += Number(row.events ?? 0);
        acc.tokensIn += Number(row.tokens_in ?? 0);
        acc.tokensOut += Number(row.tokens_out ?? 0);
        acc.toolCalls += Number(row.tool_calls ?? 0);
        acc.skillCalls += Number(row.skill_calls ?? 0);
        return acc;
      },
      { events: 0, tokensIn: 0, tokensOut: 0, toolCalls: 0, skillCalls: 0 },
    );

    const estimatedFeePence = Math.max(0, totals.events - 50_000) * 0.1;

    res.json({
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
      partnerId,
      groupBy,
      totals: { ...totals, estimatedFeePence },
      series: seriesRows.map((row) => ({
        ...(groupBy === 'day'
          ? { date: new Date(String(row.day)).toISOString().slice(0, 10) }
          : { key: row.group_key }),
        events: Number(row.events ?? 0),
        tokensIn: Number(row.tokens_in ?? 0),
        tokensOut: Number(row.tokens_out ?? 0),
        toolCalls: Number(row.tool_calls ?? 0),
        skillCalls: Number(row.skill_calls ?? 0),
      })),
    });
  });

  router.get('/partner/usage/export', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    const orgId = resolveOrgIdFromHeader(req, res);
    if (!orgId) return;
    const partner = await getPartnerOwnedByOrg(orgId);
    if (!partner) { res.status(403).json({ error: 'not_a_partner' }); return; }

    const range = parseUsageDateRange(req, res, 31);
    if (!range) return;
    const { fromDate, toDate } = range;
    const partnerId = partner.id;
    const format = String(req.query.format ?? 'csv').toLowerCase();
    if (format !== 'csv' && format !== 'ndjson') {
      res.status(400).json({ error: 'format must be csv or ndjson' }); return;
    }

    const result = await pool.query(
      `SELECT id, event_type, org_id, model, provider,
              tokens_in, tokens_out, tool_calls, skill_calls,
              scout_verified, fee_pence, created_at
       FROM platform_events
       WHERE partner_id = $1 AND created_at >= $2 AND created_at < $3
       ORDER BY created_at ASC`,
      [partnerId, fromDate, toDate],
    );

    const rows = result.rows as Record<string, unknown>[];
    const dateLabel = `${fromDate.toISOString().slice(0, 10)}_${toDate.toISOString().slice(0, 10)}`;

    void emitPlatformEvent({
      partnerId,
      orgId,
      eventType: 'memory_read',
      metadata: { action: 'compliance_export', format, rows: rows.length },
    }).catch(() => {});

    if (format === 'csv') {
      const header = 'id,event_type,org_id,model,provider,tokens_in,tokens_out,tool_calls,skill_calls,scout_verified,fee_pence,created_at';
      const csvRows = rows.map((r) =>
        [r.id, r.event_type, r.org_id ?? '', r.model ?? '', r.provider ?? '',
          r.tokens_in, r.tokens_out, r.tool_calls, r.skill_calls,
          r.scout_verified, r.fee_pence,
          r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
        ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','),
      );
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=carina_events_${dateLabel}.csv`);
      res.send([header, ...csvRows].join('\n'));
      return;
    }

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Content-Disposition', `attachment; filename=carina_events_${dateLabel}.ndjson`);
    res.send(rows.map((r) => JSON.stringify(r)).join('\n'));
  });

  // ---- Marketplace submission proxy routes (core -> hub) ----

  async function proxyToHub(
    req: Request,
    res: Response,
    hubPath: string,
    options?: { method?: string; body?: unknown },
  ): Promise<void> {
    const hubBaseUrl = config.hub.url.replace(/\/$/, '');
    const url = `${hubBaseUrl}${hubPath}`;
    const method = options?.method ?? req.method;
    const incoming = new URL(req.url, 'http://localhost');
    const fullUrl = `${url}?${incoming.searchParams.toString()}`.replace(/\?$/, '');
    try {
      const fetchInit: RequestInit = {
        method,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.hub.publishApiKey}`,
        },
      };
      if (method !== 'GET' && method !== 'HEAD') {
        fetchInit.body = JSON.stringify(options?.body ?? req.body);
      }
      const upstream = await fetch(fullUrl, fetchInit);
      const body = await upstream.text();
      res.status(upstream.status).set('content-type', upstream.headers.get('content-type') ?? 'application/json').send(body);
    } catch {
      res.status(502).json({ error: 'hub_unreachable' });
    }
  }

  router.get('/internal/marketplace/submissions', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    await proxyToHub(req, res, '/api/submissions');
  });

  router.get('/internal/marketplace/submissions/:id', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    await proxyToHub(req, res, `/api/submissions/${encodeURIComponent(req.params.id)}`);
  });

  router.patch('/internal/marketplace/submissions/:id', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    await proxyToHub(req, res, `/api/submissions/${encodeURIComponent(req.params.id)}`, { method: 'PATCH' });
  });

  router.post('/internal/marketplace/submissions/:id/publish', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    await proxyToHub(req, res, `/api/submissions/${encodeURIComponent(req.params.id)}/publish`, { method: 'POST' });
  });

  // ---- Partner admin ops routes ----

  router.get('/internal/partners', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    const status = String(req.query.status ?? '').trim() || null;
    const search = String(req.query.search ?? '').trim() || null;
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '25'), 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) { params.push(status); conditions.push(`p.status = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`(p.name ILIKE $${params.length} OR p.slug ILIKE $${params.length})`); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    const rows = await pool.query(
      `SELECT p.id, p.name, p.slug, p.status, p.commercial_tier,
              p.created_at, p.updated_at,
              COUNT(DISTINCT k.id) FILTER (WHERE k.status = 'active') AS key_count,
              COUNT(DISTINCT e.id) FILTER (WHERE e.created_at >= date_trunc('month', NOW())) AS events_this_month,
              COUNT(DISTINCT o.id) AS client_org_count
       FROM partner_accounts p
       LEFT JOIN partner_api_keys k ON k.partner_id = p.id
       LEFT JOIN platform_events e ON e.partner_id = p.id
       LEFT JOIN organizations o ON o.partner_id = p.id
       ${whereClause}
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const countParams = conditions.length > 0 ? params.slice(0, -2) : [];
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM partner_accounts p ${whereClause}`,
      countParams,
    );
    const total = parseInt(String((countResult.rows[0] as Record<string, string>).total ?? '0'), 10);

    res.json({
      partners: rows.rows.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          id: row.id,
          name: row.name,
          slug: row.slug,
          status: row.status,
          commercialTier: row.commercial_tier,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          keyCount: Number(row.key_count ?? 0),
          eventsThisMonth: Number(row.events_this_month ?? 0),
          clientOrgCount: Number(row.client_org_count ?? 0),
        };
      }),
      total,
      page,
      limit,
    });
  });

  router.get('/internal/partners/:partnerId/detail', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    const { partnerId } = req.params;
    const [partnerRows, apiKeys, clientOrgsRows, usageRows, slaCreditsRows] = await Promise.all([
      pool.query(
        `SELECT id, name, slug, status, commercial_tier, stripe_customer_id,
                stripe_subscription_id, created_at, updated_at
         FROM partner_accounts WHERE id = $1 LIMIT 1`,
        [partnerId],
      ),
      listPartnerApiKeys(partnerId),
      pool.query(
        `SELECT id, name, slug, plan, status, created_at
         FROM organizations WHERE partner_id = $1 ORDER BY created_at DESC`,
        [partnerId],
      ),
      pool.query(
        `SELECT COUNT(*) AS events,
                COALESCE(SUM(tokens_in), 0) AS tokens_in,
                COALESCE(SUM(tokens_out), 0) AS tokens_out,
                COALESCE(SUM(tool_calls), 0) AS tool_calls,
                COALESCE(SUM(skill_calls), 0) AS skill_calls
         FROM platform_events
         WHERE partner_id = $1 AND created_at >= date_trunc('month', NOW())`,
        [partnerId],
      ),
      pool.query(
        `SELECT * FROM sla_credits WHERE partner_id = $1 ORDER BY created_at DESC LIMIT 12`,
        [partnerId],
      ),
    ]);

    if ((partnerRows.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Partner not found' }); return; }

    const p = partnerRows.rows[0] as Record<string, unknown>;
    const u = usageRows.rows[0] as Record<string, unknown>;
    const eventsCount = Number(u.events ?? 0);
    const estimatedFeePence = Math.max(0, eventsCount - 50_000) * 0.1;

    res.json({
      partner: {
        id: p.id, name: p.name, slug: p.slug, status: p.status,
        commercialTier: p.commercial_tier,
        stripeCustomerId: p.stripe_customer_id,
        stripeSubscriptionId: p.stripe_subscription_id,
        createdAt: p.created_at, updatedAt: p.updated_at,
      },
      apiKeys,
      clientOrgs: clientOrgsRows.rows,
      usageThisMonth: {
        events: eventsCount,
        tokensIn: Number(u.tokens_in ?? 0),
        tokensOut: Number(u.tokens_out ?? 0),
        toolCalls: Number(u.tool_calls ?? 0),
        skillCalls: Number(u.skill_calls ?? 0),
        estimatedFeePence,
      },
      slaCredits: slaCreditsRows.rows,
    });
  });

  router.patch('/internal/partners/:partnerId/status', (req, res, next) => {
    requireOpsAuth(req, res, next);
  }, async (req, res) => {
    const { partnerId } = req.params;
    const newStatus = String(req.body?.status ?? '').trim();
    if (!['active', 'suspended', 'archived'].includes(newStatus)) {
      res.status(400).json({ error: 'status must be active, suspended, or archived' }); return;
    }
    const result = await pool.query(
      `UPDATE partner_accounts SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newStatus, partnerId],
    );
    if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Partner not found' }); return; }
    void emitPlatformEvent({
      partnerId,
      eventType: 'webhook_delivery',
      metadata: { action: 'partner_status_changed', newStatus },
    }).catch(() => {});
    const row = result.rows[0] as Record<string, unknown>;
    res.json({ partner: row });
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

  router.get('/telemetry/overview', requireOrgMember('usage.read'), async (req, res) => {
    const hours = Number(req.query.hours ?? 24);
    const { buildTelemetryOverview } = await import('../ops/observability/health-snapshot.js');
    const overview = await buildTelemetryOverview(Number.isFinite(hours) ? hours : 24);
    res.json(overview);
  });

  router.get('/telemetry/health', requireOrgMember('usage.read'), async (_req, res) => {
    const { buildTelemetryHealthSnapshot } = await import('../ops/observability/health-snapshot.js');
    res.json(await buildTelemetryHealthSnapshot());
  });

  router.get('/telemetry/channels', requireOrgMember('usage.read'), async (_req, res) => {
    const { buildChannelHealthSnapshot } = await import('../ops/observability/channel-health.js');
    res.json(buildChannelHealthSnapshot());
  });

  router.get('/domains', requireOrgMember('org.settings.read'), async (req, res) => {
    const ctx = orgContext(req);
    const domains = await listCustomDomainsForOrg(ctx.orgId);
    res.json({
      domains: domains.map((domain) => ({
        ...domain,
        verificationRecord: dnsVerificationRecordName(domain.hostname),
        verificationValue: verificationTxtValue(domain.verificationToken),
      })),
    });
  });

  router.post('/domains', requireOrgMember('org.settings.write'), async (req, res) => {
    const ctx = orgContext(req);
    const hostname = String(req.body?.hostname ?? '').trim();
    if (!hostname) {
      res.status(400).json({ error: 'hostname is required' });
      return;
    }
    try {
      const domain = await createCustomDomainForOrg(ctx.orgId, hostname);
      res.status(201).json({
        domain,
        verificationRecord: dnsVerificationRecordName(domain.hostname),
        verificationValue: verificationTxtValue(domain.verificationToken),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create custom domain';
      res.status(400).json({ error: message });
    }
  });

  router.post('/domains/:id/verify', requireOrgMember('org.settings.write'), async (req, res) => {
    const ctx = orgContext(req);
    try {
      const domain = await verifyCustomDomainDns(String(req.params.id), ctx.orgId);
      res.json({ domain });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      res.status(400).json({ error: message });
    }
  });

  router.post('/domains/:id/canonical', requireOrgMember('org.settings.write'), async (req, res) => {
    const ctx = orgContext(req);
    const domain = await setCanonicalCustomDomain(ctx.orgId, String(req.params.id));
    if (!domain) {
      res.status(404).json({ error: 'Verified custom domain not found' });
      return;
    }
    res.json({ domain });
  });

  router.delete('/domains/:id', requireOrgMember('org.settings.write'), async (req, res) => {
    const ctx = orgContext(req);
    const deleted = await deleteCustomDomainForOrg(ctx.orgId, String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Custom domain not found' });
      return;
    }
    res.json({ ok: true });
  });

  router.get('/partner/account', requireOrgMember('billing.read'), async (req, res) => {
    const ctx = orgContext(req);
    const owned = await getPartnerOwnedByOrg(ctx.orgId);
    const client = owned ? null : await getPartnerForOrg(ctx.orgId);
    const partner = owned ?? client;
    if (!partner) {
      res.json({ partner: null });
      return;
    }
    res.json({ partner, role: owned ? 'owner' : 'client' });
  });

  router.get('/partner/summary', requireOrgMember('billing.read'), async (req, res) => {
    const ctx = orgContext(req);
    const partner = await getPartnerOwnedByOrg(ctx.orgId);
    if (!partner) {
      res.status(404).json({ error: 'Partner account not found for this organization' });
      return;
    }
    const days = Number(req.query.days ?? 30);
    const summary = await getPartnerBillingSummary(partner.id, Number.isFinite(days) ? days : 30);
    res.json({ summary });
  });

  router.get('/partner/clients', requireOrgMember('billing.read'), async (req, res) => {
    const ctx = orgContext(req);
    const partner = await getPartnerOwnedByOrg(ctx.orgId);
    if (!partner) {
      res.status(404).json({ error: 'Partner account not found for this organization' });
      return;
    }
    const clients = await listClientOrganizations(partner.id);
    res.json({ clients, maxClientWorkspaces: partner.maxClientOrgs });
  });

  router.post('/partner/clients', requireOrgMember('org.settings.write'), async (req, res) => {
    const ctx = orgContext(req);
    const partner = await getPartnerOwnedByOrg(ctx.orgId);
    if (!partner) {
      res.status(404).json({ error: 'Partner account not found for this organization' });
      return;
    }
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const name = String(req.body?.name ?? '').trim();
    if (!email) {
      res.status(400).json({ error: 'email is required' });
      return;
    }
    const userResult = await pool.query<{ id: string }>(
      `SELECT id FROM hosted_users WHERE email = $1 LIMIT 1`,
      [email],
    );
    if ((userResult.rowCount ?? 0) === 0) {
      res.status(400).json({ error: 'Hosted user not found for client email' });
      return;
    }
    try {
      const created = await createClientOrganizationForPartner({
        partnerId: partner.id,
        name,
        ownerUserId: String(userResult.rows[0].id),
        email,
      });
      res.status(201).json({ client: created });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create client workspace';
      res.status(400).json({ error: message });
    }
  });

  router.post('/partner/account', requireOrgMember('org.settings.write'), async (req, res) => {
    const ctx = orgContext(req);
    const existing = await getPartnerOwnedByOrg(ctx.orgId);
    if (existing) {
      res.json({ partner: existing });
      return;
    }
    const name = String(req.body?.name ?? '').trim();
    const tier = normalizeWhiteLabelTier(req.body?.commercialTier);
    const partner = await createPartnerAccount({
      name: name || 'Partner account',
      commercialTier: tier,
      ownerOrgId: ctx.orgId,
      brand: req.body?.brand,
    });
    res.status(201).json({ partner });
  });

  router.get('/packs/storefront', requireOrgMember('org.settings.read'), async (req, res) => {
    const ctx = orgContext(req);
    const org = await getOrgProfile(ctx.orgId);
    const tenantConfig = org?.slug ? loadTenantWorkspaceConfig(org.slug) : { activeSkillPacks: [] };
    const partner = (await getPartnerOwnedByOrg(ctx.orgId)) ?? (await getPartnerForOrg(ctx.orgId));
    const partnerPacks = partner ? await getPartnerPackCatalog(partner.id) : [];
    const activePacks = Array.isArray(req.query.activePacks)
      ? req.query.activePacks.map(String)
      : tenantConfig.activeSkillPacks;
    const storefront = buildPackStorefront({
      activePacks,
      productName: partner?.brand?.productName ?? org?.brand?.productName,
      marketplaceEnabled: config.hosted.enabled,
      context: {
        partnerId: partner?.id ?? null,
        workspaceId: ctx.orgId,
      },
      partnerPacks,
    });
    res.json(storefront);
  });

  router.put('/packs/catalog', requireOrgMember('org.settings.write'), async (req, res) => {
    const ctx = orgContext(req);
    const partner = await getPartnerOwnedByOrg(ctx.orgId);
    if (!partner) {
      res.status(403).json({ error: 'Partner owner account required' });
      return;
    }
    const raw = Array.isArray(req.body?.catalog) ? req.body.catalog : [];
    const catalog = raw
      .map((entry: unknown) => normalizePackCatalogRecord(entry))
      .filter((entry: PackCatalogRecord | null): entry is PackCatalogRecord => entry !== null);
    const saved = await savePartnerPackCatalog(partner.id, catalog);
    res.json({ catalog: saved });
  });

  router.post('/packs/templates/:templateId/install', requireOrgMember('org.settings.write'), async (req, res) => {
    const ctx = orgContext(req);
    const org = await getOrgProfile(ctx.orgId);
    if (!org?.slug) {
      res.status(400).json({ error: 'Organization slug missing' });
      return;
    }
    const current = loadTenantWorkspaceConfig(org.slug).activeSkillPacks;
    const known = listAvailablePacks().map((pack) => pack.name);
    const result = applyVerticalTemplate(current, String(req.params.templateId), known);
    if (result.invalid.length > 0) {
      res.status(400).json({ error: 'Unknown packs in template', invalid: result.invalid });
      return;
    }
    const saved = saveTenantWorkspaceConfig(org.slug, { activeSkillPacks: result.packs }, ctx.userId);
    res.json({ activePacks: saved.activeSkillPacks });
  });

  router.post('/packs/:slug/toggle', requireOrgMember('org.settings.write'), async (req, res) => {
    const ctx = orgContext(req);
    const org = await getOrgProfile(ctx.orgId);
    if (!org?.slug) {
      res.status(400).json({ error: 'Organization slug missing' });
      return;
    }
    const enabled = req.body?.enabled !== false;
    const current = loadTenantWorkspaceConfig(org.slug).activeSkillPacks;
    const known = listAvailablePacks().map((pack) => pack.name);
    const result = toggleStorefrontPack(current, String(req.params.slug), enabled, known);
    if (result.invalid.length > 0) {
      res.status(400).json({ error: 'Unknown pack', invalid: result.invalid });
      return;
    }
    const saved = saveTenantWorkspaceConfig(org.slug, { activeSkillPacks: result.packs }, ctx.userId);
    res.json({ activePacks: saved.activeSkillPacks });
  });

  app.use('/api/carina-ops', router);
}
