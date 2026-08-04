/**
 * Seeds a Carina Ops demo org for sales calls: demo user, org on a paid plan,
 * BYOK vault entry, workbench run history, usage records, and audit variety.
 *
 * Staging or local hosted stack only. Never run against production.
 *
 * Run from core.carinaai.uk with DATABASE_URL set:
 *   pnpm seed:ops-demo
 *
 * Env (all optional except DATABASE_URL):
 *   DEMO_EMAIL          demo account email (default demo-ops@demo.carinaai.uk)
 *   DEMO_PASSWORD       demo account password (default: generated and printed)
 *   DEMO_ORG_NAME       org display name (default "Acme Ops Demo")
 *   DEMO_PLAN           carina_ops_starter | carina_ops_team (default team)
 *   DEMO_BYOK_PROVIDER  vault provider slug (default openai)
 *   DEMO_BYOK_KEY       provider API key; defaults to a placeholder. Use a
 *                       TEST key only; live workbench runs need a real one.
 *   DEMO_INVITE_EMAIL   pending invite target (default teammate@example.com)
 *   DEMO_RESET=true     wipe this org's demo history before reseeding
 */
import crypto from 'node:crypto';
import { pool } from '../src/memory/db.js';
import { runMigrations } from '../src/memory/migrations.js';
import { runHostedMigrations } from '../src/api/hosted-migrations.js';
import { upsertHostedUser } from '../src/api/hosted-auth.js';
import { createOrgForUser, getPrimaryOrgForUser } from '../src/hosted/org-service.js';
import { addVaultEntry, listVaultEntries } from '../src/hosted/vault-service.js';
import { writeProductAudit } from '../src/hosted/product-audit.js';
import { markUsageViewed } from '../src/hosted/onboarding-service.js';

const DEMO_EMAIL = (process.env.DEMO_EMAIL ?? 'demo-ops@demo.carinaai.uk').toLowerCase().trim();
const DEMO_ORG_NAME = process.env.DEMO_ORG_NAME ?? 'Acme Ops Demo';
const DEMO_PLAN = process.env.DEMO_PLAN ?? 'carina_ops_team';
const DEMO_BYOK_PROVIDER = process.env.DEMO_BYOK_PROVIDER ?? 'openai';
const DEMO_BYOK_KEY = process.env.DEMO_BYOK_KEY ?? 'sk-demo-placeholder-not-a-real-key';
const DEMO_INVITE_EMAIL = (process.env.DEMO_INVITE_EMAIL ?? 'teammate@example.com').toLowerCase();
const DEMO_RESET = process.env.DEMO_RESET === 'true';

const VALID_PLANS = ['carina_ops_starter', 'carina_ops_team'];

interface DemoRun {
  title: string;
  prompt: string;
  response: string;
  provider: string;
  model: string;
  modelClass: string;
  tokensIn: number;
  tokensOut: number;
  costEstimate: number;
  daysAgo: number;
}

