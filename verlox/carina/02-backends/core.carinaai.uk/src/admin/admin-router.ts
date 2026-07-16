import { Router, type Response, type Router as ExpressRouter } from 'express';
import { pool } from '../memory/db.js';
import { maskIdentifier } from '../channels/mask-identifier.js';
import {
  ensureBootstrapOperator,
  getOperatorByEmail,
  requireAdmin,
  requireSetupToken,
  verifyPassword,
  type AdminRequest,
} from './admin-auth.js';
import {
  beginTotpSetup,
  completeTotpSetup,
  issueAdminSessionToken,
  signPendingToken,
  verifyLoginTotp,
  verifyPendingToken,
} from './admin-totp.js';
import { writeAdminAudit } from './admin-audit.js';
import { createChannelMemoryAdminRouter } from './channel-memory-routes.js';
import { sendVaReply, clearVaOverride } from './va-reply.js';
import { pauseWorker, resumeWorker, resolveEscalation } from '../workers/worker-store.js';
import type { ActivityEntry } from '../types/index.js';
import { updateAivaAgentStatus, attestActivity } from '../workers/scout-fleet.js';
import {
  queryAttestationReport,
  queryFleetDetail,
  queryFleetList,
  queryScoutSignals,
  queryUnattestedRecords,
} from './admin-fleet-queries.js';
import {
  issueRevenueRefund,
  queryRevenueAtRisk,
  queryRevenueInvoices,
  queryRevenueSummary,
  queryRevenueTimeline,
  queryTierBreakdown,
} from './admin-revenue-queries.js';
import {
  assignEscalation,
  markFirstResponse,
  queryVaSla,
  queryVaTeam,
} from './admin-va-queries.js';
import { provisionAivaVaMember } from './aiva-va-provision.js';
import {
  addWorkspaceCredit,
  extendWorkspaceTrial,
  forceWorkspacePlan,
  pauseAllWorkspaceAivas,
  queryWorkspaceActivity,
  queryWorkspaceDetail,
  queryWorkspaceList,
  resumeAllWorkspaceAivas,
  saveWorkspaceNotes,
} from './admin-workspace-queries.js';
import {
  getAivaWalletBalance,
  listAivaWalletLedger,
  creditAivaWalletPurchase,
} from '../billing/aiva-ai-wallet.js';
import {
  getWorkspaceLimitStatus,
  listWorkspaceActorUsage,
  setActorLimits,
  buildActorId,
  getActorUsage,
} from '../usage/aiva-agent-limits.js';
import { provisionBusinessWorkspace } from './business-provisioning.js';
import { eraseWorkspaceData, purgeWorkspaceImmediately, isLikelyTestWorkspace } from '../workers/workspace-gdpr.js';
import {
  auditLogToCsv,
  queryAuditLog,
  queryAuditLogAdmins,
} from './admin-audit-queries.js';
import { requireOpsAuth } from '../ops/ops-auth.js';

export const adminRouter: ExpressRouter = Router();

adminRouter.get('/auth/check', requireSetupToken, async (req: AdminRequest, res: Response) => {
  await ensureBootstrapOperator();
  const email = String(req.query.email ?? '').toLowerCase().trim();
  if (!email) {
    res.status(400).json({ error: 'email is required' });
    return;
  }
  const operator = await getOperatorByEmail(email);
  if (!operator) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({
    userId: operator.id,
    email: operator.email,
    isAdmin: true,
    totpEnabled: Boolean((await pool.query(
      'SELECT totp_enabled FROM admin_operators WHERE id = $1',
      [operator.id],
    )).rows[0]?.totp_enabled),
  });
});

