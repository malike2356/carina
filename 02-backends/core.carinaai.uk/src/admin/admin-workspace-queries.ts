import Stripe from 'stripe';
import { pool } from '../memory/db.js';
import { reactivateSubscription, suspendSubscription } from '../billing/aiva-billing.js';
import { listAivaInvoices } from '../billing/aiva-billing-store.js';
import { slotLimitDbValue } from '../billing/aiva-tier.js';
import { loadAivaMonthlyGbpFromPlatform, gbpToPence } from '../billing/platform-pricing-amounts.js';
import { messageLimit } from '../usage/usage-service.js';
import { getStripeBillingClientOrNull } from '../billing/billing-stripe-client.js';

export interface WorkspaceListParams {
  search?: string;
  plan?: string;
  status?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

function workspaceSortClause(sort: string): string {
  if (sort === 'last_active_desc') return 'last_active_at DESC NULLS LAST, s.created_at DESC';
  if (sort === 'mrr_desc') return 's.monthly_amount_pence DESC, s.created_at DESC';
  return 's.created_at DESC';
}

function stripeClient() {
  return getStripeBillingClientOrNull();
}

export async function queryWorkspaceList(params: WorkspaceListParams) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 50));
  const offset = (page - 1) * limit;
  const search = params.search?.trim() ?? '';
  const plan = params.plan ?? 'all';
  const status = params.status ?? 'all';
  const sort = params.sort ?? 'created_at_desc';

  const conditions = ['1=1'];
  const queryParams: unknown[] = [];
  let idx = 1;

  if (search) {
    conditions.push(
      `(c.owner_name ILIKE $${idx} OR c.owner_email ILIKE $${idx} OR s.workspace_id ILIKE $${idx})`,
    );
    queryParams.push(`%${search}%`);
    idx++;
  }

  if (plan !== 'all') {
    conditions.push(`s.plan_tier = $${idx++}`);
    queryParams.push(plan);
  }

  if (status === 'active') {
    conditions.push(`s.status = 'active'`);
  } else if (status === 'suspended') {
    conditions.push(`s.status = 'suspended'`);
  } else if (status === 'at_risk') {
    conditions.push(
      `(s.status = 'past_due' OR (s.status = 'trialing' AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at < NOW() + INTERVAL '3 days'))`,
    );
  }

  const where = conditions.join(' AND ');
  const orderBy = workspaceSortClause(sort);

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM aiva_subscriptions s
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = s.workspace_id
     WHERE ${where}`,
    queryParams,
  );

  const listResult = await pool.query(
    `SELECT s.workspace_id, s.plan_tier, s.status, s.trial_ends_at, s.aiva_slot_limit,
            s.monthly_amount_pence, s.created_at,
            c.owner_email, c.owner_name,
            ps.plan_tier AS paddle_plan_tier, ps.status AS paddle_status,
            cd.hostname AS custom_domain_hostname, cd.cf_ssl_status AS custom_domain_cf_ssl_status,
            (SELECT COUNT(*)::int FROM ai_workers w
             WHERE w.workspace_id = s.workspace_id AND w.status != 'dismissed') AS aivas_used,
            (SELECT MAX(a.created_at) FROM ai_worker_activity a
             JOIN ai_workers w ON w.id = a.worker_id WHERE w.workspace_id = s.workspace_id) AS last_active_at,
            COALESCE(sig.critical_count, 0)::int AS critical_signal_count,
            COALESCE(sig.warn_count, 0)::int AS warn_signal_count,
            COALESCE(u.message_count, 0)::int AS message_count
     FROM aiva_subscriptions s
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = s.workspace_id
     LEFT JOIN paddle_subscriptions ps ON ps.workspace_id = s.workspace_id
     LEFT JOIN LATERAL (
       SELECT hostname, cf_ssl_status
       FROM custom_domains
       WHERE org_id::text = s.workspace_id
       ORDER BY created_at DESC
       LIMIT 1
     ) cd ON true
     LEFT JOIN aiva_usage u ON u.workspace_id = s.workspace_id AND u.month = to_char(NOW(), 'YYYY-MM')
     LEFT JOIN LATERAL (
       SELECT COUNT(*) FILTER (WHERE sc.severity = 'critical')::int AS critical_count,
              COUNT(*) FILTER (WHERE sc.severity = 'warning')::int AS warn_count
       FROM scout_signal_cache sc
       JOIN ai_workers w ON w.id = sc.agent_id
       WHERE w.workspace_id = s.workspace_id
         AND sc.created_at > NOW() - INTERVAL '7 days'
     ) sig ON true
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...queryParams, limit, offset],
  );

  return {
    total: Number(countResult.rows[0]?.total ?? 0),
    page,
    limit,
    workspaces: listResult.rows.map((row) => {
      const trialEnds = row.trial_ends_at ? new Date(String(row.trial_ends_at)) : null;
      const trialDays =
        trialEnds && row.status === 'trialing'
          ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86_400_000))
          : null;
      return {
        workspaceId: String(row.workspace_id),
        name: String(row.owner_name || row.owner_email || row.workspace_id).slice(0, 64),
        ownerEmail: row.owner_email ? String(row.owner_email) : null,
        createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
        planTier: String(row.plan_tier),
        paddlePlanTier: row.paddle_plan_tier ? String(row.paddle_plan_tier) : null,
        paddleStatus: row.paddle_status ? String(row.paddle_status) : null,
        customDomainHostname: row.custom_domain_hostname ? String(row.custom_domain_hostname) : null,
        customDomainCfSslStatus: row.custom_domain_cf_ssl_status
          ? String(row.custom_domain_cf_ssl_status)
          : null,
        subscriptionStatus: String(row.status),
        trialEndsAt: trialEnds?.toISOString() ?? null,
        trialDaysRemaining: trialDays,
        aivasUsed: Number(row.aivas_used ?? 0),
        slotLimit: Number(row.aiva_slot_limit ?? 1),
        monthlyAmountPence: Number(row.monthly_amount_pence ?? 0),
        lastActiveAt: row.last_active_at
          ? new Date(String(row.last_active_at)).toISOString()
          : null,
        criticalSignalCount: Number(row.critical_signal_count ?? 0),
        warnSignalCount: Number(row.warn_signal_count ?? 0),
        messageCount: Number(row.message_count ?? 0),
        messageLimit: (() => {
          const tier = String(row.plan_tier);
          const limit = messageLimit(tier);
          return Number.isFinite(limit) ? limit : null;
        })(),
        usagePercent: (() => {
          const count = Number(row.message_count ?? 0);
          const tier = String(row.plan_tier);
          const limit = messageLimit(tier);
          if (!Number.isFinite(limit) || limit <= 0) return null;
          return Math.min(100, Math.round((count / limit) * 100));
        })(),
      };
    }),
  };
}

