import type { Request } from 'express';
import { getTenantScoutCredentials } from '../billing/tenant-scout.js';
import { reportHeartbeat } from '../security/scout-client.js';
import { runWithScoutContextAsync } from '../security/scout-context.js';
import { runWithToolExecutionContextAsync } from '../security/tool-execution-context.js';
import type { OrgRole } from '../hosted/org-types.js';

export async function runWithHostedScout<T>(req: Request, fn: () => Promise<T>): Promise<T> {
  const role = req.session?.hostedOrgRole as OrgRole | undefined;
  const withToolContext = () => runWithToolExecutionContextAsync({ orgRole: role }, fn);

  if (!req.hostedUser || req.hostedUser.tier !== 'pro') {
    return withToolContext();
  }
  const creds = await getTenantScoutCredentials(req.hostedUser.id, req.hostedUser.email);
  if (!creds) return withToolContext();
  return runWithScoutContextAsync(
    {
      apiKey: creds.apiKey,
      instanceId: creds.instanceId,
      instanceName: creds.instanceName,
    },
    withToolContext,
  );
}

export async function ensureHostedScoutHeartbeat(req: Request): Promise<void> {
  await runWithHostedScout(req, async () => {
    await reportHeartbeat();
  });
}
