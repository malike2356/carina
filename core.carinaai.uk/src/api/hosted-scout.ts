import express, { type Express, type Request, type Response } from 'express';
import {
  getTenantScoutCredentials,
  getTenantScoutSubscription,
  maskScoutKey,
  scoutServiceUrl,
} from '../billing/tenant-scout.js';

async function scoutFetch(path: string, apiKey: string): Promise<globalThis.Response> {
  const base = scoutServiceUrl();
  return fetch(`${base}${path}`, {
    headers: { 'X-Scout-Key': apiKey },
    signal: AbortSignal.timeout(8000),
  });
}

export function mountHostedScoutRoutes(app: Express): void {
  const router = express.Router();

  router.get('/status', async (req: Request, res: Response) => {
    const accountId = req.session?.hostedAccountId;
    if (!accountId) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    const profile = await import('./hosted-auth.js').then((m) => m.getUserProfile(accountId));
    if (!profile) {
      res.status(401).json({ error: 'Account not found' });
      return;
    }

    const sub = await getTenantScoutSubscription(accountId);
    const creds = await getTenantScoutCredentials(accountId, profile.email);
    const scoutUrl = scoutServiceUrl();

    if (!sub || !creds) {
      res.json({
        active: false,
        tier: profile.tier,
        plan: sub?.plan ?? null,
        status: sub?.status ?? null,
        scoutUrl,
        dashboardUrl: '/dashboard',
        instances: [],
        events: [],
      });
      return;
    }

    let instances: unknown[] = [];
    let events: unknown[] = [];

    try {
      const [instRes, evtRes] = await Promise.all([
        scoutFetch('/api/dashboard/agent-status', creds.apiKey),
        scoutFetch('/api/events?limit=20', creds.apiKey),
      ]);
      if (instRes.ok) {
        const data = (await instRes.json()) as { agents?: unknown[] };
        instances = data.agents ?? [];
      }
      if (evtRes.ok) {
        const data = (await evtRes.json()) as { events?: unknown[] };
        events = data.events ?? [];
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[hosted-scout] Scout fetch failed:', msg);
    }

    res.json({
      active: true,
      tier: profile.tier,
      plan: sub.plan,
      status: sub.status,
      scoutKeyMasked: maskScoutKey(creds.apiKey),
      instanceId: creds.instanceId,
      scoutUrl,
      dashboardUrl: '/dashboard',
      consoleAccountUrl: scoutUrl ? `${scoutUrl}/account` : null,
      instances,
      events,
    });
  });

  router.get('/key', async (req: Request, res: Response) => {
    const accountId = req.session?.hostedAccountId;
    if (!accountId) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    const profile = await import('./hosted-auth.js').then((m) => m.getUserProfile(accountId));
    if (!profile || profile.tier !== 'pro') {
      res.status(403).json({ error: 'Scout requires a Pro subscription' });
      return;
    }
    const creds = await getTenantScoutCredentials(accountId, profile.email);
    if (!creds) {
      res.status(404).json({ error: 'Scout is not provisioned yet. Wait for billing webhook or contact support.' });
      return;
    }
    res.json({
      apiKey: creds.apiKey,
      instanceId: creds.instanceId,
      envSnippet: [
        'LABYRINTH_ENABLED=true',
        `LABYRINTH_URL=${scoutServiceUrl() || 'https://console.labyrinthscout.com'}`,
        `LABYRINTH_API_KEY=${creds.apiKey}`,
        `LABYRINTH_INSTANCE_ID=${creds.instanceId}`,
        `LABYRINTH_INSTANCE_NAME=${creds.instanceName}`,
      ].join('\n'),
    });
  });

  app.use('/app/auth/scout', router);
}
