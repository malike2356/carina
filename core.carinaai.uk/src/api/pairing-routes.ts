import type { Express, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  claimPairing,
  createPairingCode,
  getPendingPairing,
} from '../infrastructure/device-pairing.js';
import {
  acceptPairingToken,
  listPairDevicesForApi,
  revokePairDevice,
} from '../pairing/pairing.js';
import { isControlAuthorized } from '../infrastructure/control-auth.js';

const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many pairing attempts' },
});

export function mountPairingRoutes(app: Express): void {
  app.post('/api/pairing/claim', claimLimiter, (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '').trim();
    const name = String(req.body?.name ?? req.body?.deviceName ?? 'Mobile device').trim();
    const platform = String(req.body?.platform ?? req.body?.devicePlatform ?? 'unknown').trim();
    if (!code) {
      res.status(400).json({ error: 'code is required' });
      return;
    }
    try {
      const result = claimPairing({ code, name, platform });
      res.json({
        ok: true,
        deviceId: result.deviceId,
        token: result.token,
        name: result.name,
        platform: result.platform,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/pairing/code', (req: Request, res: Response) => {
    if (!isControlAuthorized(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const pending = createPairingCode();
    res.json({
      code: pending.code,
      expiresAt: pending.expiresAt,
      expiresInMinutes: 15,
    });
  });

  app.get('/api/pairing/pending', (req: Request, res: Response) => {
    if (!isControlAuthorized(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const pending = getPendingPairing();
    if (!pending) {
      res.json({ pending: null });
      return;
    }
    res.json({ pending: { expiresAt: pending.expiresAt } });
  });

  app.post('/api/pair/accept', claimLimiter, (req: Request, res: Response) => {
    const token = String(req.body?.token ?? '').trim();
    const deviceName = String(req.body?.deviceName ?? req.body?.name ?? 'Paired device').trim();
    if (!token) {
      res.status(400).json({ error: 'token is required' });
      return;
    }
    try {
      const result = acceptPairingToken(token, deviceName);
      res.json({
        deviceId: result.deviceId,
        status: result.status,
        token: result.token,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/pair/devices', (req: Request, res: Response) => {
    if (!isControlAuthorized(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json(listPairDevicesForApi());
  });

  app.delete('/api/pair/devices/:id', (req: Request, res: Response) => {
    if (!isControlAuthorized(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = String(req.params.id ?? '');
    const ok = revokePairDevice(id);
    if (!ok) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }
    res.status(204).send();
  });
}
