import express, { Router, type Express, type IRouter, type Request, type Response, type NextFunction } from 'express';
import Stripe from 'stripe';
import { config } from '../../config/index.js';
import { pool } from '../../memory/db.js';
import {
  decryptSecret,
  encryptSecret,
  hashPassword,
  initCloudDb,
  maskSecret,
  signCloudToken,
  verifyCloudToken,
  verifyPassword,
} from './store.js';

type CloudRequest = Request & { cloudOrg?: { orgId: string; email: string } };

async function registerCloudOrg(req: Request, res: Response): Promise<void> {
  const name = String(req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!name || !email || password.length < 8) {
    res.status(400).json({ error: 'name, email, and password (8+ chars) required' });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO cloud_orgs (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, plan`,
      [name, email, hashPassword(password)],
    );
    const row = result.rows[0];
    const token = signCloudToken(String(row.id), email);
    res.status(201).json({
      token,
      org: { id: row.id, name, email, plan: row.plan },
    });
  } catch {
    res.status(409).json({ error: 'Email already registered' });
  }
}

async function loginCloudOrg(req: Request, res: Response): Promise<void> {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const result = await pool.query(
    'SELECT id, name, email, password_hash, plan FROM cloud_orgs WHERE email = $1',
    [email],
  );
  if (result.rowCount === 0) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const row = result.rows[0];
  if (!verifyPassword(password, String(row.password_hash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = signCloudToken(String(row.id), email);
  res.json({
    token,
    org: { id: row.id, name: row.name, email: row.email, plan: row.plan },
  });
}

function getStripe(): Stripe | null {
  if (!config.hosted.stripeSecretKey) return null;
  return new Stripe(config.hosted.stripeSecretKey);
}

function priceIdForPlan(plan: string): string | null {
  if (plan === 'starter') return config.hosted.stripePrices.carinaOpsStarter || null;
  if (plan === 'team') return config.hosted.stripePrices.carinaOpsTeam || null;
  return null;
}

async function authMiddleware(req: CloudRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const session = verifyCloudToken(token);
  if (!session) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  req.cloudOrg = session;
  next();
}

export const cloudRouter: IRouter = Router();
cloudRouter.use(async (_req, _res, next) => {
  try {
    await initCloudDb();
    next();
  } catch (err) {
    next(err);
  }
});

cloudRouter.post('/auth/register', registerCloudOrg);
cloudRouter.post('/app/auth/register', registerCloudOrg);

cloudRouter.post('/auth/login', loginCloudOrg);
cloudRouter.post('/app/auth/login', loginCloudOrg);

cloudRouter.get('/auth/me', authMiddleware, async (req: CloudRequest, res) => {
  const result = await pool.query(
    'SELECT id, name, email, plan FROM cloud_orgs WHERE id = $1',
    [req.cloudOrg!.orgId],
  );
  if (result.rowCount === 0) {
    res.status(404).json({ error: 'Org not found' });
    return;
  }
  const row = result.rows[0];
  res.json({ org: { id: row.id, name: row.name, email: row.email, plan: row.plan } });
});

cloudRouter.get('/keys', authMiddleware, async (req: CloudRequest, res) => {
  const result = await pool.query(
    `SELECT id, provider, key_name, encrypted_value, created_at
     FROM cloud_byok_keys
     WHERE org_id = $1
     ORDER BY created_at DESC`,
    [req.cloudOrg!.orgId],
  );
  res.json({
    keys: result.rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      keyName: row.key_name,
      maskedValue: maskSecret(decryptSecret(String(row.encrypted_value), req.cloudOrg!.orgId)),
      createdAt: row.created_at,
    })),
  });
});

cloudRouter.post('/keys', authMiddleware, async (req: CloudRequest, res) => {
  const provider = String(req.body?.provider ?? '').trim().toLowerCase();
  const keyName = String(req.body?.keyName ?? provider).trim();
  const apiKey = String(req.body?.apiKey ?? '').trim();
  if (!provider || !apiKey) {
    res.status(400).json({ error: 'provider and apiKey required' });
    return;
  }
  const encrypted = encryptSecret(apiKey, req.cloudOrg!.orgId);
  const result = await pool.query(
    `INSERT INTO cloud_byok_keys (org_id, provider, key_name, encrypted_value)
     VALUES ($1, $2, $3, $4)
     RETURNING id, provider, key_name, created_at`,
    [req.cloudOrg!.orgId, provider, keyName, encrypted],
  );
  const row = result.rows[0];
  res.status(201).json({
    key: {
      id: row.id,
      provider: row.provider,
      keyName: row.key_name,
      maskedValue: maskSecret(apiKey),
      createdAt: row.created_at,
    },
  });
});

cloudRouter.delete('/keys/:id', authMiddleware, async (req: CloudRequest, res) => {
  await pool.query(
    'DELETE FROM cloud_byok_keys WHERE id = $1 AND org_id = $2',
    [req.params.id, req.cloudOrg!.orgId],
  );
  res.json({ ok: true });
});

cloudRouter.get('/billing', authMiddleware, async (req: CloudRequest, res) => {
  const orgResult = await pool.query(
    'SELECT plan, stripe_subscription_id FROM cloud_orgs WHERE id = $1',
    [req.cloudOrg!.orgId],
  );
  const plan = String(orgResult.rows[0]?.plan ?? 'free');
  const limits: Record<string, number | null> = {
    free: 50_000,
    starter: 500_000,
    team: null,
  };
  res.json({
    plan,
    limit: limits[plan] ?? 50_000,
    period: plan === 'free' ? 'day' : plan === 'starter' ? 'month' : 'unlimited',
    stripeConfigured: Boolean(config.hosted.stripeSecretKey),
  });
});

cloudRouter.post('/billing/checkout', authMiddleware, async (req: CloudRequest, res) => {
  const plan = String(req.body?.plan ?? '');
  const priceId = priceIdForPlan(plan);
  const stripe = getStripe();
  if (!stripe || !priceId) {
    res.status(503).json({ error: 'Stripe is not configured for this plan' });
    return;
  }
  const orgResult = await pool.query(
    'SELECT id, email, name, stripe_customer_id FROM cloud_orgs WHERE id = $1',
    [req.cloudOrg!.orgId],
  );
  const org = orgResult.rows[0];
  let customerId = org.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: String(org.email),
      name: String(org.name),
      metadata: { cloudOrgId: String(org.id) },
    });
    customerId = customer.id;
    await pool.query(
      'UPDATE cloud_orgs SET stripe_customer_id = $1 WHERE id = $2',
      [customerId, org.id],
    );
  }
  const appHost = `https://${config.hosted.appHost}`;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appHost}/billing?checkout=success`,
    cancel_url: `${appHost}/billing?checkout=cancel`,
    metadata: { cloudOrgId: String(org.id), plan },
  });
  res.json({ url: session.url });
});

