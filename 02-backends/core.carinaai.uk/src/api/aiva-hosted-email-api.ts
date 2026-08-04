import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from 'express';
import express from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { getWorker } from '../workers/worker-store.js';
import {
  ensureHostedEmailAddressForWorker,
  getHostedEmailAddressForWorker,
  hostedEmailOperatorStatus,
} from '../ingestion/email/hosted-email-address.js';
import {
  processMailgunInbound,
  simulateHostedInboundTest,
} from '../ingestion/email/mailgun-inbound.js';
import { processCloudflareInbound } from '../ingestion/email/cloudflare-inbound.js';

export const aivaHostedEmailRouter: ExpressRouter = Router();
export const aivaHostedEmailInboundRouter: ExpressRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type HostedEmailRequest = Request & { workspaceId?: string };

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function resolveWorkspaceId(req: HostedEmailRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  const fromBody = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : '';
  return (fromHeader ?? fromBody ?? fromQuery)?.trim() || null;
}

function requireWorkspace(req: HostedEmailRequest, res: Response, next: NextFunction): void {
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    res.status(400).json({ error: 'Valid workspaceId is required' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

aivaHostedEmailRouter.use(requireCloudProxy);

aivaHostedEmailRouter.get(
  '/workers/:id/email-address',
  requireWorkspace,
  async (req: HostedEmailRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      if (!UUID_RE.test(workerId)) {
        res.status(400).json({ error: 'Invalid worker id' });
        return;
      }
      const worker = await getWorker(req.workspaceId!, workerId);
      if (!worker) {
        res.status(404).json({ error: 'Worker not found' });
        return;
      }

      let address = await getHostedEmailAddressForWorker(workerId);
      if (!address) {
        address = await ensureHostedEmailAddressForWorker({
          workspaceId: req.workspaceId!,
          workerId,
          workerName: worker.name,
        });
      }
      if (!address) {
        res.status(404).json({ error: 'Hosted email is disabled' });
        return;
      }

      res.json({
        address: address.address,
        status: address.status,
        provider: address.provider,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

aivaHostedEmailRouter.post(
  '/workers/:id/email-address/test',
  requireWorkspace,
  async (req: HostedEmailRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      if (!UUID_RE.test(workerId)) {
        res.status(400).json({ error: 'Invalid worker id' });
        return;
      }
      const worker = await getWorker(req.workspaceId!, workerId);
      if (!worker) {
        res.status(404).json({ error: 'Worker not found' });
        return;
      }

      let address = await getHostedEmailAddressForWorker(workerId);
      if (!address) {
        address = await ensureHostedEmailAddressForWorker({
          workspaceId: req.workspaceId!,
          workerId,
          workerName: worker.name,
        });
      }
      if (!address) {
        res.status(404).json({ error: 'Hosted email is disabled' });
        return;
      }

      const result = await simulateHostedInboundTest({
        workspaceId: req.workspaceId!,
        workerId,
        address: address.address,
      });

      if (result.status === 'error' && result.reason === 'simulated_inbound_disabled_in_production') {
        res.status(501).json({
          ok: false,
          error: 'Send a real email to this address to test in production.',
          address: address.address,
        });
        return;
      }

      res.json({
        ok: result.status === 'accepted',
        result: result.status,
        address: address.address,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

aivaHostedEmailRouter.get('/email/hosted/status', async (_req, res: Response) => {
  res.json(hostedEmailOperatorStatus());
});

const inboundBodyParser = [
  express.urlencoded({ extended: true, limit: '5mb' }),
  express.json({ limit: '5mb' }),
];

aivaHostedEmailInboundRouter.post(
  '/mailgun',
  ...inboundBodyParser,
  async (req: Request, res: Response) => {
    try {
      const body =
        req.body && typeof req.body === 'object'
          ? (req.body as Record<string, unknown>)
          : {};
      const result = await processMailgunInbound(body);

      if (result.status === 'unauthorized') {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
      if (result.status === 'error') {
        res.status(500).json({ error: result.reason });
        return;
      }
      // Unknown / blocked: 202 so Mailgun does not retry spam to random addresses.
      if (result.status === 'ignored' || result.status === 'blocked') {
        res.status(202).json({ ok: true, status: result.status, reason: result.reason });
        return;
      }
      res.status(200).json({
        ok: true,
        status: 'accepted',
        workspaceId: result.workspaceId,
        workerId: result.workerId,
      });
    } catch (err) {
      console.error(
        '[hosted-email] inbound webhook error:',
        err instanceof Error ? err.message : String(err),
      );
      res.status(500).json({ error: 'Inbound processing failed' });
    }
  },
);

aivaHostedEmailInboundRouter.post(
  '/cloudflare',
  ...inboundBodyParser,
  async (req: Request, res: Response) => {
    try {
      const body =
        req.body && typeof req.body === 'object'
          ? (req.body as Record<string, unknown>)
          : {};
      const result = await processCloudflareInbound(body, req.headers);

      if (result.status === 'unauthorized') {
        res.status(401).json({ error: 'Invalid inbound secret' });
        return;
      }
      if (result.status === 'error') {
        res.status(500).json({ error: result.reason });
        return;
      }
      // Unknown / blocked: 202 so Cloudflare does not retry spam to random addresses.
      if (result.status === 'ignored' || result.status === 'blocked') {
        res.status(202).json({ ok: true, status: result.status, reason: result.reason });
        return;
      }
      res.status(200).json({
        ok: true,
        status: 'accepted',
        workspaceId: result.workspaceId,
        workerId: result.workerId,
      });
    } catch (err) {
      console.error(
        '[hosted-email] cloudflare inbound webhook error:',
        err instanceof Error ? err.message : String(err),
      );
      res.status(500).json({ error: 'Inbound processing failed' });
    }
  },
);