adminRouter.post('/auth/login', async (req, res: Response) => {
  const email = String(req.body?.email ?? '').toLowerCase().trim();
  const password = String(req.body?.password ?? '');
  const totpCode = String(req.body?.totpCode ?? '').trim();
  if (!email || !password) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const operator = await getOperatorByEmail(email);
  if (!operator || !verifyPassword(password, operator.passwordHash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const totpRow = await pool.query(
    'SELECT totp_enabled FROM admin_operators WHERE id = $1',
    [operator.id],
  );
  const totpEnabled = Boolean(totpRow.rows[0]?.totp_enabled);

  if (!totpEnabled) {
    const setup = await beginTotpSetup(operator.id, operator.email);
    res.json({
      step: 'totp_setup',
      pendingToken: setup.pendingToken,
      otpauthUrl: setup.otpauthUrl,
      email: operator.email,
    });
    return;
  }

  if (!totpCode) {
    res.json({
      step: 'totp_verify',
      pendingToken: signPendingToken({
        operatorId: operator.id,
        email: operator.email,
        purpose: 'verify',
      }),
      email: operator.email,
    });
    return;
  }

  if (!await verifyLoginTotp(operator.id, totpCode)) {
    res.status(401).json({ error: 'Invalid authentication code' });
    return;
  }

  res.json({
    step: 'complete',
    adminToken: issueAdminSessionToken(operator.id, operator.email),
    email: operator.email,
    userId: operator.id,
  });
});

adminRouter.post('/auth/totp/setup/verify', async (req, res: Response) => {
  const pendingToken = String(req.body?.pendingToken ?? '');
  const code = String(req.body?.code ?? '').trim();
  const pending = verifyPendingToken(pendingToken);
  if (!pending || pending.purpose !== 'setup') {
    res.status(401).json({ error: 'Session expired. Sign in again.' });
    return;
  }
  if (!await completeTotpSetup(pending.operatorId, pending.email, code)) {
    res.status(401).json({ error: 'Invalid authentication code' });
    return;
  }
  res.json({
    step: 'complete',
    adminToken: issueAdminSessionToken(pending.operatorId, pending.email),
    email: pending.email,
    userId: pending.operatorId,
  });
});

adminRouter.post('/auth/totp/verify', async (req, res: Response) => {
  const pendingToken = String(req.body?.pendingToken ?? '');
  const code = String(req.body?.code ?? '').trim();
  const pending = verifyPendingToken(pendingToken);
  if (!pending || pending.purpose !== 'verify') {
    res.status(401).json({ error: 'Session expired. Sign in again.' });
    return;
  }
  if (!await verifyLoginTotp(pending.operatorId, code)) {
    res.status(401).json({ error: 'Invalid authentication code' });
    return;
  }
  res.json({
    step: 'complete',
    adminToken: issueAdminSessionToken(pending.operatorId, pending.email),
    email: pending.email,
    userId: pending.operatorId,
  });
});

adminRouter.post('/auth/google', requireOpsAuth, async (req, res: Response) => {
  const email = String((req.body as { email?: string } | undefined)?.email ?? '').toLowerCase().trim();
  if (!email) {
    res.status(400).json({ error: 'email is required' });
    return;
  }

  const operator = await getOperatorByEmail(email);
  if (!operator) {
    res.status(404).json({ error: 'No business admin account for this email' });
    return;
  }

  res.json({
    step: 'complete',
    adminToken: issueAdminSessionToken(operator.id, operator.email),
    email: operator.email,
    userId: operator.id,
  });
});

/** Server-to-server: MIS / ops enroll a human VA into the Aiva escalation team. */
adminRouter.post('/va/provision', requireOpsAuth, async (req, res: Response) => {
  try {
    const body = (req.body ?? {}) as {
      name?: string;
      email?: string;
      maxLoad?: number;
      verloxVaAssistantId?: string | number;
      source?: 'manual' | 'verlox_mis' | 'migration';
      available?: boolean;
    };
    const result = await provisionAivaVaMember({
      name: String(body.name ?? ''),
      email: String(body.email ?? ''),
      maxLoad: body.maxLoad,
      verloxVaAssistantId: body.verloxVaAssistantId,
      source: body.source ?? 'verlox_mis',
      available: body.available,
    });
    try {
      const op = await pool.query(
        `SELECT id FROM admin_operators ORDER BY created_at ASC NULLS LAST LIMIT 1`,
      );
      const operatorId = op.rows[0]?.id ? String(op.rows[0].id) : null;
      if (operatorId) {
        await writeAdminAudit({
          adminUserId: operatorId,
          action: 'va_team_provision',
          targetType: 'va_member',
          targetId: result.id,
          metadata: {
            email: result.email,
            source: result.source,
            created: result.created,
            verloxVaAssistantId: result.verloxVaAssistantId,
            via: 'ops',
          },
          ipAddress: req.ip,
        });
      }
    } catch {
      // Audit is best-effort; provision already succeeded.
    }
    res.status(result.created ? 201 : 200).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

/** Server-to-server: sync app vault BYOK keys so Aiva workers can use them. */
adminRouter.post('/workspaces/:id/byok-keys', requireOpsAuth, async (req, res: Response) => {
  const workspaceId = String(req.params.id);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const provider = String(body.provider ?? '').trim().toLowerCase();
  const apiKey = String(body.apiKey ?? '').trim();
  const baseUrl = body.baseUrl ? String(body.baseUrl).trim() : undefined;
  const model = body.model ? String(body.model).trim() : undefined;
  if (!provider || !apiKey) {
    res.status(400).json({ error: 'provider and apiKey required' });
    return;
  }
  try {
    const { setTenantProviderKey } = await import('../brain/tenant-provider-keys.js');
    await setTenantProviderKey(workspaceId, provider, apiKey, baseUrl, model);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
});

adminRouter.use(async (_req, _res, next) => {
  await ensureBootstrapOperator();
  next();
});

adminRouter.use(requireAdmin);
adminRouter.use(createChannelMemoryAdminRouter());

adminRouter.get('/workspaces', async (req: AdminRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
    const result = await queryWorkspaceList({
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      plan: typeof req.query.plan === 'string' ? req.query.plan : 'all',
      status: typeof req.query.status === 'string' ? req.query.status : 'all',
      sort: typeof req.query.sort === 'string' ? req.query.sort : 'created_at_desc',
      page,
      limit,
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  } catch (err) {
    console.error('[admin] workspaces list failed:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load workspaces' });
  }
});

adminRouter.post('/provision-business', async (req: AdminRequest, res: Response) => {
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
    await writeAdminAudit({
      adminUserId: req.adminUser!.operatorId,
      action: 'provision_business',
      targetType: 'workspace',
      targetId: result.workspaceId,
      metadata: {
        email: String(email).trim(),
        customDomain: customDomain ? String(customDomain).trim() : null,
        sendWelcomeEmail: sendWelcomeEmail === 'true' || sendWelcomeEmail === true,
      },
      ipAddress: req.ip,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provisioning failed';
    res.status(500).json({ error: message });
  }
});

adminRouter.get('/workspaces/:id', async (req: AdminRequest, res: Response) => {
  const workspaceId = String(req.params.id);
  try {
    const detail = await queryWorkspaceDetail(workspaceId);
    if (!detail) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(detail);
  } catch (err) {
    console.error('[admin] workspace detail failed:', workspaceId, err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load workspace' });
  }
});

adminRouter.patch('/workspaces/:id/trial', async (req: AdminRequest, res: Response) => {
  const workspaceId = String(req.params.id);
  const extendByDays = Number(req.body?.extendByDays ?? 0);
  if (!Number.isFinite(extendByDays) || extendByDays < 1 || extendByDays > 90) {
    res.status(400).json({ error: 'extendByDays must be between 1 and 90' });
    return;
  }
  try {
    const result = await extendWorkspaceTrial(workspaceId, extendByDays);
    await writeAdminAudit({
      adminUserId: req.adminUser!.operatorId,
      action: 'extend_trial',
      targetType: 'workspace',
      targetId: workspaceId,
      metadata: { extendByDays: result.extendByDays, newTrialEndsAt: result.trialEndsAt },
      ipAddress: req.ip,
    });
    res.json({ trialEndsAt: result.trialEndsAt });
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
});

adminRouter.patch('/workspaces/:id/plan', async (req: AdminRequest, res: Response) => {
  const workspaceId = String(req.params.id);
  const planTier = String(req.body?.planTier ?? '').trim();
  const reason = String(req.body?.reason ?? '').trim();
  if (!reason) {
    res.status(400).json({ error: 'reason is required' });
    return;
  }
  const allowed = ['trial', 'starter', 'team', 'business', 'suspended'];
  if (!allowed.includes(planTier)) {
    res.status(400).json({ error: 'Invalid plan tier' });
    return;
  }
  try {
    const result = await forceWorkspacePlan(workspaceId, planTier, reason);
    await writeAdminAudit({
      adminUserId: req.adminUser!.operatorId,
      action: 'force_plan_change',
      targetType: 'workspace',
      targetId: workspaceId,
      metadata: {
        previousTier: result.previousTier,
        newTier: result.planTier,
        reason,
        status: result.status,
      },
      ipAddress: req.ip,
    });
    res.json({ planTier: result.planTier, status: result.status });
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
});

adminRouter.post('/workspaces/:id/pause', async (req: AdminRequest, res: Response) => {
  const workspaceId = String(req.params.id);
  const workersPaused = await pauseAllWorkspaceAivas(workspaceId);
  await writeAdminAudit({
    adminUserId: req.adminUser!.operatorId,
    action: 'pause_workspace_aivas',
    targetType: 'workspace',
    targetId: workspaceId,
    metadata: { workersPaused },
    ipAddress: req.ip,
  });
  res.json({ workersPaused });
});

adminRouter.post('/workspaces/:id/resume', async (req: AdminRequest, res: Response) => {
  const workspaceId = String(req.params.id);
  try {
    const workersResumed = await resumeAllWorkspaceAivas(workspaceId);
    await writeAdminAudit({
      adminUserId: req.adminUser!.operatorId,
      action: 'resume_workspace_aivas',
      targetType: 'workspace',
      targetId: workspaceId,
      metadata: { workersResumed },
      ipAddress: req.ip,
    });
    res.json({ workersResumed });
  } catch (err) {
    const code = (err as Error & { code?: string }).code;
    if (code === 'workspace_suspended') {
      res.status(409).json({ error: 'workspace_suspended' });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
});

adminRouter.get('/workspaces/:id/usage-limits', async (req: AdminRequest, res: Response) => {
  const workspaceId = String(req.params.id);
  const period = String(req.query.period ?? 'day') === 'month' ? 'month' : 'day';
  try {
    const detail = await queryWorkspaceDetail(workspaceId);
    const planTier = String(
      (detail as { subscription?: { planTier?: string } } | null)?.subscription?.planTier ?? 'trial',
    );
    const [status, actors] = await Promise.all([
      getWorkspaceLimitStatus(workspaceId, planTier),
      listWorkspaceActorUsage(workspaceId, period),
    ]);
    res.json({ workspaceId, planTier, period, status, actors });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
});

adminRouter.put('/workspaces/:id/usage-limits', async (req: AdminRequest, res: Response) => {
  const workspaceId = String(req.params.id);
  const actorKind = String(req.body?.actorKind ?? 'workspace').trim();
  const actorKey = String(req.body?.actorKey ?? workspaceId).trim();
  if (!['workspace', 'assistant', 'token', 'channel'].includes(actorKind)) {
    res.status(400).json({ error: 'actorKind must be workspace|assistant|token|channel' });
    return;
  }
  try {
    const actorId = buildActorId(
      actorKind as 'workspace' | 'assistant' | 'token' | 'channel',
      actorKey,
    );
    const limits = await setActorLimits(workspaceId, actorId, req.body?.limits ?? null, {
      adminUserId: req.adminUser!.operatorId,
      ipAddress: req.ip,
    });
    const usage = await getActorUsage(workspaceId, actorId, limits?.period ?? 'month');
    res.json({ ok: true, actorId, limits, usage });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid limits' });
  }
});

adminRouter.get('/workspaces/:id/ai-wallet', async (req: AdminRequest, res: Response) => {
  const workspaceId = String(req.params.id);
  try {
    const [balance, ledger] = await Promise.all([
      getAivaWalletBalance(workspaceId),
      listAivaWalletLedger(workspaceId, 100),
    ]);
    const debitCount = ledger.filter((row) => row.eventType === 'debit').length;
    res.json({
      workspaceId,
      balance,
      ledger,
      abuseSignals: {
        debitEvents: debitCount,
        exhausted: balance.exhausted,
        lowCredit: balance.lowCredit,
        highBurn:
          balance.trialGrantedPence > 0
          && balance.debitedPence >= balance.trialGrantedPence,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
});

adminRouter.post('/workspaces/:id/ai-wallet/credit', async (req: AdminRequest, res: Response) => {
  const workspaceId = String(req.params.id);
  const amountPence = Number(req.body?.amountPence ?? req.body?.amount ?? 0);
  const note = String(req.body?.note ?? '').trim();
  if (!Number.isFinite(amountPence) || amountPence < 1) {
    res.status(400).json({ error: 'amountPence must be a positive number' });
    return;
  }
  if (!note) {
    res.status(400).json({ error: 'note is required' });
    return;
  }
  try {
    const sessionId = `admin:${req.adminUser!.operatorId}:${Date.now()}`;
    await creditAivaWalletPurchase({
      workspaceId,
      amountPence,
      stripeSessionId: sessionId,
      note: `admin:${note}`,
    });
    await writeAdminAudit({
      adminUserId: req.adminUser!.operatorId,
      action: 'add_ai_wallet_credit',
      targetType: 'workspace',
      targetId: workspaceId,
      metadata: { amountPence, note },
      ipAddress: req.ip,
    });
    const balance = await getAivaWalletBalance(workspaceId);
    res.json({ ok: true, balance });
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : 'Credit failed' });
  }
});

adminRouter.post('/workspaces/:id/credit', async (req: AdminRequest, res: Response) => {
  const workspaceId = String(req.params.id);
  const amount = Number(req.body?.amount ?? 0);
  const note = String(req.body?.note ?? '').trim();
  if (!Number.isFinite(amount) || amount < 1) {
    res.status(400).json({ error: 'amount must be a positive number (pence)' });
    return;
  }
  if (!note) {
    res.status(400).json({ error: 'note is required' });
    return;
  }
  try {
    const result = await addWorkspaceCredit(workspaceId, amount, note);
    await writeAdminAudit({
      adminUserId: req.adminUser!.operatorId,
      action: 'add_credit',
      targetType: 'workspace',
      targetId: workspaceId,
      metadata: { amount: result.amount, note, stripeCreditNoteId: result.creditNoteId },
      ipAddress: req.ip,
    });
    res.json(result);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : 'Credit failed' });
  }
});

adminRouter.post('/workspaces/:id/erase', async (req: AdminRequest, res: Response) => {
  const workspaceId = String(req.params.id);
  const confirm = String(req.body?.confirm ?? '').trim();
  const detail = await queryWorkspaceDetail(workspaceId);
  if (!detail) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  const workspaceName = detail.workspace.name;
  if (!confirm || (confirm !== workspaceId && confirm !== workspaceName)) {
    res.status(400).json({ error: 'confirm must match workspace name or id' });
    return;
  }
  try {
    await eraseWorkspaceData(workspaceId);
    await writeAdminAudit({
      adminUserId: req.adminUser!.operatorId,
      action: 'gdpr_erasure',
      targetType: 'workspace',
      targetId: workspaceId,
      metadata: {},
      ipAddress: req.ip,
    });
    res.json({ erased: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erasure failed' });
  }
});

adminRouter.post('/workspaces/:id/purge', async (req: AdminRequest, res: Response) => {
  const workspaceId = String(req.params.id);
  const confirmId = String(req.body?.confirmId ?? '').trim();
  const acknowledge = String(req.body?.acknowledge ?? '').trim().toUpperCase();
  const force = req.body?.force === true || req.body?.force === 'true';

  if (confirmId !== workspaceId) {
    res.status(400).json({ error: 'confirmId must match the workspace id exactly' });
    return;
  }
  if (acknowledge !== 'PURGE') {
    res.status(400).json({ error: 'acknowledge must be PURGE' });
    return;
  }

  const detail = await queryWorkspaceDetail(workspaceId);
  if (!detail) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const ownerEmail = detail.workspace.ownerEmail;
  const isTest = isLikelyTestWorkspace(ownerEmail);
  const isActivePaid =
    detail.subscription.status === 'active' &&
    Number(detail.subscription.monthlyAmountPence ?? 0) > 0;

  if (isActivePaid && !isTest && !force) {
    res.status(409).json({
      error: 'active_paid_workspace',
      message:
        'This workspace has active paid billing. Suspend it first or resubmit with force=true after review.',
    });
    return;
  }

  try {
    await purgeWorkspaceImmediately(workspaceId, { skipDeletedEmail: isTest });
    await writeAdminAudit({
      adminUserId: req.adminUser!.operatorId,
      action: 'workspace_purge',
      targetType: 'workspace',
      targetId: workspaceId,
      metadata: {
        ownerEmail: ownerEmail ?? null,
        isTest,
        forced: force,
      },
      ipAddress: req.ip,
    });
    res.json({ purged: true, workspaceId });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Purge failed' });
  }
});

adminRouter.get('/workspaces/:id/activity', async (req: AdminRequest, res: Response) => {
  const workspaceId = String(req.params.id);
  const limit = Math.min(50, parseInt(String(req.query.limit ?? '20'), 10) || 20);
  const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
  const rows = await queryWorkspaceActivity(workspaceId, limit, offset);
  res.json({ activity: rows, limit, offset });
});

adminRouter.patch('/workspaces/:id/notes', async (req: AdminRequest, res: Response) => {
  const workspaceId = String(req.params.id);
  const notes = String(req.body?.notes ?? '');
  await saveWorkspaceNotes(workspaceId, notes);
  res.json({ saved: true });
});

adminRouter.get('/va/queue', async (req: AdminRequest, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'open';
  const limit = Math.min(100, parseInt(String(req.query.limit ?? '50'), 10) || 50);

  let statusFilter = `e.status IN ('open', 'in_progress')`;
  if (status === 'resolved') statusFilter = `e.status = 'resolved'`;
  else if (status === 'all') statusFilter = '1=1';

  const result = await pool.query(
    `SELECT e.*, w.name AS worker_name, c.owner_email, c.owner_name,
            vm.name AS assignee_name,
            EXTRACT(EPOCH FROM (NOW() - e.created_at)) / 60 AS minutes_waiting
     FROM ai_worker_escalations e
     JOIN ai_workers w ON w.id = e.worker_id
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = e.workspace_id
     LEFT JOIN va_team_members vm ON vm.id::text = e.assigned_to
     WHERE ${statusFilter}
     ORDER BY
       CASE e.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
       e.created_at ASC
     LIMIT $1`,
    [limit],
  );

  const counts = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'open' AND assigned_to IS NULL)::int AS unassigned,
       COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
       COUNT(*) FILTER (WHERE status = 'resolved' AND resolved_at >= CURRENT_DATE)::int AS resolved_today,
       COUNT(*) FILTER (WHERE status != 'resolved' AND priority = 'urgent')::int AS urgent,
       COUNT(*) FILTER (WHERE status != 'resolved' AND (
         (first_response_at IS NULL AND sla_first_response_target IS NOT NULL AND sla_first_response_target < NOW())
         OR (resolved_at IS NULL AND sla_resolution_target IS NOT NULL AND sla_resolution_target < NOW())
       ))::int AS sla_breached
     FROM ai_worker_escalations`,
  );

  res.json({
    escalations: result.rows.map((row) => ({
      id: String(row.id),
      workerId: String(row.worker_id),
      workerName: String(row.worker_name),
      workspaceId: String(row.workspace_id),
      workspaceName: String(
        row.owner_name || row.owner_email || row.workspace_id,
      ).slice(0, 48),
      ownerEmail: row.owner_email ? String(row.owner_email) : null,
      status: String(row.status),
      priority: String(row.priority ?? 'normal'),
      reason: String(row.original_input ?? '').slice(0, 200),
      assignedTo: row.assigned_to
        ? {
            id: String(row.assigned_to),
            name: String(row.assignee_name || row.assigned_to),
          }
        : null,
      slaFirstResponseTarget: row.sla_first_response_target
        ? new Date(String(row.sla_first_response_target)).toISOString()
        : null,
      firstResponseAt: row.first_response_at
        ? new Date(String(row.first_response_at)).toISOString()
        : null,
      resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)).toISOString() : null,
      slaBreached: Boolean(
        (!row.first_response_at &&
          row.sla_first_response_target &&
          new Date(String(row.sla_first_response_target)) < new Date()) ||
          (!row.resolved_at &&
            row.sla_resolution_target &&
            new Date(String(row.sla_resolution_target)) < new Date()),
      ),
      minutesWaiting: Math.round(Number(row.minutes_waiting ?? 0)),
      createdAt: new Date(String(row.created_at)).toISOString(),
      channel: {
        type: String(row.channel),
        identifier: maskIdentifier(String(row.channel), String(row.channel_id)),
        displayLabel: `${row.channel}: ${maskIdentifier(String(row.channel), String(row.channel_id))}`,
      },
    })),
    counts: {
      unassigned: Number(counts.rows[0]?.unassigned ?? 0),
      in_progress: Number(counts.rows[0]?.in_progress ?? 0),
      resolved_today: Number(counts.rows[0]?.resolved_today ?? 0),
      urgent: Number(counts.rows[0]?.urgent ?? 0),
      sla_breached: Number(counts.rows[0]?.sla_breached ?? 0),
    },
  });
});

adminRouter.get('/va/queue/:id', async (req: AdminRequest, res: Response) => {
  const id = String(req.params.id);
  const result = await pool.query(
    `SELECT e.*, w.name AS worker_name, w.role_description, c.owner_email, c.owner_name,
            s.plan_tier, vm.name AS assignee_name
     FROM ai_worker_escalations e
     JOIN ai_workers w ON w.id = e.worker_id
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = e.workspace_id
     LEFT JOIN aiva_subscriptions s ON s.workspace_id = e.workspace_id
     LEFT JOIN va_team_members vm ON vm.id::text = e.assigned_to
     WHERE e.id = $1`,
    [id],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const workerId = String(row.worker_id);
  const signals = await pool.query(
    `SELECT id, event_type, severity, summary, created_at
     FROM scout_signal_cache
     WHERE agent_id = $1 AND created_at > NOW() - INTERVAL '1 hour'
     ORDER BY created_at DESC
     LIMIT 10`,
    [workerId],
  );

  const context = Array.isArray(row.conversation_context)
    ? row.conversation_context
    : typeof row.conversation_context === 'string'
      ? JSON.parse(row.conversation_context)
      : [];

  res.json({
    id: String(row.id),
    workerId: String(row.worker_id),
    workerName: String(row.worker_name),
    workerRole: String(row.role_description ?? ''),
    workspaceId: String(row.workspace_id),
    workspaceName: String(row.owner_name || row.owner_email || row.workspace_id).slice(0, 48),
    workspaceOwnerEmail: row.owner_email ? String(row.owner_email) : null,
    workspacePlanTier: row.plan_tier ? String(row.plan_tier) : 'trial',
    status: String(row.status),
    priority: String(row.priority ?? 'normal'),
    reason: String(row.original_input ?? ''),
    assignedTo: row.assigned_to
      ? {
          id: String(row.assigned_to),
          name: String(row.assignee_name || row.assigned_to),
        }
      : null,
    conversationContext: context,
    scoutSignals: signals.rows.map((sig) => ({
      id: String(sig.id),
      eventType: String(sig.event_type),
      severity: String(sig.severity),
      summary: String(sig.summary),
      createdAt: new Date(String(sig.created_at)).toISOString(),
    })),
    slaBreached: Boolean(
      (!row.first_response_at &&
        row.sla_first_response_target &&
        new Date(String(row.sla_first_response_target)) < new Date()) ||
        (!row.resolved_at &&
          row.sla_resolution_target &&
          new Date(String(row.sla_resolution_target)) < new Date()),
    ),
    minutesWaiting: Math.round(
      (Date.now() - new Date(String(row.created_at)).getTime()) / 60_000,
    ),
    slaFirstResponseTarget: row.sla_first_response_target
      ? new Date(String(row.sla_first_response_target)).toISOString()
      : null,
    slaResolutionTarget: row.sla_resolution_target
      ? new Date(String(row.sla_resolution_target)).toISOString()
      : null,
    firstResponseAt: row.first_response_at
      ? new Date(String(row.first_response_at)).toISOString()
      : null,
    resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)).toISOString() : null,
    channel: {
      type: String(row.channel),
      identifier: maskIdentifier(String(row.channel), String(row.channel_id)),
      displayLabel: `${row.channel}: ${maskIdentifier(String(row.channel), String(row.channel_id))}`,
    },
    workerChannels: [{ channel: String(row.channel), identifier: String(row.channel_id) }],
  });
});

adminRouter.post('/va/queue/:id/reply', async (req: AdminRequest, res: Response) => {
  const id = String(req.params.id);
  const message = String(req.body?.message ?? '').trim();
  const handBackToAiva = Boolean(req.body?.handBackToAiva);
  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  try {
    const result = await sendVaReply({ escalationId: id, message, handBackToAiva });
    await writeAdminAudit({
      adminUserId: req.adminUser!.operatorId,
      action: 'va_reply',
      targetType: 'escalation',
      targetId: id,
      metadata: {
        channel: result.channel,
        messagePreview: message.slice(0, 100),
        handBackToAiva,
      },
      ipAddress: req.ip,
    });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

adminRouter.patch('/va/queue/:id/resolve', async (req: AdminRequest, res: Response) => {
  const id = String(req.params.id);
  const note = String(req.body?.resolutionNote ?? '').trim();
  if (note.length < 10) {
    res.status(400).json({ error: 'resolutionNote must be at least 10 characters' });
    return;
  }
  const existing = await pool.query(
    `SELECT assigned_to, worker_id, workspace_id, channel, channel_id, original_input
     FROM ai_worker_escalations WHERE id = $1`,
    [id],
  );
  const row = existing.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const workerId = String(row.worker_id);
  const channel = String(row.channel);
  const channelId = String(row.channel_id);

  await resolveEscalation(id, note);
  await clearVaOverride(workerId, channelId, channel);
  await writeAdminAudit({
    adminUserId: req.adminUser!.operatorId,
    action: 'va_resolve',
    targetType: 'escalation',
    targetId: id,
    metadata: { resolutionNote: note },
    ipAddress: req.ip,
  });
  res.json({ resolved: true });
});

adminRouter.get('/fleet', async (req: AdminRequest, res: Response) => {
  const data = await queryFleetList({
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : 'all',
    hasRecentSignals: req.query.hasRecentSignals === 'true',
    sort: typeof req.query.sort === 'string' ? req.query.sort : undefined,
    page: parseInt(String(req.query.page ?? '1'), 10) || 1,
    limit: parseInt(String(req.query.limit ?? '100'), 10) || 100,
  });
  res.json(data);
});

adminRouter.get('/fleet/:id', async (req: AdminRequest, res: Response) => {
  const detail = await queryFleetDetail(String(req.params.id));
  if (!detail) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(detail);
});

adminRouter.post('/fleet/:id/pause', async (req: AdminRequest, res: Response) => {
  const workerId = String(req.params.id);
  const reason = String(req.body?.reason ?? '').trim();
  if (reason.length < 3) {
    res.status(400).json({ error: 'reason is required (min 3 characters)' });
    return;
  }
  const row = await pool.query(
    `SELECT w.id, w.name, w.status, w.workspace_id, c.owner_name, c.owner_email
     FROM ai_workers w
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = w.workspace_id
     WHERE w.id = $1 AND w.status != 'dismissed'`,
    [workerId],
  );
  if (row.rows.length === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const worker = row.rows[0] as Record<string, unknown>;
  const workspaceId = String(worker.workspace_id);
  const previousStatus = String(worker.status);
  await pauseWorker(workspaceId, workerId);
  await updateAivaAgentStatus(workerId, 'paused');
  const workspaceName = String(worker.owner_name || worker.owner_email || workspaceId).slice(0, 48);
  await writeAdminAudit({
    adminUserId: req.adminUser!.operatorId,
    action: 'kill_switch_pause',
    targetType: 'aiva',
    targetId: workerId,
    metadata: {
      reason,
      workspaceName,
      workerName: String(worker.name),
      previousStatus,
    },
    ipAddress: req.ip,
  });
  res.json({
    paused: true,
    workerId,
    workerName: String(worker.name),
    workspaceName,
  });
});

adminRouter.post('/fleet/:id/resume', async (req: AdminRequest, res: Response) => {
  const workerId = String(req.params.id);
  const reason = String(req.body?.reason ?? '').trim();
  const row = await pool.query(
    `SELECT w.workspace_id, w.name, s.status AS sub_status, c.owner_name, c.owner_email
     FROM ai_workers w
     LEFT JOIN aiva_subscriptions s ON s.workspace_id = w.workspace_id
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = w.workspace_id
     WHERE w.id = $1 AND w.status != 'dismissed'`,
    [workerId],
  );
  if (row.rows.length === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const worker = row.rows[0] as Record<string, unknown>;
  if (String(worker.sub_status) === 'suspended') {
    res.status(409).json({
      error: 'workspace_suspended',
      message: 'Resolve workspace billing before resuming this Aiva.',
    });
    return;
  }
  const workspaceId = String(worker.workspace_id);
  await resumeWorker(workspaceId, workerId);
  await updateAivaAgentStatus(workerId, 'active');
  const workspaceName = String(worker.owner_name || worker.owner_email || workspaceId).slice(0, 48);
  await writeAdminAudit({
    adminUserId: req.adminUser!.operatorId,
    action: 'kill_switch_resume',
    targetType: 'aiva',
    targetId: workerId,
    metadata: { reason, workerName: String(worker.name), workspaceName },
    ipAddress: req.ip,
  });
  res.json({ resumed: true, workerId, workerName: String(worker.name), workspaceName });
});

adminRouter.get('/scout/signals', async (req: AdminRequest, res: Response) => {
  const data = await queryScoutSignals({
    severity: typeof req.query.severity === 'string' ? req.query.severity : undefined,
    eventType: typeof req.query.eventType === 'string' ? req.query.eventType : undefined,
    agentId: typeof req.query.agentId === 'string' ? req.query.agentId : undefined,
    workspaceId: typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined,
    since: typeof req.query.since === 'string' ? req.query.since : undefined,
    until: typeof req.query.until === 'string' ? req.query.until : undefined,
    page: parseInt(String(req.query.page ?? '1'), 10) || 1,
    limit: parseInt(String(req.query.limit ?? '50'), 10) || 50,
  });
  res.json(data);
});

adminRouter.get('/scout/signals/stream', async (req: AdminRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let lastId = '';
  const initial = await queryScoutSignals({ limit: 20, page: 1 });
  for (const sig of [...initial.signals].reverse()) {
    res.write(`data: ${JSON.stringify(sig)}\n\n`);
    lastId = sig.id;
  }

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30_000);

  const poll = setInterval(async () => {
    try {
      const newer = await pool.query(
        `SELECT s.id, s.agent_id, s.event_type, s.severity, s.summary, s.created_at,
                w.name AS agent_name, w.workspace_id, c.owner_email, c.owner_name
         FROM scout_signal_cache s
         JOIN ai_workers w ON w.id = s.agent_id
         LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = w.workspace_id
         WHERE ($1 = '' OR s.id::text > $1)
         ORDER BY s.created_at ASC
         LIMIT 20`,
        [lastId],
      );
      for (const row of newer.rows) {
        const sig = {
          id: String(row.id),
          agentId: String(row.agent_id),
          agentName: String(row.agent_name),
          workspaceId: String(row.workspace_id),
          workspaceName: String(row.owner_name || row.owner_email || row.workspace_id).slice(0, 48),
          eventType: String(row.event_type),
          severity: String(row.severity),
          summary: String(row.summary),
          createdAt: new Date(String(row.created_at)).toISOString(),
        };
        lastId = sig.id;
        res.write(`data: ${JSON.stringify(sig)}\n\n`);
      }
    } catch {
      // ignore poll errors
    }
  }, 5_000);

  req.on('close', () => {
    clearInterval(poll);
    clearInterval(heartbeat);
  });
});

adminRouter.get('/attestation/report', async (_req: AdminRequest, res: Response) => {
  res.json(await queryAttestationReport());
});

adminRouter.get('/attestation/unattested', async (req: AdminRequest, res: Response) => {
  const records = await queryUnattestedRecords({
    page: parseInt(String(req.query.page ?? '1'), 10) || 1,
    limit: parseInt(String(req.query.limit ?? '50'), 10) || 50,
    workerId: typeof req.query.workerId === 'string' ? req.query.workerId : undefined,
  });
  res.json({ records });
});

adminRouter.post('/attestation/retry/:id', async (req: AdminRequest, res: Response) => {
  const activityId = String(req.params.id);
  const result = await pool.query('SELECT * FROM ai_worker_activity WHERE id = $1', [activityId]);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const activity: ActivityEntry = {
    id: String(row.id),
    workerId: String(row.worker_id),
    actionType: String(row.action_type) as ActivityEntry['actionType'],
    summary: String(row.summary ?? ''),
    inputText: row.input_text ? String(row.input_text) : undefined,
    outputText: row.output_text ? String(row.output_text) : undefined,
    escalated: Boolean(row.escalated),
    createdAt: new Date(String(row.created_at)),
  };
  const digest = `${activity.id}:${activity.summary}:${activity.createdAt.toISOString()}`;
  await attestActivity(activity, digest);
  const tx = await pool.query('SELECT attestation_tx FROM ai_worker_activity WHERE id = $1', [activityId]);
  await writeAdminAudit({
    adminUserId: req.adminUser!.operatorId,
    action: 'attestation_retry',
    targetType: 'aiva',
    targetId: activity.workerId,
    metadata: { activityId, success: Boolean(tx.rows[0]?.attestation_tx) },
    ipAddress: req.ip,
  });
  res.json({
    retried: true,
    activityId,
    attestationTx: tx.rows[0]?.attestation_tx ? String(tx.rows[0].attestation_tx) : null,
  });
});

adminRouter.get('/revenue/summary', async (_req: AdminRequest, res: Response) => {
  const summary = await queryRevenueSummary();
  const { tierCounts, tierMrr } = await queryTierBreakdown();
  res.json({ ...summary, tierCounts, tierMrr });
});

adminRouter.get('/revenue/at-risk', async (_req: AdminRequest, res: Response) => {
  res.json(await queryRevenueAtRisk());
});

adminRouter.get('/revenue/timeline', async (_req: AdminRequest, res: Response) => {
  res.json({ timeline: await queryRevenueTimeline() });
});

adminRouter.get('/revenue/invoices', async (req: AdminRequest, res: Response) => {
  const invoices = await queryRevenueInvoices({
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    limit: parseInt(String(req.query.limit ?? '50'), 10) || 50,
  });
  res.json({ invoices });
});

adminRouter.post('/revenue/refund', async (req: AdminRequest, res: Response) => {
  const invoiceId = String(req.body?.invoiceId ?? '');
  const reason = String(req.body?.reason ?? 'requested_by_customer') as
    | 'duplicate'
    | 'fraudulent'
    | 'requested_by_customer';
  const note = String(req.body?.note ?? '').trim();
  if (!invoiceId || note.length < 10) {
    res.status(400).json({ error: 'invoiceId and note (min 10 chars) are required' });
    return;
  }
  try {
    const result = await issueRevenueRefund({ invoiceId, reason, note });
    await writeAdminAudit({
      adminUserId: req.adminUser!.operatorId,
      action: 'refund',
      targetType: 'invoice',
      targetId: invoiceId,
      metadata: { stripeRefundId: result.stripeRefundId, amount: result.amount, reason, note },
      ipAddress: req.ip,
    });
    res.json({ refunded: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(422).json({ error: msg });
  }
});

adminRouter.get('/va/team', async (_req: AdminRequest, res: Response) => {
  res.json({ members: await queryVaTeam() });
});

adminRouter.post('/va/team', async (req: AdminRequest, res: Response) => {
  const name = String(req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const maxLoad = Math.min(20, Math.max(1, parseInt(String(req.body?.maxLoad ?? '5'), 10) || 5));
  if (!name || !email) {
    res.status(400).json({ error: 'name and email are required' });
    return;
  }
  try {
    const result = await provisionAivaVaMember({
      name,
      email,
      maxLoad,
      source: 'manual',
    });
    await writeAdminAudit({
      adminUserId: req.adminUser!.operatorId,
      action: 'va_team_add',
      targetType: 'va_member',
      targetId: result.id,
      metadata: { name, email, created: result.created, source: result.source },
      ipAddress: req.ip,
    });
    res.status(result.created ? 201 : 200).json({
      id: result.id,
      name: result.name,
      email: result.email,
      maxLoad: result.maxLoad,
      source: result.source,
      created: result.created,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

adminRouter.patch('/va/team/:id', async (req: AdminRequest, res: Response) => {
  const id = String(req.params.id);
  const available = req.body?.available;
  const maxLoad = req.body?.maxLoad;
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (available !== undefined) {
    fields.push(`available = $${idx++}`);
    values.push(Boolean(available));
  }
  if (maxLoad !== undefined) {
    fields.push(`max_load = $${idx++}`);
    values.push(Math.min(20, Math.max(1, Number(maxLoad))));
  }
  if (fields.length === 0) {
    res.status(400).json({ error: 'No updates provided' });
    return;
  }
  values.push(id);
  const updated = await pool.query(
    `UPDATE va_team_members SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  if (updated.rows.length === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ member: updated.rows[0] });
});

adminRouter.delete('/va/team/:id', async (req: AdminRequest, res: Response) => {
  const id = String(req.params.id);
  const open = await pool.query(
    `SELECT COUNT(*)::int AS count FROM ai_worker_escalations
     WHERE assigned_to = $1 AND status != 'resolved'`,
    [id],
  );
  const count = Number(open.rows[0]?.count ?? 0);
  if (count > 0) {
    res.status(409).json({ error: 'has_open_escalations', count });
    return;
  }
  const deleted = await pool.query(
    `DELETE FROM va_team_members WHERE id = $1 RETURNING name, email`,
    [id],
  );
  if (deleted.rows.length === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ deleted: true });
});

adminRouter.get('/va/sla', async (req: AdminRequest, res: Response) => {
  const since = typeof req.query.since === 'string' ? req.query.since : undefined;
  res.json(await queryVaSla(since));
});

adminRouter.patch('/va/queue/:id/assign', async (req: AdminRequest, res: Response) => {
  const id = String(req.params.id);
  const assignedTo = String(req.body?.assignedTo ?? '');
  if (!assignedTo) {
    res.status(400).json({ error: 'assignedTo is required' });
    return;
  }
  try {
    const member = await assignEscalation(id, assignedTo);
    await writeAdminAudit({
      adminUserId: req.adminUser!.operatorId,
      action: 'va_assign',
      targetType: 'escalation',
      targetId: id,
      metadata: { assignedToName: member.name },
      ipAddress: req.ip,
    });
    res.json({ assigned: true, assignedTo: member });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

adminRouter.patch('/va/queue/:id/first-response', async (req: AdminRequest, res: Response) => {
  const id = String(req.params.id);
  try {
    const firstResponseAt = await markFirstResponse(id);
    res.json({ firstResponseAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

adminRouter.get('/audit-log', async (req: AdminRequest, res: Response) => {
  try {
    const format = typeof req.query.format === 'string' ? req.query.format : 'json';
    const params = {
      page: parseInt(String(req.query.page ?? '1'), 10) || 1,
      limit: parseInt(String(req.query.limit ?? '100'), 10) || 100,
      action: typeof req.query.action === 'string' ? req.query.action : undefined,
      targetType: typeof req.query.target_type === 'string' ? req.query.target_type : undefined,
      adminUserId: typeof req.query.adminUserId === 'string' ? req.query.adminUserId : undefined,
      since: typeof req.query.since === 'string' ? req.query.since : undefined,
      until: typeof req.query.until === 'string' ? req.query.until : undefined,
    };

    const result = await queryAuditLog(params);

    if (format === 'csv') {
      const csv = auditLogToCsv(result.entries);
      res.setHeader('Content-Disposition', 'attachment; filename="admin-audit-log.csv"');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send(csv);
      return;
    }

    const admins = await queryAuditLogAdmins();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...result, admins });
  } catch (err) {
    console.error('[admin] audit-log failed:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to load audit log',
    });
  }
});
