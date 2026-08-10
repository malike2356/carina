import type { Express, Request, Response } from 'express';
import { reloadSecrets } from '../ops/secrets-reload.js';
import { authorizeOps } from '../ops/ops-auth.js';
import { reloadBillingRuntime, resolveConfigValue, refreshBillingConfigCache } from '../billing/billing-config.js';
import { resolveStripeSecretKey } from '../billing/billing-stripe-client.js';
import {
  getLastOperatorPackAudit,
  listOperatorInstalledPacks,
  listRecentOperatorPackAudit,
  syncOperatorActivePacks,
} from '../skills/operator-pack-store.js';
import { listAvailablePacks } from '../skills/index.js';
import { getWebPasswordStatus, setWebPassword } from '../ops/web-password.js';
import { buildEnvironmentSummary } from '../ops/environment-summary.js';
import { queryAttestationReport } from '../admin/admin-fleet-queries.js';
import { provisionBusinessWorkspace } from '../admin/business-provisioning.js';
import { mountObservabilityRoutes } from './observability-routes.js';
import { mountConversationHealthRoutes } from './conversation-health.js';
import {
  getGoogleOAuthPlatformStatus,
  saveGoogleOAuthPlatformCredentials,
} from '../ops/google-oauth-platform.js';
import {
  backfillMissingEmbeddings,
  getEmbeddingsPlatformStatus,
  probeEmbeddings,
  saveEmbeddingsPlatformConfig,
} from '../ops/embeddings-platform.js';
import {
  getLlmRotationPlatformStatus,
  saveLlmRotationPlatformConfig,
} from '../ops/llm-rotation-platform.js';
import { listModelsForProvider } from '../ops/llm-provider-models.js';
import {
  effectiveScoutControlMode,
  parseScoutAlertMinimumSeverity,
  parseScoutControlMode,
  readScoutControlSettings,
  writeScoutControlSettings,
} from '../security/scout-control-settings.js';
import {
  bridgeTokenHint,
  getHumanAssistBridgeConfig,
  saveHumanAssistBridgeConfig,
} from '../workers/human-assist-bridge-config.js';
import { conversationHealthHandler } from './conversation-health.js';
import { mountOpsAgentEngineRoutes } from './ops-agent-engine-routes.js';
import { mountKeprixProductApi } from './keprix-product/keprix-product-api.js';