export async function queryWorkspaceActivity(
  workspaceId: string,
  limit = 20,
  offset = 0,
): Promise<
  Array<{
    id: string;
    workerId: string;
    workerName: string;
    actionType: string;
    summary: string;
    createdAt: string;
    attestationTx: string | null;
  }>
> {
  const result = await pool.query(
    `SELECT a.id, a.worker_id, a.action_type, a.summary, a.attestation_tx, a.created_at,
            w.name AS worker_name
     FROM ai_worker_activity a
     JOIN ai_workers w ON w.id = a.worker_id
     WHERE w.workspace_id = $1
     ORDER BY a.created_at DESC
     LIMIT $2 OFFSET $3`,
    [workspaceId, limit, offset],
  );
  return result.rows.map((a) => ({
    id: String(a.id),
    workerId: String(a.worker_id),
    workerName: String(a.worker_name),
    actionType: String(a.action_type),
    summary: String(a.summary ?? ''),
    createdAt: new Date(String(a.created_at)).toISOString(),
    attestationTx: a.attestation_tx ? String(a.attestation_tx) : null,
  }));
}

export async function queryWorkspaceDetail(workspaceId: string) {
  const subResult = await pool.query(
    `SELECT s.*, c.owner_email, c.owner_name, c.admin_notes,
            ps.plan_tier AS paddle_plan_tier, ps.status AS paddle_status,
            cd.hostname AS custom_domain_hostname, cd.cf_ssl_status AS custom_domain_cf_ssl_status,
            cd.cf_hostname_id AS custom_domain_cf_hostname_id,
            (SELECT COUNT(*)::int FROM ai_workers w
             WHERE w.workspace_id = s.workspace_id AND w.status != 'dismissed') AS aivas_used,
            (SELECT MAX(a.created_at) FROM ai_worker_activity a
             JOIN ai_workers w ON w.id = a.worker_id WHERE w.workspace_id = s.workspace_id) AS last_active_at
     FROM aiva_subscriptions s
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = s.workspace_id
     LEFT JOIN paddle_subscriptions ps ON ps.workspace_id = s.workspace_id
     LEFT JOIN LATERAL (
       SELECT hostname, cf_ssl_status, cf_hostname_id
       FROM custom_domains
       WHERE org_id::text = s.workspace_id
       ORDER BY created_at DESC
       LIMIT 1
     ) cd ON true
     WHERE s.workspace_id = $1`,
    [workspaceId],
  );
  const row = subResult.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const trialEnds = row.trial_ends_at ? new Date(String(row.trial_ends_at)) : null;
  const trialDays =
    trialEnds && row.status === 'trialing'
      ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86_400_000))
      : null;

  const workersResult = await pool.query(
    `SELECT w.id, w.name, w.status, w.role_description, w.created_at,
            COALESCE(act.escalation_count, 0)::int AS escalation_count,
            act.last_active_at,
            CASE WHEN COALESCE(att.attestation_total, 0) > 0
              THEN COALESCE(att.attestation_confirmed, 0)::float / att.attestation_total
              ELSE 0 END AS attestation_coverage
     FROM ai_workers w
     LEFT JOIN LATERAL (
       SELECT COUNT(*) FILTER (WHERE action_type = 'escalated')::int AS escalation_count,
              MAX(created_at) AS last_active_at
       FROM ai_worker_activity a WHERE a.worker_id = w.id
     ) act ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS attestation_total,
              COUNT(*) FILTER (WHERE attestation_tx IS NOT NULL)::int AS attestation_confirmed
       FROM ai_worker_activity a WHERE a.worker_id = w.id
     ) att ON true
     WHERE w.workspace_id = $1 AND w.status != 'dismissed'
     ORDER BY w.created_at DESC`,
    [workspaceId],
  );

  const activityResult = await pool.query(
    `SELECT a.id, a.worker_id, a.action_type, a.summary, a.attestation_tx, a.created_at,
            w.name AS worker_name
     FROM ai_worker_activity a
     JOIN ai_workers w ON w.id = a.worker_id
     WHERE w.workspace_id = $1
     ORDER BY a.created_at DESC
     LIMIT 20`,
    [workspaceId],
  );

  const signalsResult = await pool.query(
    `SELECT sc.id, sc.event_type, sc.severity, sc.summary, sc.created_at
     FROM scout_signal_cache sc
     JOIN ai_workers w ON w.id = sc.agent_id
     WHERE w.workspace_id = $1
     ORDER BY sc.created_at DESC
     LIMIT 10`,
    [workspaceId],
  );

  const invoices = await listAivaInvoices(workspaceId, 10);
  const scoutFleetEnabled = process.env.AIVA_SCOUT_FLEET_ENABLED !== 'false';

  return {
    workspace: {
      workspaceId,
      name: String(row.owner_name || row.owner_email || workspaceId).slice(0, 64),
      ownerEmail: row.owner_email ? String(row.owner_email) : null,
      ownerUserId: null,
      createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
      onboardingCompletedAt: null,
      adminNotes: row.admin_notes ? String(row.admin_notes) : '',
    },
    subscription: {
      planTier: String(row.plan_tier),
      paddlePlanTier: row.paddle_plan_tier ? String(row.paddle_plan_tier) : null,
      paddleStatus: row.paddle_status ? String(row.paddle_status) : null,
      customDomainHostname: row.custom_domain_hostname ? String(row.custom_domain_hostname) : null,
      customDomainCfSslStatus: row.custom_domain_cf_ssl_status
        ? String(row.custom_domain_cf_ssl_status)
        : null,
      status: String(row.status),
      trialEndsAt: trialEnds?.toISOString() ?? null,
      trialDaysRemaining: trialDays,
      slotLimit: Number(row.aiva_slot_limit ?? 1),
      aivasUsed: Number(row.aivas_used ?? 0),
      stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
      stripeSubscriptionId: row.stripe_subscription_id ? String(row.stripe_subscription_id) : null,
      currentPeriodEnd: row.current_period_end
        ? new Date(String(row.current_period_end)).toISOString()
        : null,
      gracePeriodEndsAt: row.grace_period_ends_at
        ? new Date(String(row.grace_period_ends_at)).toISOString()
        : null,
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
      pendingDowngradeTier: row.pending_downgrade_conflict ? 'conflict' : null,
      monthlyAmountPence: Number(row.monthly_amount_pence ?? 0),
    },
    lastActiveAt: row.last_active_at
      ? new Date(String(row.last_active_at)).toISOString()
      : null,
    aivas: workersResult.rows.map((w) => ({
      id: String(w.id),
      name: String(w.name),
      role: String(w.role_description ?? ''),
      status: String(w.status),
      createdAt: w.created_at ? new Date(String(w.created_at)).toISOString() : null,
      lastActiveAt: w.last_active_at ? new Date(String(w.last_active_at)).toISOString() : null,
      escalationCount: Number(w.escalation_count ?? 0),
      scoutRegistered: scoutFleetEnabled,
      attestationCoverage: Number(w.attestation_coverage ?? 0),
    })),
    recentActivity: activityResult.rows.map((a) => ({
      id: String(a.id),
      workerId: String(a.worker_id),
      workerName: String(a.worker_name),
      actionType: String(a.action_type),
      summary: String(a.summary ?? ''),
      createdAt: new Date(String(a.created_at)).toISOString(),
      attestationTx: a.attestation_tx ? String(a.attestation_tx) : null,
    })),
    recentSignals: signalsResult.rows.map((s) => ({
      id: String(s.id),
      eventType: String(s.event_type),
      severity: String(s.severity),
      summary: String(s.summary),
      createdAt: new Date(String(s.created_at)).toISOString(),
    })),
    invoices: invoices.map((inv) => ({
      id: inv.id,
      stripeInvoiceId: inv.stripeInvoiceId,
      amount: inv.amountPaid,
      status: inv.status,
      paidAt: inv.createdAt,
      invoicePdfUrl: inv.invoicePdfUrl,
    })),
  };
}

