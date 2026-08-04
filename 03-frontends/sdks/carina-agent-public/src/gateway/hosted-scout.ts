import type { Request } from 'express';
import { getTenantScoutCredentials } from '../billing/tenant-scout.js';
import { reportHeartbeat } from '../security/scout-client.js';
import { runWithScoutContextAsync } from '../security/scout-context.js';

export async function runWithHostedScout<T>(req: Request, fn: () => Promise<T>): Promise<T> {
  if (!req.hostedUser || req.hostedUser.tier !== 'pro') {
    return fn();
  }
  const creds = await getTenantScoutCredentials(req.hostedUser.id, req.hostedUser.email);
  if (!creds) return fn();
  return runWithScoutContextAsync(
    {
      apiKey: creds.apiKey,
      instanceId: creds.instanceId,
      instanceName: creds.instanceName,
    },
    fn,
  );
}

export async function ensureHostedScoutHeartbeat(req: Request): Promise<void> {
  await runWithHostedScout(req, async () => {
    await reportHeartbeat();
  });
}
