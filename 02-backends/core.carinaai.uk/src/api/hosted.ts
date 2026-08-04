import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { Resend } from 'resend';
import Stripe from 'stripe';
import { config } from '../config/index.js';
import { rateLimitMiddleware } from '../security/redis-rate-limit.js';
import { recordAuthAuditEvent, checkSuspiciousLogin } from '../security/auth-hardening.js';
import { checkAuthRateLimit, recordAuthFailure, clearAuthFailures } from '../security/auth-rate-limit.js';
import {
  getUserByApiKey,
  getUserProfile,
  incrementMessageCount,
  initHostedDb,
  loginUser,
  registerUser,
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
    text: `Your Carina hosted account is ready.\n\nAPI key: ${apiKey}\n\nUse app.carinaai.uk to chat.`,
  });
}

export function mountHostedRoutes(app: Express): void {
  if (!config.hosted.enabled) return;

  const router = express.Router();
  router.use(express.json());

  router.post('/register', rateLimitMiddleware('signup'), async (req, res) => {
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
      recordAuthAuditEvent({ action: 'signup', detail: 'hosted API signup', userId, email, ip: req.ip });
      res.status(201).json({ userId, apiKey, token: login?.token });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(409).json({ error: msg });
    }
  });

  router.post('/login', rateLimitMiddleware('login'), async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const ip = String(req.ip ?? 'unknown');
    const bruteForceKey = `${email}:${ip}`;
    const lockState = await checkAuthRateLimit('hosted-api-login', bruteForceKey);
    if (!lockState.allowed) {
      const retryAfterSeconds = Math.ceil(lockState.retryAfterMs / 1000);
      recordAuthAuditEvent({ action: 'login_blocked', detail: 'hosted API login blocked by brute-force lockout', email, ip });
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({ error: 'too_many_attempts', retry_after_seconds: retryAfterSeconds });
      return;
    }
    const result = await loginUser(email, password);
    if (!result) {
      await recordAuthFailure('hosted-api-login', bruteForceKey);
      recordAuthAuditEvent({ action: 'login_failed', detail: 'hosted API login failed', email, ip });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    await clearAuthFailures('hosted-api-login', bruteForceKey);
    const jwtUser = verifyJwt(result.token);
    if (jwtUser) {
      await checkSuspiciousLogin(jwtUser.userId, ip, String(req.headers['user-agent'] ?? ''));
    }
    recordAuthAuditEvent({ action: 'login_success', detail: 'hosted API login succeeded', userId: jwtUser?.userId, email, ip });
    res.json(result);
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
    rateLimitMiddleware('webhook', { keyFn: (req) => `ip:${req.ip ?? 'unknown'}` }),
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
  if (tier === 'pro') return null;
  const ok = await incrementMessageCount(userId);
  if (!ok) return 'Free tier limit: 100 messages/day. Upgrade to Pro for unlimited.';
  return null;
}