const DEMO_RUNS: DemoRun[] = [
  {
    title: 'Demo: BYOK benefits summary',
    prompt: 'Summarise three benefits of BYOK for platform teams in two sentences.',
    response:
      'BYOK keeps provider spend on your own account, so platform teams get direct '
      + 'cost visibility and can reuse negotiated rates. It also keeps key custody '
      + 'and provider choice in-house while Carina handles routing and audit.',
    provider: 'openai',
    model: 'gpt-4o-mini',
    modelClass: 'mini',
    tokensIn: 180,
    tokensOut: 620,
    costEstimate: 0.0006,
    daysAgo: 0,
  },
  {
    title: 'Demo: incident comms draft',
    prompt: 'Draft a two-paragraph status update for a resolved API latency incident.',
    response:
      'Earlier today our API experienced elevated latency for around 40 minutes. '
      + 'The cause was a saturated connection pool on one database replica; traffic '
      + 'was rebalanced and latency returned to normal.\n\nWe have raised the pool '
      + 'ceiling, added an alert on connection saturation, and scheduled a review '
      + 'of replica sizing. No data was lost and no action is required.',
    provider: 'openai',
    model: 'gpt-4o-mini',
    modelClass: 'mini',
    tokensIn: 240,
    tokensOut: 810,
    costEstimate: 0.0009,
    daysAgo: 1,
  },
  {
    title: 'Demo: release notes summary',
    prompt: 'Turn these bullet points into short customer release notes: SSO fixes, faster exports, new audit filters.',
    response:
      'This release improves single sign-on reliability, speeds up CSV exports for '
      + 'large workspaces, and adds action and date filters to the audit log so you '
      + 'can find events faster.',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    modelClass: 'balanced',
    tokensIn: 310,
    tokensOut: 490,
    costEstimate: 0.0083,
    daysAgo: 2,
  },
  {
    title: 'Demo: onboarding email',
    prompt: 'Write a short welcome email for a new operations analyst joining the platform team.',
    response:
      'Welcome to the platform team. Your first week focuses on our runbooks, the '
      + 'ops console, and shadowing the on-call rotation. Your manager will book an '
      + 'intro session for access and tooling; until then, the team handbook is the '
      + 'best place to start.',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    modelClass: 'balanced',
    tokensIn: 200,
    tokensOut: 560,
    costEstimate: 0.0090,
    daysAgo: 4,
  },
  {
    title: 'Demo: SQL explain',
    prompt: 'Explain what this query does: SELECT date, SUM(tokens_used) FROM usage_records GROUP BY date.',
    response:
      'It aggregates token usage per calendar day: for every distinct date in '
      + 'usage_records it returns the date and the total tokens_used across all '
      + 'rows with that date.',
    provider: 'openai',
    model: 'gpt-4o',
    modelClass: 'balanced',
    tokensIn: 260,
    tokensOut: 380,
    costEstimate: 0.0044,
    daysAgo: 6,
  },
];

function assertSafeTarget(databaseUrl: string): void {
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Refusing to seed demo data with NODE_ENV=production');
  }
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for seed-ops-demo');
  }
}

function generatePassword(): string {
  return `Demo-${crypto.randomBytes(9).toString('base64url')}`;
}

function dateDaysAgo(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

async function applyMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await runMigrations(client);
    await runHostedMigrations(client);
  } finally {
    client.release();
  }
}

async function ensureDemoOrg(
  userId: string,
): Promise<{ orgId: string; slug: string }> {
  let membership = await getPrimaryOrgForUser(userId);
  if (!membership) {
    const created = await createOrgForUser(userId, DEMO_EMAIL, DEMO_ORG_NAME);
    return { orgId: created.orgId, slug: created.slug };
  }
  const result = await pool.query<{ slug: string }>(
    'SELECT slug FROM organizations WHERE id = $1',
    [membership.orgId],
  );
  return { orgId: membership.orgId, slug: String(result.rows[0]?.slug ?? '') };
}

async function assignPlan(orgId: string, userId: string): Promise<void> {
  const trialEndsAt = dateDaysAgo(-30);
  await pool.query(
    `UPDATE organizations SET name = $2, plan = $3, updated_at = NOW() WHERE id = $1`,
    [orgId, DEMO_ORG_NAME, DEMO_PLAN],
  );
  await pool.query(
    `INSERT INTO subscriptions (tenant_id, org_id, plan, status, trial_ends_at)
     VALUES ($1, $2, $3, 'active', $4)
     ON CONFLICT (tenant_id) DO UPDATE SET
       org_id = EXCLUDED.org_id,
       plan = EXCLUDED.plan,
       status = 'active',
       trial_ends_at = EXCLUDED.trial_ends_at,
       updated_at = NOW()`,
    [userId, orgId, DEMO_PLAN, trialEndsAt],
  );
  await pool.query(`UPDATE hosted_users SET tier = 'pro' WHERE id = $1`, [userId]);
  await writeProductAudit({
    orgId,
    actorUserId: userId,
    action: 'billing.plan_changed',
    resourceType: 'subscription',
    details: { plan: DEMO_PLAN, source: 'seed-ops-demo' },
  });
}

