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
import {
  getGoogleOAuthPlatformStatus,
  saveGoogleOAuthPlatformCredentials,
} from '../ops/google-oauth-platform.js';

export function mountOpsRoutes(app: Express): void {
  mountObservabilityRoutes(app);

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
