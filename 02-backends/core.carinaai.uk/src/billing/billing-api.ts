import express, { type Request, type Response, type NextFunction, type IRouter } from 'express';
import { loginUser, registerUser, verifyJwt, getUserProfile } from '../api/hosted-auth.js';
import { BILLING_PLANS, normalizePlanId, type BillingPlanId } from './plans.js';
import { StripeService } from './stripe-service.js';
import { SubscriptionManager } from './subscription-manager.js';
import { UsageMeter } from './usage-meter.js';
import { InvoiceGenerator } from './invoice-generator.js';

type BillingRequest = Request & { tenant?: { id: string; email: string } };

function asPlan(value: unknown): BillingPlanId {
  const plan = normalizePlanId(value);
  return plan === 'free' ? 'scout_pro' : plan;
}

export class BillingApi {
  readonly router: IRouter = express.Router();

  constructor(
    private readonly stripeService = new StripeService(),
    private readonly subscriptions = new SubscriptionManager(stripeService),
    private readonly usage = new UsageMeter(),
    private readonly invoices = new InvoiceGenerator(),
  ) {
    this.router.use(express.json());
    this.router.post('/checkout/session', (req, res) => void this.createCheckout(req, res));
    this.router.post('/checkout/activate-session', (req, res) => void this.activateCheckoutSession(req, res));
    this.router.get('/plans', (_req, res) => res.json({ plans: Object.values(BILLING_PLANS) }));
    this.router.get('/subscription', this.auth, (req, res) => void this.getSubscription(req as BillingRequest, res));
    this.router.post('/cancel', this.auth, (req, res) => void this.cancel(req as BillingRequest, res));
    this.router.post('/reactivate', this.auth, (req, res) => void this.reactivate(req as BillingRequest, res));
    this.router.get('/usage', this.auth, (req, res) => void this.getUsage(req as BillingRequest, res));
    this.router.get('/invoices', this.auth, (req, res) => void this.listInvoices(req as BillingRequest, res));
    this.router.get('/invoices/:id', this.auth, (req, res) => void this.getInvoice(req as BillingRequest, res));
  }

  private auth = async (req: BillingRequest, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const jwt = token ? verifyJwt(token) : null;
    if (!jwt) {
      res.status(401).json({ error: 'Missing or invalid Bearer token' });
      return;
    }
    req.tenant = { id: jwt.userId, email: jwt.email };
    next();
  };

  private async createCheckout(req: Request, res: Response): Promise<void> {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const plan = asPlan(req.body?.plan);
    const successUrl = String(req.body?.successUrl ?? req.body?.success_url ?? 'http://localhost:3000/billing/success');
    const cancelUrl = String(req.body?.cancelUrl ?? req.body?.cancel_url ?? 'http://localhost:3000/checkout');
    if (!email || password.length < 8) {
      res.status(400).json({ error: 'email and password (8+ chars) required' });
      return;
    }
    const registered = await registerUser(email, password).catch(async () => {
      const login = await loginUser(email, password);
      if (!login) throw new Error('Account already exists');
      const jwt = verifyJwt(login.token);
      if (!jwt) throw new Error('Login failed');
      return { userId: jwt.userId, apiKey: login.apiKey };
    });
    try {
      const session = await this.stripeService.createCheckoutSession({
        tenantId: registered.userId,
        email,
        plan,
        successUrl,
        cancelUrl,
      });
      res.status(201).json({ id: session.id, url: session.url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('STRIPE_SECRET_KEY') || msg.includes('Missing required env var')) {
        res.status(503).json({
          error: 'Checkout is not yet available. Email contact@verlox.uk to subscribe.',
        });
        return;
      }
      if (msg.includes('Missing required env var: STRIPE_PRICE')) {
        res.status(503).json({
          error: 'Checkout is not yet available. Email contact@verlox.uk to subscribe.',
        });
        return;
      }
      console.error('[carina:billing] checkout session failed:', msg);
      res.status(500).json({ error: 'Checkout failed' });
    }
  }

  private async activateCheckoutSession(req: Request, res: Response): Promise<void> {
    const sessionId = String(req.body?.sessionId ?? req.body?.session_id ?? '').trim();
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId required' });
      return;
    }
    try {
      const session = await this.stripeService.getCheckoutSession(sessionId);
      if (session.payment_status !== 'paid') {
        res.status(400).json({ error: 'Payment not completed' });
        return;
      }
      const tenantId = session.metadata?.tenantId;
      if (!tenantId) {
        res.status(400).json({ error: 'Invalid checkout session' });
        return;
      }
      const existing = await this.subscriptions.getSubscription(tenantId);
      if (!existing || existing.status !== 'active') {
        await this.subscriptions.syncFromCheckoutSession(session);
      }
      res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('STRIPE_SECRET_KEY') || msg.includes('Missing required env var')) {
        res.status(503).json({
          error: 'Checkout is not yet available. Email contact@verlox.uk to subscribe.',
        });
        return;
      }
      console.error('[carina:billing] activate session failed:', msg);
      res.status(500).json({ error: 'Could not verify payment' });
    }
  }

  private async getSubscription(req: BillingRequest, res: Response): Promise<void> {
    const tenant = req.tenant;
    if (!tenant) return;
    const subscription = await this.subscriptions.getSubscription(tenant.id);
    res.json(subscription ?? { plan: 'free', status: 'active', next_invoice: null });
  }

  private async cancel(req: BillingRequest, res: Response): Promise<void> {
    const tenant = req.tenant;
    if (!tenant) return;
    res.json({ subscription: await this.subscriptions.cancel(tenant.id) });
  }

  private async reactivate(req: BillingRequest, res: Response): Promise<void> {
    const tenant = req.tenant;
    if (!tenant) return;
    res.json({ subscription: await this.subscriptions.reactivate(tenant.id) });
  }

  private async getUsage(req: BillingRequest, res: Response): Promise<void> {
    const tenant = req.tenant;
    if (!tenant) return;
    const profile = await getUserProfile(tenant.id);
    const sub = await this.subscriptions.getSubscription(tenant.id);
    const plan = sub?.plan ?? (profile?.tier === 'pro' ? 'scout_pro' : 'free');
    res.json(await this.usage.status(tenant.id, plan));
  }

  private async listInvoices(req: BillingRequest, res: Response): Promise<void> {
    const tenant = req.tenant;
    if (!tenant) return;
    res.json({ invoices: await this.invoices.listInvoices(tenant.id) });
  }

  private async getInvoice(req: BillingRequest, res: Response): Promise<void> {
    const tenant = req.tenant;
    if (!tenant) return;
    const invoice = await this.invoices.getInvoice(tenant.id, String(req.params.id));
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    if (invoice.pdf_url) {
      res.redirect(invoice.pdf_url);
      return;
    }
    res.json({ invoice });
  }
}
