import { getWorkspaceContact } from '../email/workspace-contact.js';
import { provisionScoutTenant } from './scout-provisioning.js';
import { sendScoutWelcomeEmail } from './scout-welcome-email.js';
import { issueScoutApiKey } from './subscription-manager.js';
import {
  getAivaScoutWorkspace,
  listScoutRetryCandidates,
  markAivaScoutPending,
  storeAivaScoutCredentials,
} from './aiva-scout-store.js';

const RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000, 600_000, 1_800_000, 3_600_000];

function retryDelayMs(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)] ?? 3_600_000;
}

export async function provisionAivaScoutWorkspace(input: {
  workspaceId: string;
  tier?: string;
  email?: string;
}): Promise<{ status: string; scoutWorkspaceId?: string; dashboardUrl?: string }> {
  if (process.env.AIVA_SCOUT_BUNDLING_ENABLED === 'false') {
    return { status: 'disabled' };
  }

  const existing = await getAivaScoutWorkspace(input.workspaceId);
  if (existing?.scoutStatus === 'connected' && existing.scoutWorkspaceId) {
    return {
      status: 'connected',
      scoutWorkspaceId: existing.scoutWorkspaceId,
      dashboardUrl: existing.scoutDashboardUrl ?? undefined,
    };
  }

  const ownerEmail =
    input.email?.trim().toLowerCase() ||
    (await getWorkspaceContact(input.workspaceId))?.ownerEmail;
  if (!ownerEmail) {
    await markAivaScoutPending({
      workspaceId: input.workspaceId,
      nextRetryAt: new Date(Date.now() + retryDelayMs(existing?.scoutProvisionAttempts ?? 0)),
    });
    return { status: 'pending' };
  }

  const apiKey = issueScoutApiKey();
  const provisioned = await provisionScoutTenant({
    email: ownerEmail,
    tenantId: input.workspaceId,
    licenseKey: apiKey,
    plan: 'scout_pro',
  });

  if (provisioned?.accountId) {
    const scoutConsoleUrl =
      (process.env.SCOUT_CONSOLE_PUBLIC_URL || process.env.LABYRINTH_URL || 'https://console.labyrinthscout.com')
        .replace(/\/+$/, '');
    const dashboardUrl = `${scoutConsoleUrl}/dashboard`;
    await storeAivaScoutCredentials({
      workspaceId: input.workspaceId,
      scoutWorkspaceId: provisioned.accountId,
      scoutApiKey: apiKey,
      scoutDashboardUrl: dashboardUrl,
    });
    if (provisioned.setupToken) {
      void sendScoutWelcomeEmail({
        email: ownerEmail,
        setupToken: provisioned.setupToken,
        scoutConsoleUrl,
      }).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[aiva-scout] welcome email failed:', msg);
      });
    }
    console.log(`[aiva-scout] Provisioned workspace ${input.workspaceId}`);
    return {
      status: 'connected',
      scoutWorkspaceId: provisioned.accountId,
      dashboardUrl,
    };
  }

  await markAivaScoutPending({
    workspaceId: input.workspaceId,
    nextRetryAt: new Date(Date.now() + retryDelayMs(existing?.scoutProvisionAttempts ?? 0)),
  });
  return { status: 'pending' };
}

export async function retryPendingAivaScoutProvisioning(): Promise<number> {
  const candidates = await listScoutRetryCandidates();
  for (const row of candidates) {
    await provisionAivaScoutWorkspace({ workspaceId: row.workspaceId });
  }
  return candidates.length;
}

export function scheduleAivaScoutProvision(workspaceId: string, ownerEmail?: string): void {
  void provisionAivaScoutWorkspace({ workspaceId, email: ownerEmail }).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[aiva-scout] schedule provision failed:', msg);
  });
}
