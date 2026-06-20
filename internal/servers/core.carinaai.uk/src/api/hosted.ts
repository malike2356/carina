import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { Resend } from 'resend';
import Stripe from 'stripe';
import { config } from '../config/index.js';
import {
  confirmPasswordReset,
  checkHostedAccess,
  getUserByApiKey,
  getUserProfile,
  incrementMessageCount,
  initHostedDb,
  loginUser,
  registerUser,
  requestPasswordReset,
  setUserTier,
  verifyJwt,
} from './hosted-auth.js';

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Missing Bearer token' });
    return;
  }

  void (async () => {
    const jwtUser = verifyJwt(token);
    if (jwtUser) {
      const profile = await getUserProfile(jwtUser.userId);
      if (!profile) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      (req as Request & { carinaUser: { id: string; email: string; tier: string } }).carinaUser = {
        id: jwtUser.userId,
        email: profile.email,
        tier: profile.tier,
      };
      next();
      return;
    }

    const apiUser = await getUserByApiKey(token);
    if (!apiUser) {
      res.status(401).json({ error: 'Invalid API key or token' });
      return;
    }
    (req as Request & { carinaUser: { id: string; email: string; tier: string } }).carinaUser = {
      id: apiUser.id,
      email: apiUser.email,
      tier: apiUser.tier,
    };
    next();
  })();
}

async function sendWelcomeEmail(email: string, apiKey: string): Promise<void> {
  if (!config.resend.apiKey) return;
  const resend = new Resend(config.resend.apiKey);
  await resend.emails.send({
    from: config.resend.from,
    to: email,
    subject: 'Welcome to Carina',
    text: `Your Carina hosted account is ready.\n\nAPI key: ${apiKey}\n\nUse ${config.product.appUrl} to chat.`,
  });
}

export function mountHostedRoutes(app: Express): void {
  if (!config.hosted.enabled) return;

  const router = express.Router();
  router.use(express.json());

  router.post('/register', async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!email || password.length < 8) {
      res.status(400).json({ error: 'email and password (8+ chars) required' });
      return;
    }
    try {
      await initHostedDb();
      const { apiKey, userId } = await registerUser(email, password);
      await sendWelcomeEmail(email, apiKey);
      const login = await loginUser(email, password);
      res.status(201).json({ userId, apiKey, token: login?.token });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(409).json({ error: msg });
    }
  });

  router.post('/login', async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    await initHostedDb();
    const result = await loginUser(email, password);
    if (!result) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    res.json(result);
  });

  router.post('/forgot-password', async (req, res) => {
    await initHostedDb();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: 'email required' });
      return;
    }
    const protocol = req.protocol;
    const host = req.get('host') ?? config.hosted.appHost;
    await requestPasswordReset(email, `${protocol}://${host}`);
    res.json({ ok: true }); // always 200 to avoid email enumeration
  });

  router.post('/reset-password', async (req, res) => {
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

  router.get('/me', authMiddleware, async (req, res) => {
    const user = (req as Request & { carinaUser: { id: string } }).carinaUser;
    const profile = await getUserProfile(user.id);
    if (!profile) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ email: profile.email, apiKey: profile.apiKey, tier: profile.tier });
  });

  app.use('/api/auth', router);
}

export function mountStripeWebhook(app: Express): void {
  if (!config.hosted.stripeSecretKey) return;

  const stripe = new Stripe(config.hosted.stripeSecretKey);
  app.post(
    '/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const sig = req.headers['stripe-signature'];
      if (!sig || !config.hosted.stripeWebhookSecret) {
        res.status(400).send('Webhook not configured');
        return;
      }
      try {
        const event = stripe.webhooks.constructEvent(
          req.body as Buffer,
          sig,
          config.hosted.stripeWebhookSecret,
        );
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.metadata?.userId;
          if (userId) await setUserTier(userId, 'pro');
        }
        res.json({ received: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(400).send(msg);
      }
    },
  );
}

export async function checkHostedQuota(userId: string, tier: string): Promise<string | null> {
  const blocked = await checkHostedAccess(userId);
  if (blocked) return blocked;
  if (tier === 'pro') return null;
  const ok = await incrementMessageCount(userId);
  if (!ok) return 'Free tier limit: 100 messages/day. Upgrade to Pro for unlimited.';
  return null;
}
