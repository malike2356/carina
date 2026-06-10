import express, { type Express, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { config } from '../config/index.js';
import { hostedAppOrigin } from '../gateway/hosted-domain.js';
import { redirectIfHostedAuthed } from '../gateway/web-auth.js';
import { pool } from '../memory/db.js';
import { StripeService } from '../billing/stripe-service.js';
import {
  getUserProfile,
  loginUser,
  registerUser,
  verifyJwt,
} from './hosted-auth.js';

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
      req.session.hostedAccountId = userId;
      res.json({ ok: true });
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
    res.json({ ok: true });
  });

  router.post('/logout', (req: Request, res: Response) => {
    req.session.destroy(() => res.json({ ok: true }));
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
    });
  });

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
    const priceId = config.hosted.proPriceId;
    if (!priceId || !config.hosted.stripeSecretKey) {
      res.status(503).json({ error: 'Billing is not configured' });
      return;
    }
    const origin = hostedAppOrigin(req);
    const stripe = new Stripe(config.hosted.stripeSecretKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: profile.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?success=true`,
      cancel_url: `${origin}/billing?canceled=true`,
      metadata: { tenantId: accountId, plan: 'scout_standard' },
      subscription_data: {
        metadata: { tenantId: accountId, plan: 'scout_standard' },
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
      res.status(400).json({ error: 'No billing account yet. Upgrade to Pro first.' });
      return;
    }
    try {
      const stripeService = new StripeService();
      const portal = await stripeService.updatePaymentMethod(
        customerId,
        `${hostedAppOrigin(req)}/billing`,
      );
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
    if (!req.hostedUser) {
      res.json({ hosted: true, user: null });
      return;
    }
    const scout = await import('../billing/tenant-scout.js').then((m) =>
      m.getTenantScoutCredentials(req.hostedUser!.id, req.hostedUser!.email),
    );
    const installedPacks = await getInstalledPacks(req.hostedUser.id);
    res.json({
      hosted: true,
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
