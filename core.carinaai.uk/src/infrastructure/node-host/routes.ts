import type { Express, Request, Response } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import os from 'os';
import { requireControlScope } from '../control-auth.js';
import { appendNodeAudit } from './audit.js';
import { decodeFilePayload, encodeFilePayload, maxNodeFileBytes } from './file-transfer.js';
import { buildNodePairQrPayload, encodeQrPayload, formatPairingQrTerminal } from './qr.js';
import { evaluateNodeShellCommand } from '../../security/node-command-policy.js';
import { evaluateNodeFilePath } from '../../security/node-file-policy.js';
import { pushNodeCommand } from './node-ws-hub.js';
import {
  addPendingPairing,
  claimApprovedNodePairing,
  approvePendingPairing,
  completeNodeCommand,
  enqueueNodeCommand,
  generateNodeToken,
  getPendingPairing,
  getPairedNode,
  listPairedNodes,
  listPendingPairings,
  pollNodeCommands,
  redactNodesForApi,
  removePendingPairing,
  revokePairedNode,
  rotateNodeToken,
  validateNodeToken,
  getNodeCommand,
} from './store.js';

export function nodeHostRoutesEnabled(): boolean {
  return process.env.CARINA_NODE_HOST_ENABLED === 'true';
}

function nodeBearer(req: Request): string {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function requireNodeAuth(req: Request, res: Response) {
  const node = validateNodeToken(nodeBearer(req));
  if (!node) {
    res.status(401).json({ error: 'Unauthorized node token' });
    return null;
  }
  return node;
}

const pairLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many pairing attempts' },
});