cloudRouter.get('/scout/status', authMiddleware, async (req: CloudRequest, res) => {
  const orgResult = await pool.query('SELECT plan FROM cloud_orgs WHERE id = $1', [req.cloudOrg!.orgId]);
  const plan = String(orgResult.rows[0]?.plan ?? 'free');
  const pairing = await pool.query(
    'SELECT console_url, encrypted_api_key FROM cloud_scout_pairings WHERE org_id = $1',
    [req.cloudOrg!.orgId],
  );
  if (pairing.rowCount === 0) {
    res.json({ paired: false, plan, canPair: plan === 'team' });
    return;
  }
  const row = pairing.rows[0];
  res.json({
    paired: true,
    plan,
    consoleUrl: row.console_url,
    canPair: plan === 'team',
  });
});

cloudRouter.post('/scout/pair', authMiddleware, async (req: CloudRequest, res) => {
  const orgResult = await pool.query('SELECT plan FROM cloud_orgs WHERE id = $1', [req.cloudOrg!.orgId]);
  const plan = String(orgResult.rows[0]?.plan ?? 'free');
  if (plan !== 'team') {
    res.status(402).json({ error: 'Scout pairing requires the Team plan' });
    return;
  }
  const consoleUrl = String(req.body?.consoleUrl ?? '').trim().replace(/\/$/, '');
  const apiKey = String(req.body?.apiKey ?? '').trim();
  if (!consoleUrl || !apiKey) {
    res.status(400).json({ error: 'consoleUrl and apiKey required' });
    return;
  }
  const health = await fetch(`${consoleUrl}/api/health`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!health.ok) {
    res.status(400).json({ error: 'Could not verify Scout credentials' });
    return;
  }
  const encrypted = encryptSecret(apiKey, req.cloudOrg!.orgId);
  await pool.query(
    `INSERT INTO cloud_scout_pairings (org_id, console_url, encrypted_api_key)
     VALUES ($1, $2, $3)
     ON CONFLICT (org_id) DO UPDATE SET console_url = $2, encrypted_api_key = $3`,
    [req.cloudOrg!.orgId, consoleUrl, encrypted],
  );
  res.json({ ok: true, consoleUrl });
});

export function mountCloudWebhook(app: Express): void {
  app.post(
    '/api/cloud/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      const stripe = getStripe();
      const webhookSecret = config.hosted.stripeWebhookSecret;
      if (!stripe || !webhookSecret) {
        res.status(503).json({ error: 'Stripe not configured' });
        return;
      }
      const sig = req.headers['stripe-signature'];
      if (!sig) {
        res.status(400).json({ error: 'Missing stripe-signature header' });
        return;
      }
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
      } catch {
        res.status(400).json({ error: 'Webhook signature verification failed' });
        return;
      }
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const plan = session.metadata?.plan;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (plan && customerId) {
          await pool.query(
            `UPDATE cloud_orgs
             SET plan = $1, stripe_subscription_id = $2
             WHERE stripe_customer_id = $3`,
            [plan, subscriptionId ?? null, customerId],
          );
        }
      }
      if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        await pool.query(
          `UPDATE cloud_orgs SET plan = 'free', stripe_subscription_id = NULL WHERE stripe_customer_id = $1`,
          [customerId],
        );
      }
      res.json({ received: true });
    },
  );
}