async function ensureVaultEntry(orgId: string, userId: string): Promise<void> {
  const entries = await listVaultEntries(orgId);
  if (entries.some((entry) => entry.provider === DEMO_BYOK_PROVIDER)) {
    console.log(`[seed-ops-demo] Vault entry exists: ${DEMO_BYOK_PROVIDER}`);
    return;
  }
  await addVaultEntry(
    orgId,
    userId,
    { provider: DEMO_BYOK_PROVIDER, apiKey: DEMO_BYOK_KEY },
    userId,
  );
  console.log(`[seed-ops-demo] Vault entry added: ${DEMO_BYOK_PROVIDER}`);
}

async function resetDemoHistory(orgId: string): Promise<void> {
  await pool.query(`DELETE FROM ai_platform_workbench_runs WHERE org_id = $1`, [orgId]);
  await pool.query(`DELETE FROM usage_records WHERE org_id = $1`, [orgId]);
  await pool.query(`DELETE FROM ops_credit_ledger WHERE org_id = $1`, [orgId]);
  await pool.query(
    `DELETE FROM product_audit_log
     WHERE org_id = $1 AND action IN ('workbench.run_started', 'workbench.run_completed')`,
    [orgId],
  );
  await pool.query(
    `DELETE FROM org_invites WHERE org_id = $1 AND accepted_at IS NULL`,
    [orgId],
  );
  console.log('[seed-ops-demo] Cleared previous demo history for org');
}

async function insertRunAudit(
  orgId: string,
  userId: string,
  runId: string,
  run: DemoRun,
  createdAt: Date,
): Promise<void> {
  const events: Array<{ action: string; details: Record<string, unknown> }> = [
    {
      action: 'workbench.run_started',
      details: {
        provider: run.provider,
        model: run.model,
        modelClass: run.modelClass,
        inferenceMode: 'byok',
        promptLength: run.prompt.length,
      },
    },
    {
      action: 'workbench.run_completed',
      details: {
        provider: run.provider,
        model: run.model,
        modelClass: run.modelClass,
        inferenceMode: 'byok',
        tokensIn: run.tokensIn,
        tokensOut: run.tokensOut,
        tokensCached: 0,
        creditsBilled: 0,
        costEstimate: run.costEstimate,
      },
    },
  ];
  for (const event of events) {
    await pool.query(
      `INSERT INTO product_audit_log
        (org_id, actor_user_id, action, resource_type, resource_id, details, created_at)
       VALUES ($1, $2, $3, 'workbench_run', $4, $5::jsonb, $6)`,
      [orgId, userId, event.action, runId, JSON.stringify(event.details), createdAt],
    );
  }
}

async function seedWorkbenchHistory(orgId: string, userId: string): Promise<number> {
  const existing = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM ai_platform_workbench_runs WHERE org_id = $1`,
    [orgId],
  );
  if (Number(existing.rows[0]?.count ?? 0) > 0) {
    console.log('[seed-ops-demo] Workbench history exists; skipping (set DEMO_RESET=true to reseed)');
    return 0;
  }

  for (const run of DEMO_RUNS) {
    const runId = crypto.randomUUID();
    const createdAt = dateDaysAgo(run.daysAgo);
    await pool.query(
      `INSERT INTO ai_platform_workbench_runs
        (id, org_id, title, prompt, provider, model, status, tokens_in, tokens_out,
         tokens_cached, model_class, credits_billed, cost_estimate, response_text, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, $8, 0, $9, 0, $10, $11, $12)`,
      [
        runId,
        orgId,
        run.title,
        run.prompt,
        run.provider,
        run.model,
        run.tokensIn,
        run.tokensOut,
        run.modelClass,
        run.costEstimate,
        run.response,
        createdAt,
      ],
    );
    await pool.query(
      `INSERT INTO usage_records (tenant_id, org_id, date, tokens_used, model, cost_estimate)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        orgId,
        createdAt,
        run.tokensIn + run.tokensOut,
        `${run.provider}/${run.model}`,
        run.costEstimate,
      ],
    );
    await pool.query(
      `INSERT INTO ops_credit_ledger
        (org_id, event_type, credits, provider_cost_usd, model, model_class, session_id, created_at)
       VALUES ($1, 'byok_usage', 0, $2, $3, $4, $5, $6)`,
      [orgId, run.costEstimate, run.model, run.modelClass, runId, createdAt],
    );
    await insertRunAudit(orgId, userId, runId, run, createdAt);
  }
  return DEMO_RUNS.length;
}