export async function extendWorkspaceTrial(workspaceId: string, extendByDays: number) {
  const days = Math.min(90, Math.max(1, Math.floor(extendByDays)));
  const result = await pool.query(
    `UPDATE aiva_subscriptions
     SET trial_ends_at = COALESCE(trial_ends_at, NOW()) + ($2::int * INTERVAL '1 day'),
         status = CASE WHEN status = 'suspended' THEN status ELSE 'trialing' END,
         updated_at = NOW()
     WHERE workspace_id = $1
     RETURNING trial_ends_at`,
    [workspaceId, days],
  );
  if (!result.rows[0]) throw new Error('Workspace not found');
  return {
    trialEndsAt: new Date(String(result.rows[0].trial_ends_at)).toISOString(),
    extendByDays: days,
  };
}

export async function forceWorkspacePlan(
  workspaceId: string,
  planTier: string,
  reason: string,
): Promise<{ planTier: string; status: string; previousTier: string }> {
  const existing = await pool.query(
    'SELECT plan_tier, status FROM aiva_subscriptions WHERE workspace_id = $1',
    [workspaceId],
  );
  const prev = existing.rows[0] as { plan_tier?: string; status?: string } | undefined;
  if (!prev) throw new Error('Workspace not found');
  const previousTier = String(prev.plan_tier ?? 'trial');

  if (planTier === 'suspended') {
    await suspendSubscription(workspaceId, 'payment');
    return { planTier: previousTier, status: 'suspended', previousTier };
  }

  if (String(prev.status) === 'suspended') {
    await reactivateSubscription(workspaceId);
  }

  const slotLimit = slotLimitDbValue(planTier);
  const platformMonthly = await loadAivaMonthlyGbpFromPlatform();
  const monthlyAmount =
    planTier === 'starter'
      ? gbpToPence(platformMonthly.starter)
      : planTier === 'team' || planTier === 'growth'
        ? gbpToPence(platformMonthly.team)
        : planTier === 'business'
          ? gbpToPence(platformMonthly.business)
          : null;
  let status = 'active';
  if (planTier === 'trial') status = 'trialing';

  await pool.query(
    `UPDATE aiva_subscriptions SET
       plan_tier = $2,
       status = $3,
       aiva_slot_limit = $4,
       monthly_amount_pence = $5,
       updated_at = NOW()
     WHERE workspace_id = $1`,
    [workspaceId, planTier, status, slotLimit, monthlyAmount],
  );

  return { planTier, status, previousTier };
}

