import type { Express, Request, Response } from 'express';
import { getHostServiceStatus } from '../infrastructure/host-service.js';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import { listAgentDefinitions } from '../workspaces/agent-registry.js';
import {
  listPairedDevices,
  redactDevicesForApi,
  revokePairedDevice,
} from '../infrastructure/device-pairing.js';
import { reloadSecrets } from '../ops/secrets-reload.js';

export function mountControlRoutes(app: Express, version = '0.1.0'): void {
  app.get('/api/control/status', async (req: Request, res: Response) => {
    if (!isControlAuthorized(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const status = await getHostServiceStatus(version);
    res.json({ ok: true, host: status });
  });

  app.get('/api/control/agents', (req: Request, res: Response) => {
    if (!isControlAuthorized(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const agents = listAgentDefinitions().map((a) => ({
      id: a.id,
      name: a.name,
      default: Boolean(a.default),
      workspace: a.workspace,
      provider: a.provider,
      model: a.model,
    }));
    res.json({ agents });
  });

  app.get('/api/control/devices', (req: Request, res: Response) => {
    if (!isControlAuthorized(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json({ devices: redactDevicesForApi(listPairedDevices()) });
  });

  app.delete('/api/control/devices/:id', (req: Request, res: Response) => {
    if (!isControlAuthorized(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = String(req.params.id ?? '');
    const ok = revokePairedDevice(id);
    res.json({ ok });
  });

  app.post('/api/control/reload-secrets', async (req: Request, res: Response) => {
    if (!isControlAuthorized(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = await reloadSecrets({ overwrite: true, notifyGateway: false });
    res.json({ ok: true, reloaded: result.reloaded.length });
  });
}