export function mountNodeHostRoutes(app: Express): void {
  if (!nodeHostRoutesEnabled()) return;

  app.post('/api/nodes/pair/request', pairLimiter, (req: Request, res: Response) => {
    const name = String(req.body?.name ?? os.hostname()).trim();
    const hostname = String(req.body?.hostname ?? os.hostname()).trim();
    const platform = String(req.body?.platform ?? process.platform).trim();
    const pending = addPendingPairing({ name, hostname, platform });
    const gatewayUrl = `${req.protocol}://${req.get('host')}`;
    const qr = buildNodePairQrPayload({
      gatewayUrl,
      pendingId: pending.id,
      code: pending.code,
      name: pending.name,
    });
    appendNodeAudit({ action: 'pair.request', nodeId: pending.id, detail: pending.name });
    res.json({
      pendingId: pending.id,
      code: pending.code,
      expiresAt: pending.expiresAt,
      qr: encodeQrPayload(qr),
      qrTerminal: formatPairingQrTerminal(qr),
    });
  });

  app.post('/api/nodes/pair/claim', pairLimiter, (req: Request, res: Response) => {
    const pendingId = String(req.body?.pendingId ?? req.body?.id ?? '');
    const code = String(req.body?.code ?? '').trim();
    if (!pendingId || !code) {
      res.status(400).json({ error: 'pendingId and code are required' });
      return;
    }
    const stillPending = getPendingPairing(pendingId);
    if (stillPending) {
      res.json({ status: 'pending', expiresAt: stillPending.expiresAt });
      return;
    }
    const claimed = claimApprovedNodePairing(pendingId, code);
    if (!claimed) {
      res.status(400).json({ error: 'Invalid claim or pairing not approved' });
      return;
    }
    appendNodeAudit({ action: 'pair.claim', nodeId: claimed.nodeId });
    res.json({
      ok: true,
      status: 'approved',
      nodeId: claimed.nodeId,
      token: claimed.token,
      name: claimed.name,
    });
  });

  app.get('/api/nodes/pair/pending', (req: Request, res: Response) => {
    if (!requireControlScope(req, res, 'nodes')) return;
    res.json({ pending: listPendingPairings() });
  });

  app.get('/api/nodes/pair/claim-info', (req: Request, res: Response) => {
    const pendingId = String(req.query.pending ?? '');
    const pending = getPendingPairing(pendingId);
    if (!pending) {
      res.status(404).json({ error: 'Pending pairing not found or expired' });
      return;
    }
    res.json({
      pendingId: pending.id,
      name: pending.name,
      hostname: pending.hostname,
      platform: pending.platform,
      expiresAt: pending.expiresAt,
      status: 'pending',
    });
  });

  app.post('/api/nodes/pair/approve', (req: Request, res: Response) => {
    if (!requireControlScope(req, res, 'nodes')) return;
    const pendingId = String(req.body?.pendingId ?? req.body?.id ?? '');
    const pending = getPendingPairing(pendingId);
    if (!pending) {
      res.status(404).json({ error: 'Pending pairing not found' });
      return;
    }
    const node = approvePendingPairing(pendingId);
    if (!node) {
      res.status(404).json({ error: 'Pending pairing not found' });
      return;
    }
    appendNodeAudit({ action: 'pair.approve', nodeId: pendingId, detail: pending.name });
    res.json({
      ok: true,
      nodeId: node.id,
      node: redactNodesForApi([node])[0],
      message: 'Approved. Remote node must run pair-wait with the original pairing code to claim credentials.',
    });
  });

  app.post('/api/nodes/pair/reject', (req: Request, res: Response) => {
    if (!requireControlScope(req, res, 'nodes')) return;
    const pendingId = String(req.body?.pendingId ?? req.body?.id ?? '');
    const ok = removePendingPairing(pendingId);
    if (ok) appendNodeAudit({ action: 'pair.reject', nodeId: pendingId });
    res.json({ ok });
  });

  app.get('/api/nodes', (req: Request, res: Response) => {
    if (!requireControlScope(req, res, 'nodes')) return;
    res.json({ nodes: redactNodesForApi(listPairedNodes()) });
  });

  app.post('/api/nodes/:id/revoke', (req: Request, res: Response) => {
    if (!requireControlScope(req, res, 'nodes')) return;
    const ok = revokePairedNode(String(req.params.id));
    if (ok) appendNodeAudit({ action: 'node.revoke', nodeId: String(req.params.id) });
    res.json({ ok });
  });

  app.post('/api/nodes/:id/rotate', (req: Request, res: Response) => {
    if (!requireControlScope(req, res, 'nodes')) return;
    const rotated = rotateNodeToken(String(req.params.id));
    if (!rotated) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    appendNodeAudit({ action: 'node.rotate', nodeId: rotated.node.id });
    res.json({ ok: true, nodeId: rotated.node.id, token: rotated.token });
  });

  app.post('/api/nodes/heartbeat', (req: Request, res: Response) => {
    const node = requireNodeAuth(req, res);
    if (!node) return;
    res.json({ ok: true, nodeId: node.id });
  });

  app.get('/api/nodes/commands/poll', (req: Request, res: Response) => {
    const node = requireNodeAuth(req, res);
    if (!node) return;
    res.json({ commands: pollNodeCommands(node.id) });
  });

  app.get('/api/nodes/commands/:id', (req: Request, res: Response) => {
    if (!requireControlScope(req, res, 'nodes')) return;
    const cmd = getNodeCommand(String(req.params.id));
    if (!cmd) {
      res.status(404).json({ error: 'Command not found' });
      return;
    }
    res.json({ command: cmd });
  });

  app.post('/api/nodes/commands/:id/complete', express.json(), (req: Request, res: Response) => {
    const node = requireNodeAuth(req, res);
    if (!node) return;
    const ok = completeNodeCommand(
      String(req.params.id),
      node.id,
      req.body?.result,
      req.body?.error ? String(req.body.error) : undefined,
    );
    if (!ok) {
      res.status(404).json({ error: 'Command not found' });
      return;
    }
    appendNodeAudit({ action: 'command.complete', nodeId: node.id, detail: String(req.params.id) });
    res.json({ ok: true });
  });

  app.post('/api/nodes/:id/command', express.json(), (req: Request, res: Response) => {
    if (!requireControlScope(req, res, 'nodes')) return;
    const nodeId = String(req.params.id);
    if (!getPairedNode(nodeId)) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const type = String(req.body?.type ?? 'shell') as 'shell' | 'file.push' | 'file.pull' | 'ping';
    const payload = (req.body?.payload && typeof req.body.payload === 'object')
      ? req.body.payload as Record<string, unknown>
      : { command: String(req.body?.command ?? '') };

    if (type === 'file.push' && payload.contentBase64) {
      try {
        decodeFilePayload(String(payload.contentBase64));
      } catch (err) {
        res.status(413).json({ error: err instanceof Error ? err.message : String(err) });
        return;
      }
      const pathDecision = evaluateNodeFilePath(String(payload.path ?? ''));
      if (!pathDecision.allowed) {
        appendNodeAudit({ action: 'command.blocked', nodeId, detail: pathDecision.reason });
        res.status(403).json({ error: pathDecision.reason, code: 'NODE_FILE_BLOCKED' });
        return;
      }
      payload.path = pathDecision.resolved;
    }

    if (type === 'file.pull') {
      const pathDecision = evaluateNodeFilePath(String(payload.path ?? ''));
      if (!pathDecision.allowed) {
        appendNodeAudit({ action: 'command.blocked', nodeId, detail: pathDecision.reason });
        res.status(403).json({ error: pathDecision.reason, code: 'NODE_FILE_BLOCKED' });
        return;
      }
      payload.path = pathDecision.resolved;
    }

    if (type === 'shell') {
      const command = String(payload.command ?? '');
      const decision = evaluateNodeShellCommand(command);
      if (!decision.allowed) {
        appendNodeAudit({ action: 'command.blocked', nodeId, detail: decision.reason });
        res.status(403).json({ error: decision.reason, code: 'NODE_SHELL_BLOCKED' });
        return;
      }
    }

    const cmd = enqueueNodeCommand(nodeId, type, payload);
    const pushed = pushNodeCommand(nodeId, cmd);
    appendNodeAudit({ action: 'command.dispatch', nodeId, detail: `${type}:${cmd.id}${pushed ? ':ws' : ':poll'}` });
    res.json({ ok: true, command: cmd, transport: pushed ? 'ws' : 'poll' });
  });

  app.get('/api/nodes/config/limits', (_req: Request, res: Response) => {
    res.json({ maxFileBytes: maxNodeFileBytes() });
  });
}

export function dispatchNodeShellCommand(nodeId: string, command: string) {
  const cmd = enqueueNodeCommand(nodeId, 'shell', { command });
  pushNodeCommand(nodeId, cmd);
  return cmd;
}

export function dispatchNodeFilePush(nodeId: string, targetPath: string, content: Buffer) {
  const encoded = encodeFilePayload(content);
  const cmd = enqueueNodeCommand(nodeId, 'file.push', {
    path: targetPath,
    contentBase64: encoded.contentBase64,
    size: encoded.size,
  });
  pushNodeCommand(nodeId, cmd);
  return cmd;
}

export function dispatchNodeFilePull(nodeId: string, targetPath: string) {
  const cmd = enqueueNodeCommand(nodeId, 'file.pull', { path: targetPath });
  pushNodeCommand(nodeId, cmd);
  return cmd;
}