export async function pauseAllWorkspaceAivas(workspaceId: string): Promise<number> {
  const result = await pool.query(
    `UPDATE ai_workers SET status = 'paused', updated_at = NOW()
     WHERE workspace_id = $1 AND status = 'active'
     RETURNING id`,
    [workspaceId],
  );
  return result.rowCount ?? 0;
}

export async function resumeAllWorkspaceAivas(workspaceId: string): Promise<number> {
  const sub = await pool.query('SELECT status FROM aiva_subscriptions WHERE workspace_id = $1', [
    workspaceId,
  ]);
  if (String(sub.rows[0]?.status) === 'suspended') {
    const err = new Error('workspace_suspended');
    (err as Error & { code?: string }).code = 'workspace_suspended';
    throw err;
  }
  const result = await pool.query(
    `UPDATE ai_workers SET status = 'active', updated_at = NOW()
     WHERE workspace_id = $1 AND status = 'paused'
     RETURNING id`,
    [workspaceId],
  );
  return result.rowCount ?? 0;
}

export async function addWorkspaceCredit(
  workspaceId: string,
  amountPence: number,
  note: string,
): Promise<{ creditNoteId: string; amount: number }> {
  const stripe = stripeClient();
  if (!stripe) throw new Error('Stripe is not configured');

  const sub = await pool.query(
    'SELECT stripe_customer_id FROM aiva_subscriptions WHERE workspace_id = $1',
    [workspaceId],
  );
  const customerId = sub.rows[0]?.stripe_customer_id
    ? String(sub.rows[0].stripe_customer_id)
    : null;
  if (!customerId) throw new Error('No Stripe customer for this workspace');

  const amount = Math.max(1, Math.floor(amountPence));
  const tx = await stripe.customers.createBalanceTransaction(customerId, {
    amount: -amount,
    currency: 'gbp',
    description: note.slice(0, 500),
  });

  return { creditNoteId: tx.id, amount };
}

export async function saveWorkspaceNotes(workspaceId: string, notes: string): Promise<void> {
  const updated = await pool.query(
    `UPDATE aiva_workspace_contacts SET admin_notes = $2, updated_at = NOW() WHERE workspace_id = $1`,
    [workspaceId, notes],
  );
  if ((updated.rowCount ?? 0) === 0) {
    await pool.query(
      `INSERT INTO aiva_workspace_contacts (workspace_id, owner_email, owner_name, admin_notes)
       VALUES ($1, $2, '', $3)
       ON CONFLICT (workspace_id) DO UPDATE SET admin_notes = EXCLUDED.admin_notes, updated_at = NOW()`,
      [workspaceId, `workspace-${workspaceId.slice(0, 8)}@admin.local`, notes],
    );
  }
}