export function mountOpsRoutes(app: Express): void {
  mountObservabilityRoutes(app);
  mountConversationHealthRoutes(app);
  mountOpsAgentEngineRoutes(app);
  mountKeprixProductApi(app);

  app.get('/api/ops/conversations/:workerId', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await conversationHealthHandler(req, res);
  });

  app.get('/api/ops/embeddings', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const status = await getEmbeddingsPlatformStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/ops/product-llms', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const {
        resolveConfiguredProductLlm,
      } = await import('../billing/product-llm-resolve.js');
      const platform = await getLlmRotationPlatformStatus();
      const trial = resolveConfiguredProductLlm('trial');
      const paid = resolveConfiguredProductLlm('paid');
      res.json({
        ok: true,
        platform: {
          provider: platform.defaultProvider,
          model: platform.model,
          rotationEnabled: platform.enabled,
          chain: platform.chain,
          source: platform.source,
          note: platform.note,
        },
        aiva: {
          trial: trial ?? {
            lane: 'trial',
            provider: platform.defaultProvider,
            model: platform.model,
            source: 'platform_default',
            reason: 'No AIVA_TRIAL_LLM_* set; inherits platform',
          },
          paid: paid ?? {
            lane: 'paid',
            provider: platform.defaultProvider,
            model: platform.model,
            source: 'platform_default',
            reason: 'No AIVA_PAID_LLM_* set; inherits platform',
          },
        },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/ops/llm-rotation', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const status = await getLlmRotationPlatformStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/ops/llm-rotation/models', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const provider = String(req.query.provider ?? '').trim().toLowerCase();
    if (!provider) {
      res.status(400).json({ error: 'provider query param is required' });
      return;
    }
    try {
      const result = await listModelsForProvider(provider);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.put('/api/ops/llm-rotation', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const saved = await saveLlmRotationPlatformConfig({
        enabled: body.enabled as string | boolean | undefined,
        providers: body.providers as string[] | string | undefined,
        defaultProvider: body.defaultProvider !== undefined
          ? String(body.defaultProvider)
          : undefined,
        model: body.model !== undefined ? String(body.model) : undefined,
      });
      if (!saved.ok) {
        res.status(400).json({ error: saved.error ?? 'Save failed' });
        return;
      }
      const status = await getLlmRotationPlatformStatus();
      res.json({ ok: true, status });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/ops/llm-rotation', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const saved = await saveLlmRotationPlatformConfig({
        enabled: body.enabled as string | boolean | undefined,
        providers: body.providers as string[] | string | undefined,
        defaultProvider: body.defaultProvider !== undefined
          ? String(body.defaultProvider)
          : undefined,
        model: body.model !== undefined ? String(body.model) : undefined,
      });
      if (!saved.ok) {
        res.status(400).json({ error: saved.error ?? 'Save failed' });
        return;
      }
      const status = await getLlmRotationPlatformStatus();
      res.json({ ok: true, status });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/ops/embeddings', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const saved = await saveEmbeddingsPlatformConfig({
        preferredProvider: body.preferredProvider !== undefined
          ? String(body.preferredProvider)
          : undefined,
        embeddingModel: body.embeddingModel !== undefined
          ? String(body.embeddingModel)
          : undefined,
        maxChars: body.maxChars !== undefined ? String(body.maxChars) : undefined,
        geminiApiKey: body.geminiApiKey !== undefined ? String(body.geminiApiKey) : undefined,
        openaiApiKey: body.openaiApiKey !== undefined ? String(body.openaiApiKey) : undefined,
        openaiBaseUrl: body.openaiBaseUrl !== undefined ? String(body.openaiBaseUrl) : undefined,
        voyageApiKey: body.voyageApiKey !== undefined ? String(body.voyageApiKey) : undefined,
        ollamaBaseUrl: body.ollamaBaseUrl !== undefined ? String(body.ollamaBaseUrl) : undefined,
        ollamaApiKey: body.ollamaApiKey !== undefined ? String(body.ollamaApiKey) : undefined,
        ollamaEnabled: body.ollamaEnabled as string | boolean | undefined,
        ollamaEmbeddingModel: body.ollamaEmbeddingModel !== undefined
          ? String(body.ollamaEmbeddingModel)
          : undefined,
      });
      if (!saved.ok) {
        res.status(400).json({ error: saved.error ?? 'Save failed' });
        return;
      }
      const status = await getEmbeddingsPlatformStatus();
      res.json({ ok: true, status });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/ops/embeddings/probe', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const result = await probeEmbeddings();
      res.status(result.ok ? 200 : 503).json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/ops/embeddings/backfill', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const limitRaw = (req.body as { limit?: unknown } | undefined)?.limit;
      const limit = limitRaw !== undefined ? Number(limitRaw) : undefined;
      const result = await backfillMissingEmbeddings(limit);
      res.status(result.ok ? 200 : 503).json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/ops/google-oauth', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const status = await getGoogleOAuthPlatformStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/ops/google-oauth', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const clientId = String(req.body?.clientId ?? '').trim();
      const clientSecret = String(req.body?.clientSecret ?? '').trim();
      const saved = await saveGoogleOAuthPlatformCredentials({ clientId, clientSecret });
      if (!saved.ok) {
        res.status(400).json({ error: saved.error ?? 'Save failed' });
        return;
      }
      const status = await getGoogleOAuthPlatformStatus();
      res.json({ ok: true, status });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/ops/reload-secrets', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = await reloadSecrets({ overwrite: true, notifyGateway: false });
    await reloadBillingRuntime().catch(() => undefined);
    res.json({
      ok: true,
      reloaded: result.reloaded.length,
      skipped: result.skipped.length,
    });
  });

  app.post('/api/ops/billing-config/reload', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await reloadBillingRuntime();
    res.json({ ok: true, reloaded: true });
  });

  app.get('/api/ops/aiva-hosted-email/status', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { hostedEmailOperatorStatus } = await import('../ingestion/email/hosted-email-address.js');
    res.json(hostedEmailOperatorStatus());
  });

  app.get('/api/ops/conveyor/audit', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const { auditCarinaCore, defaultCarinaAuditRoot } = await import('../conveyor/runtime.js');
      const projectPath =
        typeof req.query.projectPath === 'string' && req.query.projectPath.trim()
          ? req.query.projectPath.trim()
          : defaultCarinaAuditRoot();
      const result = auditCarinaCore(projectPath);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/ops/conveyor/status', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { pipelineStatus } = await import('../conveyor/runtime.js');
    res.json({ ok: true, status: pipelineStatus() });
  });

  app.post('/api/ops/conveyor/pipeline', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const { runCarinaConveyorPipeline, defaultCarinaAuditRoot } = await import('../conveyor/runtime.js');
      const targetEnv = String(req.body?.targetEnv ?? 'staging');
      const humanApproval = req.body?.humanApproval === true;
      const projectPath =
        typeof req.body?.projectPath === 'string' && req.body.projectPath.trim()
          ? req.body.projectPath.trim()
          : defaultCarinaAuditRoot();
      const result = await runCarinaConveyorPipeline(targetEnv, { humanApproval, projectPath });
      res.status(result.report.passed ? 200 : 422).json({ ok: result.report.passed, ...result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/ops/social-proof', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const { getSocialProofStore, inbox } = await import('../social-proof/runtime.js');
      const store = getSocialProofStore();
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const rows =
        status === 'pending'
          ? inbox(store)
          : store.list({
              status: status === 'approved' || status === 'rejected' ? status : undefined,
              product: typeof req.query.product === 'string' ? req.query.product : undefined,
            });
      res.json({ ok: true, count: rows.length, testimonials: rows });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/ops/social-proof/collect', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const { collectSocialProof, runWeeklyCollection, getSocialProofStore, FIXTURES } = await import(
        '../social-proof/runtime.js'
      );
      if (req.body?.weekly) {
        const result = await runWeeklyCollection(getSocialProofStore(), {
          force: req.body?.force === true,
          fixturesPath: req.body?.fixtures ? FIXTURES : undefined,
          product: 'carina',
          githubRepo: process.env.CARINA_GITHUB_REPO || 'malike2356/carina-ai',
        });
        res.json({ ok: true, ...result });
        return;
      }
      const results = await collectSocialProof({ forceFixtures: req.body?.fixtures === true });
      res.json({ ok: true, results });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/ops/social-proof/manual', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const { getSocialProofStore, manualEntry } = await import('../social-proof/runtime.js');
      const item = manualEntry(getSocialProofStore(), {
        text: String(req.body?.text || ''),
        author: String(req.body?.author || ''),
        link: String(req.body?.link || req.body?.url || ''),
        platform: req.body?.platform,
        product: req.body?.product || 'carina',
        tags: Array.isArray(req.body?.tags) ? req.body.tags.map(String) : undefined,
      });
      res.json({ ok: true, testimonial: item });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/ops/social-proof/:id/approve', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { getSocialProofStore, approve } = await import('../social-proof/runtime.js');
    const row = approve(getSocialProofStore(), String(req.params.id));
    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ ok: true, testimonial: row });
  });

  app.post('/api/ops/social-proof/:id/reject', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { getSocialProofStore, reject } = await import('../social-proof/runtime.js');
    const row = reject(getSocialProofStore(), String(req.params.id));
    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ ok: true, testimonial: row });
  });

  app.post('/api/ops/social-proof/:id/tag', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { getSocialProofStore, tag } = await import('../social-proof/runtime.js');
    const tags = Array.isArray(req.body?.tags) ? req.body.tags.map(String) : String(req.body?.tag || '').split(',');
    const row = tag(getSocialProofStore(), String(req.params.id), tags);
    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ ok: true, testimonial: row });
  });

  app.post('/api/ops/social-proof/:id/assign', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { getSocialProofStore, assignProduct } = await import('../social-proof/runtime.js');
    const row = assignProduct(getSocialProofStore(), String(req.params.id), String(req.body?.product || ''));
    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ ok: true, testimonial: row });
  });

  app.get('/api/ops/social-proof/render', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { renderCarinaProofHtml } = await import('../social-proof/runtime.js');
    res.type('html').send(renderCarinaProofHtml());
  });

  app.get('/api/ops/errors/search', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const { searchErrors, currentFiveHundredSpike } = await import('../errors/runtime.js');
      const rows = searchErrors({
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
        userId: typeof req.query.userId === 'string' ? req.query.userId : undefined,
        route: typeof req.query.route === 'string' ? req.query.route : undefined,
        statusCode:
          typeof req.query.statusCode === 'string' && req.query.statusCode.trim()
            ? Number(req.query.statusCode)
            : undefined,
        errorReference:
          typeof req.query.errorReference === 'string' ? req.query.errorReference : undefined,
        limit:
          typeof req.query.limit === 'string' && req.query.limit.trim()
            ? Number(req.query.limit)
            : 100,
      });
      res.json({ ok: true, count: rows.length, spike: currentFiveHundredSpike(), errors: rows });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/ops/errors/:errorReference', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const { getErrorContext } = await import('../errors/runtime.js');
      const row = getErrorContext(String(req.params.errorReference || ''));
      if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json({ ok: true, error: row });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/ops/feature-health', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const { runCarinaFeatureHealthAudit } = await import('../feature-health/runtime.js');
      const baseUrl =
        typeof req.query.baseUrl === 'string' && req.query.baseUrl.trim()
          ? req.query.baseUrl.trim()
          : process.env.CARINA_PUBLIC_BASE_URL || undefined;
      const report = await runCarinaFeatureHealthAudit({
        workspaceId: typeof req.query.workspaceId === 'string' ? req.query.workspaceId : 'platform',
        baseUrl,
        fetchFn: baseUrl
          ? async (url) => {
              const resFetch = await fetch(url, { method: 'GET', redirect: 'manual' });
              return { status: resFetch.status, ok: resFetch.status >= 200 && resFetch.status < 400 };
            }
          : undefined,
      });
      res.json({ ok: true, ...report });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/ops/feature-health/build-gate', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const { runCarinaFeatureHealthAudit } = await import('../feature-health/runtime.js');
      const report = await runCarinaFeatureHealthAudit({
        workspaceId: typeof req.query.workspaceId === 'string' ? req.query.workspaceId : 'platform',
      });
      res.json({
        ok: true,
        canBuildNewFeature: report.gate.allowed,
        ...report.gate,
        checkedAt: report.checkedAt,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/ops/email-deliverability/status', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const {
        deliveryHealthCheck,
        bounceAnalysis,
        generateSetupGuide,
        validateDNSRecords,
        warmUpDomain,
        emailDeliverabilityPolicy,
      } = await import('../email/deliverability/index.js');
      const { getDeliveryStore, resolveAppDomain, resolveDomainPlans } = await import(
        '../email/deliverability/runtime.js'
      );
      const appDomain = typeof req.query.domain === 'string' && req.query.domain.trim()
        ? req.query.domain.trim()
        : resolveAppDomain();
      const plans = resolveDomainPlans(appDomain);
      const dns = await validateDNSRecords(plans.transactional.sendingDomain, {
        dkimSelector: typeof req.query.dkimSelector === 'string'
          ? req.query.dkimSelector
          : 'mail',
      }).catch(async () => validateDNSRecords(appDomain));
      const until = new Date().toISOString();
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const health = deliveryHealthCheck(getDeliveryStore(), plans.transactional.sendingDomain, {
        since,
        until,
      });
      res.json({
        ok: true,
        appDomain,
        plans,
        policy: emailDeliverabilityPolicy,
        dns,
        health,
        bounces: bounceAnalysis(getDeliveryStore(), plans.transactional.sendingDomain),
        warmUp: warmUpDomain(plans.transactional.sendingDomain),
        setupGuidePreview: generateSetupGuide({
          domain: appDomain,
          transactionalDomain: plans.transactional.sendingDomain,
          marketingDomain: plans.marketing.sendingDomain,
          sendingServices: ['resend'],
          dmarcPolicy: 'none',
          rua: process.env.DMARC_RUA || undefined,
        }).slice(0, 2000),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/ops/email-deliverability/validate-dns', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const { validateDNSRecords } = await import('../email/deliverability/index.js');
      const domain = String(req.body?.domain ?? '').trim();
      if (!domain) {
        res.status(400).json({ error: 'domain required' });
        return;
      }
      const result = await validateDNSRecords(domain, {
        dkimSelector: String(req.body?.dkimSelector ?? 'mail'),
      });
      res.json({ ok: true, result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/ops/companies-house/status', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const configured = Boolean(process.env.COMPANIES_HOUSE_API_KEY?.trim());
    res.json({
      ok: true,
      configured,
      keyPresent: configured,
      baseUrl:
        process.env.COMPANIES_HOUSE_BASE_URL?.trim()
        || 'https://api.company-information.service.gov.uk',
    });
  });

  app.post('/api/ops/companies-house/grant-all', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const { pool } = await import('../memory/db.js');
      const { upsertToolGrant } = await import('../workers/aiva-parity-store.js');
      const result = await pool.query(
        `SELECT id::text AS id, workspace_id::text AS workspace_id
         FROM ai_workers
         WHERE status = 'active'
         ORDER BY created_at ASC NULLS LAST`,
      );
      let granted = 0;
      for (const row of result.rows) {
        await upsertToolGrant({
          workspaceId: String(row.workspace_id),
          workerId: String(row.id),
          toolSlug: 'companies-house',
          scopes: ['read'],
          status: 'connected',
        });
        granted += 1;
      }
      res.json({ ok: true, granted, workers: result.rows.length });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get('/api/ops/usage-gates', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await refreshBillingConfigCache();
    const { describeUsageGatePolicy } = await import('../billing/usage-gate-policy.js');
    res.json({ ok: true, policy: describeUsageGatePolicy() });
  });

  app.get('/api/public/platform-surface', async (_req: Request, res: Response) => {
    await refreshBillingConfigCache();
    res.json({
      supportEmail: resolveConfigValue('CARINA_SUPPORT_EMAIL') || process.env.CARINA_SUPPORT_EMAIL || 'support@carinaai.uk',
      supportInboxMonitor: resolveConfigValue('AIVA_SUPPORT_INBOX_MONITOR') || '',
      p0EscalationContact: resolveConfigValue('AIVA_P0_ESCALATION_CONTACT') || '',
    });
  });

  app.get('/api/ops/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'carina-ops' });
  });

  app.get('/api/ops/scout-control', (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const settings = readScoutControlSettings();
    const mode = effectiveScoutControlMode();
    res.json({
      ok: true,
      mode,
      enforcementEnabled: mode === 'enforce',
      alertMinimumSeverity: settings.alertMinimumSeverity,
      updatedAt: settings.updatedAt ?? null,
      updatedBy: settings.updatedBy ?? null,
    });
  });

  app.get('/api/ops/human-assist/bridge', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const config = await getHumanAssistBridgeConfig();
      res.json({
        enabled: config.enabled,
        misBaseUrl: config.misBaseUrl,
        bridgeTokenSet: Boolean(config.bridgeToken),
        bridgeTokenHint: bridgeTokenHint(config.bridgeToken),
        publishMode: config.publishMode,
        lastPublishAt: config.lastPublishAt,
        lastPublishOk: config.lastPublishOk,
        lastPublishError: config.lastPublishError,
        misInboxUrl: `${config.misBaseUrl.replace(/\/$/, '')}/mis/va/aiva-assist`,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/ops/human-assist/bridge', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const result = await saveHumanAssistBridgeConfig({
        enabled: req.body?.enabled === true,
        misBaseUrl: req.body?.misBaseUrl !== undefined ? String(req.body.misBaseUrl) : undefined,
        bridgeToken: req.body?.bridgeToken !== undefined ? String(req.body.bridgeToken) : undefined,
        publishMode: req.body?.publishMode !== undefined ? String(req.body.publishMode) : undefined,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error ?? 'Save failed' });
        return;
      }
      const config = await getHumanAssistBridgeConfig();
      res.json({
        enabled: config.enabled,
        misBaseUrl: config.misBaseUrl,
        bridgeTokenSet: Boolean(config.bridgeToken),
        bridgeTokenHint: bridgeTokenHint(config.bridgeToken),
        publishMode: config.publishMode,
        lastPublishAt: config.lastPublishAt,
        lastPublishOk: config.lastPublishOk,
        lastPublishError: config.lastPublishError,
        misInboxUrl: `${config.misBaseUrl.replace(/\/$/, '')}/mis/va/aiva-assist`,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.put('/api/ops/scout-control', (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const mode = parseScoutControlMode(req.body?.mode);
    if (!mode) {
      res.status(400).json({ error: 'mode must be monitor or enforce' });
      return;
    }
    const settings = writeScoutControlSettings({
      mode,
      alertMinimumSeverity: parseScoutAlertMinimumSeverity(req.body?.alertMinimumSeverity),
      updatedBy: 'ops',
    });
    res.json({
      ok: true,
      mode: effectiveScoutControlMode(),
      enforcementEnabled: effectiveScoutControlMode() === 'enforce',
      alertMinimumSeverity: settings.alertMinimumSeverity,
      updatedAt: settings.updatedAt ?? null,
      updatedBy: settings.updatedBy ?? null,
    });
  });

  app.get('/api/ops/launch-readiness', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { evaluateLaunchReadinessGate } = await import('../ops/launch-readiness-gate.js');
    const report = await evaluateLaunchReadinessGate({
      strict: req.query.strict === '1' || req.query.strict === 'true',
    });
    res.status(report.launchBlocked ? 503 : 200).json(report);
  });

  app.get('/api/ops/trust/summary', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const attestation = await queryAttestationReport();
    res.json({
      chainAttestEnabled: process.env.AIVA_CHAIN_ATTEST_ENABLED !== 'false',
      labyrinthEnabled: process.env.LABYRINTH_ENABLED === 'true',
      attestation,
    });
  });

  app.get('/api/ops/environment', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json({ environment: buildEnvironmentSummary() });
  });

  app.get('/api/ops/skill-packs', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const available = listAvailablePacks();
    const installed = await listOperatorInstalledPacks();
    const active = installed
      .filter((row) => row.status === 'installed')
      .map((row) => row.pack_name);
    const lastChange = await getLastOperatorPackAudit();
    const audit = await listRecentOperatorPackAudit(5);
    res.json({
      available,
      active,
      installed,
      lastChange,
      audit,
      source: 'persisted',
    });
  });

  app.put('/api/ops/skill-packs', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const raw = req.body?.packs;
    const packs = Array.isArray(raw)
      ? raw.map(String)
      : typeof raw === 'string'
        ? raw.split(',')
        : [];
    const actor = typeof req.body?.actor === 'string' ? req.body.actor.trim() : 'ops-admin';
    const source = typeof req.body?.source === 'string' ? req.body.source.trim() : 'ops';
    const known = new Set(listAvailablePacks().map((pack) => pack.name));
    const versions = Object.fromEntries(listAvailablePacks().map((pack) => [pack.name, pack.version]));
    const invalid = packs.map((name) => name.trim()).filter(Boolean).filter((name) => !known.has(name));
    if (invalid.length > 0) {
      res.status(400).json({
        error: 'Unknown or incompatible skill packs',
        invalid,
        available: [...known].sort(),
      });
      return;
    }
    try {
      const result = await syncOperatorActivePacks(packs, { actor, source, versions });
      res.json({
        ok: true,
        active: result.active,
        added: result.added,
        removed: result.removed,
        lastChange: await getLastOperatorPackAudit(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg || 'Failed to save skill packs' });
    }
  });

  app.get('/api/ops/web-password', (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json(getWebPasswordStatus());
  });

  app.get('/api/ops/extensions', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { listExtensions } = await import('../extensions/manager.js');
    const extensions = await listExtensions();
    res.json({
      extensions,
      runtimeEnabled: process.env.CARINA_EXTENSIONS_ENABLED === 'true',
      source: 'read-only',
    });
  });

  app.get('/api/ops/eval-reports', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { listRecentReports, loadReport } = await import('../skills/eval/report.js');
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const runId = typeof req.query.runId === 'string' ? req.query.runId : '';
    if (runId) {
      const report = await loadReport(runId);
      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }
      res.json(report);
      return;
    }
    const reports = await listRecentReports(limit);
    res.json({
      reports: reports.map((r) => ({
        runId: r.runId,
        generatedAt: r.generatedAt,
        pack: r.result.pack,
        passRate: r.result.metrics.passRate,
        summary: r.summary,
      })),
    });
  });

  app.put('/api/ops/web-password', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const confirmPassword = typeof req.body?.confirmPassword === 'string'
      ? req.body.confirmPassword
      : '';
    const actor = typeof req.body?.actor === 'string' ? req.body.actor.trim() : 'ops-admin';
    try {
      const result = await setWebPassword(password, confirmPassword, actor);
      res.json({ ok: true, ...getWebPasswordStatus(), updatedAt: result.updatedAt });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: msg });
    }
  });

  app.get('/api/ops/tenant-config/:tenantId', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { loadTenantWorkspaceConfig } = await import('../hosted/tenant-workspace-config.js');
    res.json(loadTenantWorkspaceConfig(String(req.params.tenantId)));
  });

  app.put('/api/ops/tenant-config/:tenantId', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { saveTenantWorkspaceConfig } = await import('../hosted/tenant-workspace-config.js');
    const actor = typeof req.body?.actor === 'string' ? req.body.actor.trim() : 'ops-admin';
    try {
      const config = saveTenantWorkspaceConfig(
        String(req.params.tenantId),
        {
          activeSkillPacks: Array.isArray(req.body?.activeSkillPacks) ? req.body.activeSkillPacks.map(String) : undefined,
          channels: req.body?.channels && typeof req.body.channels === 'object' ? req.body.channels : undefined,
          emailIngestionEnabled: typeof req.body?.emailIngestionEnabled === 'boolean'
            ? req.body.emailIngestionEnabled
            : undefined,
        },
        actor,
      );
      res.json({ ok: true, config });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: msg });
    }
  });

  app.post('/api/ops/provision-business', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { email, workspaceName, customDomain, sendWelcomeEmail } = req.body ?? {};
    if (!email || !workspaceName) {
      res.status(400).json({ error: 'email and workspaceName are required' });
      return;
    }
    try {
      const result = await provisionBusinessWorkspace({
        email: String(email).trim(),
        workspaceName: String(workspaceName).trim(),
        customDomain: customDomain ? String(customDomain).trim() : undefined,
        sendWelcomeEmail: sendWelcomeEmail === 'true' || sendWelcomeEmail === true,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Provisioning failed';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/ops/channel-shield', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const { shieldAdaptersHealth } = await import('../channel-shield/adapters/registry.js');
      const { pool } = await import('../memory/db.js');
      const adapters = await shieldAdaptersHealth();
      const byChannel = await pool.query(
        `SELECT channel,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE quarantine_status = 'held')::int AS held,
                COUNT(*) FILTER (WHERE verdict = 'malicious')::int AS malicious
         FROM channel_shield_messages
         GROUP BY channel
         ORDER BY channel`,
      ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
      const depth = await pool.query(
        `SELECT COUNT(*)::int AS n FROM channel_shield_messages WHERE quarantine_status = 'held'`,
      ).catch(() => ({ rows: [{ n: 0 }] }));
      res.json({
        ok: true,
        adapters,
        byChannel: byChannel.rows,
        quarantineDepth: Number(depth.rows[0]?.n ?? 0),
        sandboxConfigured: Boolean(process.env.WARDEN_SANDBOX_URL || process.env.SCOUT_WARDEN_URL),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });
}