async function seedPendingInvite(orgId: string, userId: string): Promise<void> {
  const existing = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM org_invites
     WHERE org_id = $1 AND email = $2 AND accepted_at IS NULL AND expires_at > NOW()`,
    [orgId, DEMO_INVITE_EMAIL],
  );
  if (Number(existing.rows[0]?.count ?? 0) > 0) {
    console.log(`[seed-ops-demo] Pending invite exists: ${DEMO_INVITE_EMAIL}`);
    return;
  }

  // Direct insert so no invite email is ever sent from a demo seed.
  const tokenHash = crypto.createHash('sha256')
    .update(crypto.randomBytes(32).toString('hex'))
    .digest('hex');
  const result = await pool.query(
    `INSERT INTO org_invites (org_id, email, role, token_hash, expires_at)
     VALUES ($1, $2, 'operator', $3, NOW() + INTERVAL '7 days')
     RETURNING id`,
    [orgId, DEMO_INVITE_EMAIL, tokenHash],
  );
  await writeProductAudit({
    orgId,
    actorUserId: userId,
    action: 'org.member_invited',
    resourceType: 'org_invite',
    resourceId: String(result.rows[0].id),
    details: {
      emailHash: crypto.createHash('sha256').update(DEMO_INVITE_EMAIL).digest('hex').slice(0, 16),
      emailDomain: DEMO_INVITE_EMAIL.split('@')[1] ?? 'unknown',
      role: 'operator',
      emailSent: false,
    },
  });
  console.log(`[seed-ops-demo] Pending invite created: ${DEMO_INVITE_EMAIL}`);
}

async function main(): Promise<void> {
  assertSafeTarget(process.env.DATABASE_URL ?? '');
  if (!VALID_PLANS.includes(DEMO_PLAN)) {
    throw new Error(`DEMO_PLAN must be one of: ${VALID_PLANS.join(', ')}`);
  }

  await applyMigrations();

  const password = process.env.DEMO_PASSWORD ?? generatePassword();
  const userId = await upsertHostedUser(DEMO_EMAIL, password);
  const { orgId, slug } = await ensureDemoOrg(userId);

  if (DEMO_RESET) {
    await resetDemoHistory(orgId);
  }

  await assignPlan(orgId, userId);
  await ensureVaultEntry(orgId, userId);
  const seededRuns = await seedWorkbenchHistory(orgId, userId);
  await seedPendingInvite(orgId, userId);
  await markUsageViewed(orgId, userId);

  console.log('');
  console.log('[seed-ops-demo] Demo org ready');
  console.log(`  Email:      ${DEMO_EMAIL}`);
  if (!process.env.DEMO_PASSWORD) {
    console.log(`  Password:   ${password} (generated; save it now)`);
  }
  console.log(`  Org:        ${DEMO_ORG_NAME} (${orgId}, slug ${slug})`);
  console.log(`  Plan:       ${DEMO_PLAN} (trial extended 30 days)`);
  console.log(`  Vault:      ${DEMO_BYOK_PROVIDER}${process.env.DEMO_BYOK_KEY ? '' : ' (placeholder key; add a real TEST key in /ops/vault for live runs)'}`);
  console.log(`  Runs:       ${seededRuns} seeded workbench runs`);
  console.log(`  Invite:     ${DEMO_INVITE_EMAIL} (pending, no email sent)`);
  console.log('  Sign in at /hosted-login, then open /ops for the demo walkthrough.');
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[seed-ops-demo] failed:', err);
    void pool.end();
    process.exit(1);
  });
