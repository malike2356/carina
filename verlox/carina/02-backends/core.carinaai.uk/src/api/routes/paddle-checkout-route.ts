import express, {
  type Express,
  type IRouter,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { createPaddleCheckoutSession } from '../../billing/paddle/paddle-checkout.js';
import { aivaAppUrl } from '../../email/workspace-contact.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PaddleCheckoutRequest = Request & { workspaceId?: string };

const router: IRouter = express.Router();
router.use(express.json());

function resolveWorkspaceId(req: PaddleCheckoutRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromBody = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : '';
  return (fromHeader ?? fromBody)?.trim() || null;
}

function requireWorkspace(req: PaddleCheckoutRequest, res: Response, next: NextFunction): void {
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required (X-Workspace-Id header or body)' });
    return;
  }
  if (!UUID_RE.test(workspaceId)) {
    res.status(400).json({ error: 'Invalid workspaceId' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

function billingErrorStatus(message: string): number {
  if (
    message.includes('not configured')
    || message.includes('Paddle price not configured')
    || message.includes('Paddle SDK is not installed')
  ) {
    return 503;
  }
  return 500;
}

router.post('/api/billing/paddle/checkout', requireWorkspace, async (req: PaddleCheckoutRequest, res: Response) => {
  try {
    const interval = req.body?.interval === 'year' ? 'year' : 'month';
    const successUrl = String(req.body?.successUrl ?? `${aivaAppUrl('/billing/aiva')}?checkout=success`);
    const cancelUrl = String(req.body?.cancelUrl ?? `${aivaAppUrl('/billing/aiva')}?checkout=cancel`);
    const customerEmail = typeof req.body?.email === 'string' ? req.body.email : undefined;
    const session = await createPaddleCheckoutSession({
      workspaceId: req.workspaceId!,
      interval,
      successUrl,
      cancelUrl,
      customerEmail,
    });
    res.json({ checkoutUrl: session.checkoutUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(billingErrorStatus(msg)).json({ error: msg });
  }
});

export function mountPaddleCheckoutRoute(app: Express): void {
  app.use(router);
}

export default router;
