import express, { type Express, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { config } from '../config/index.js';
import { hostedAppOrigin } from '../gateway/hosted-domain.js';
import { redirectIfHostedAuthed, requireOrgMember } from '../gateway/web-auth.js';
import { pool } from '../memory/db.js';
import { CARINA_OPS_CHECKOUT_PLANS, isCarinaOpsPlan, normalizePlanId, type BillingPlanId } from '../billing/plans.js';
import { StripeService } from '../billing/stripe-service.js';
import { writeProductAudit } from '../hosted/product-audit.js';
import {
  confirmPasswordReset,
  getUserProfile,
  initHostedDb,
  loginUser,
  registerUser,
  requestPasswordReset,
  verifyJwt,
} from './hosted-auth.js';
import { acceptInvite, createInvite, listPendingInvites, revokeInvite } from '../hosted/org-invites.js';
import { resolveOrgSession } from '../hosted/org-context.js';
import { canPerform } from '../hosted/rbac.js';
import type { OrgRole } from '../hosted/org-types.js';

async function resolveStripeCustomerId(accountId: string): Promise<string | null> {
  const sub = await pool.query(
    'SELECT stripe_customer_id FROM subscriptions WHERE tenant_id = $1',
    [accountId],
  );
  if (sub.rows[0]?.stripe_customer_id) {
    return String(sub.rows[0].stripe_customer_id);
  }
  const user = await pool.query(
    'SELECT stripe_customer_id FROM hosted_users WHERE id = $1',
    [accountId],
  );
  return user.rows[0]?.stripe_customer_id ? String(user.rows[0].stripe_customer_id) : null;
}

async function getInstalledPacks(accountId: string): Promise<Array<{ pack_name: string; version: string; status: string }>> {
  try {
    const result = await pool.query(
      `SELECT pack_name, version, status
       FROM installed_packs
       WHERE tenant_id = $1
       ORDER BY installed_at DESC`,
      [accountId],
    );
    return result.rows.map((row) => ({
      pack_name: String(row.pack_name),
      version: String(row.version),
      status: String(row.status),
    }));
  } catch {
    return [];
  }
}

async function setHostedSession(
  req: Request,
  userId: string,
  orgId?: string,
  role?: string,
): Promise<void> {
  req.session.hostedAccountId = userId;
  if (orgId) req.session.hostedOrgId = orgId;
  if (role) req.session.hostedOrgRole = role as OrgRole;
}

export function mountHostedWebRoutes(app: Express): void {
  if (!config.hosted.enabled) return;

  const router = express.Router();
  router.use(express.json());

  router.post('/register', redirectIfHostedAuthed, async (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!email || password.length < 8) {
      res.status(400).json({ error: 'email and password (8+ chars) required' });
      return;
    }
    try {
      const { userId } = await registerUser(email, password);
      const profile = await getUserProfile(userId);
      await setHostedSession(req, userId, profile?.org?.id, profile?.org?.role);
      const redirect = config.carinaOps.productEnabled ? '/ops/onboarding' : '/?welcome=1';
      res.json({ ok: true, redirect });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(409).json({ error: msg });
    }
  });

  router.post('/login', redirectIfHostedAuthed, async (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const result = await loginUser(email, password);
    if (!result) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const jwtUser = verifyJwt(result.token);
    if (!jwtUser) {
      res.status(500).json({ error: 'Login token invalid' });
      return;
    }
    req.session.hostedAccountId = jwtUser.userId;
    if (result.orgId) req.session.hostedOrgId = result.orgId;
    if (result.role) req.session.hostedOrgRole = result.role as OrgRole;
    res.json({ ok: true });
  });

  router.post('/logout', (req: Request, res: Response) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  router.post('/forgot-password', async (req: Request, res: Response) => {
    await initHostedDb();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: 'email required' });
      return;
    }
    if (!config.resend.apiKey) {
      res.json({ ok: false, emailDisabled: true });
      return;
    }
    await requestPasswordReset(email, hostedAppOrigin(req));
    res.json({ ok: true }); // always 200 to avoid email enumeration
  });

  router.post('/reset-password', async (req: Request, res: Response) => {
    await initHostedDb();
    const token = String(req.body?.token ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (!token || password.length < 8) {
      res.status(400).json({ error: 'token and password (8+ chars) required' });
      return;
    }
    const ok = await confirmPasswordReset(token, password);
    if (!ok) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }
    res.json({ ok: true });
  });

  router.get('/me', async (req: Request, res: Response) => {
    const accountId = req.session?.hostedAccountId;
    if (!accountId) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    const profile = await getUserProfile(accountId);
    if (!profile) {
      res.status(401).json({ error: 'Account not found' });
      return;
    }
    const scout = await import('../billing/tenant-scout.js').then((m) =>
      m.getTenantScoutCredentials(accountId, profile.email),
    );
    res.json({
      id: accountId,
      email: profile.email,
      tier: profile.tier,
      apiKey: profile.apiKey,
      scoutActive: Boolean(scout),
      org: profile.org ?? null,
    });
  });

  const orgRouter = express.Router();
  orgRouter.use(express.json());

  orgRouter.post('/invites', requireOrgMember('org.members.invite'), async (req: Request, res: Response) => {
    const ctx = req.orgContext!;
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const role = String(req.body?.role ?? '') as Exclude<OrgRole, 'owner'>;
    const allowed: Array<Exclude<OrgRole, 'owner'>> = ['admin', 'operator', 'auditor', 'viewer'];
    if (!email || !allowed.includes(role)) {
      res.status(400).json({ error: 'email and valid role required' });
      return;
    }
    try {
      const invite = await createInvite(ctx.orgId, email, role, ctx.userId);
      res.json({
        ok: true,
        inviteId: invite.inviteId,
        token: invite.token,
        emailSent: invite.emailSent,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = err instanceof Error && 'statusCode' in err
        ? Number((err as { statusCode?: number }).statusCode ?? 500)
        : 500;
      res.status(status).json({ error: msg });
    }
  });

  orgRouter.get('/invites', requireOrgMember('org.settings.read'), async (req: Request, res: Response) => {
    const ctx = req.orgContext!;
    const invites = await listPendingInvites(ctx.orgId);
    res.json({ invites });
  });

  orgRouter.delete('/invites/:id', requireOrgMember('org.members.invite'), async (req: Request, res: Response) => {
    const ctx = req.orgContext!;
    await revokeInvite(ctx.orgId, String(req.params.id));
    res.json({ ok: true });
  });

  orgRouter.post('/invites/accept', async (req: Request, res: Response) => {
    const accountId = req.session?.hostedAccountId;
    if (!accountId) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    const token = String(req.body?.token ?? '').trim();
    if (!token) {
      res.status(400).json({ error: 'token required' });
      return;
    }
    try {
      const result = await acceptInvite(token, accountId);
      req.session.hostedOrgId = result.orgId;
      req.session.hostedOrgRole = result.role;
      res.json({ ok: true, orgId: result.orgId, role: result.role });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: msg });
    }
  });

  if (process.env.CARINA_RBAC_PROBE === 'true') {
    orgRouter.get('/_probe/billing.write', requireOrgMember('billing.write'), (_req, res) => {
      res.json({ ok: true });
    });
    orgRouter.get('/_probe/workbench.run', requireOrgMember('workbench.run'), (_req, res) => {
      res.json({ ok: true });
    });
    orgRouter.get('/_probe/usage.read', requireOrgMember('usage.read'), (_req, res) => {
      res.json({ ok: true });
    });
    orgRouter.post('/_probe/vault.write', requireOrgMember('vault.write'), (_req, res) => {
      res.json({ ok: true });
    });
  }

  router.use('/org', orgRouter);

  router.post('/billing/checkout', async (req: Request, res: Response) => {
    const accountId = req.session?.hostedAccountId;
    if (!accountId) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    const profile = await getUserProfile(accountId);
    if (!profile) {
      res.status(401).json({ error: 'Account not found' });
      return;
    }

    const requestedPlan = normalizePlanId(req.body?.plan);
    const origin = hostedAppOrigin(req);

    if (isCarinaOpsPlan(requestedPlan)) {
      const orgCtx = await resolveOrgSession(req);
      if (!orgCtx) {
        res.status(401).json({ error: 'Not signed in' });
        return;
      }
      if (!canPerform(orgCtx.role, 'billing.write')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      if (!CARINA_OPS_CHECKOUT_PLANS.includes(requestedPlan)) {
        res.status(400).json({ error: 'Invalid plan' });
        return;
      }
      if (!config.hosted.stripeSecretKey) {
        res.status(503).json({ error: 'Billing is not configured' });
        return;
      }
      try {
        const stripeService = new StripeService();
        const session = await stripeService.createCheckoutSession({
          tenantId: accountId,
          orgId: orgCtx.orgId,
          email: profile.email,
          plan: requestedPlan,
          successUrl: `${origin}/ops/billing?checkout=success`,
          cancelUrl: `${origin}/ops/billing?checkout=cancel`,
        });
        await writeProductAudit({
          orgId: orgCtx.orgId,
          actorUserId: orgCtx.userId,
          action: 'billing.checkout_started',
          resourceType: 'subscription',
          details: { plan: requestedPlan },
          req,
        });
        res.json({ url: session.url });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: msg });
      }
      return;
    }

    const priceId = config.hosted.proPriceId;
    if (!priceId || !config.hosted.stripeSecretKey) {
      res.status(503).json({ error: 'Billing is not configured' });
      return;
    }
    const stripe = new Stripe(config.hosted.stripeSecretKey);
    const scoutPlan: BillingPlanId = requestedPlan === 'free' ? 'scout_pro' : requestedPlan;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: profile.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?success=true`,
      cancel_url: `${origin}/billing?canceled=true`,
      metadata: { tenantId: accountId, plan: scoutPlan },
      subscription_data: {
        metadata: { tenantId: accountId, plan: scoutPlan },
      },
    });
    res.json({ url: session.url });
  });

  router.post('/billing/portal', async (req: Request, res: Response) => {
    const accountId = req.session?.hostedAccountId;
    if (!accountId) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    const customerId = await resolveStripeCustomerId(accountId);
    if (!customerId) {
      res.status(400).json({ error: 'No billing account yet. Upgrade first.' });
      return;
    }
    try {
      const stripeService = new StripeService();
      const returnPath = String(req.body?.returnPath ?? '').trim();
      const returnUrl = returnPath.startsWith('/')
        ? `${hostedAppOrigin(req)}${returnPath}`
        : `${hostedAppOrigin(req)}/ops/billing`;
      const portal = await stripeService.updatePaymentMethod(customerId, returnUrl);
      res.json({ url: portal.url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  app.use('/app/auth', router);
}

export function mountHostedContextRoute(app: Express): void {
  if (!config.hosted.enabled) return;
  app.get('/api/hosted/context', async (req: Request, res: Response) => {
    const emailDisabled = !config.resend.apiKey;
    if (!req.hostedUser) {
      res.json({ hosted: true, user: null, emailDisabled });
      return;
    }
    const scout = await import('../billing/tenant-scout.js').then((m) =>
      m.getTenantScoutCredentials(req.hostedUser!.id, req.hostedUser!.email),
    );
    const installedPacks = await getInstalledPacks(req.hostedUser.id);
    res.json({
      hosted: true,
      emailDisabled,
      installedPacks,
      user: {
        id: req.hostedUser.id,
        email: req.hostedUser.email,
        tier: req.hostedUser.tier,
        scoutActive: Boolean(scout),
      },
    });
  });
}
