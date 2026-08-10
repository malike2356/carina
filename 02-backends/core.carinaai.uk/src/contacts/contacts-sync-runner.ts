import { syncGoogleContacts } from '../integrations/contacts-google.js';
import {
  getWorkspaceGoogleCredentials,
  listWorkspaceIdsWithGoogleCredentials,
  workspaceHasGoogleAccount,
} from '../workers/product-tools/accounts.js';
import {
  ensureDefaultContactsSyncSchedule,
  getContactsSyncSchedule,
  isContactsSyncDue,
  listEnabledContactsSyncSchedules,
  recordContactsSyncRun,
  type ContactsSyncLastResult,
  type ContactsSyncSchedule,
} from './contacts-sync-schedule-store.js';

export type WorkspaceContactsSyncOutcome = ContactsSyncLastResult & {
  imported: number;
  skipped: number;
};

async function resolveRefreshToken(workspaceId: string): Promise<{
  refreshToken?: string;
  accessToken?: string;
  error?: string;
  code?: string;
}> {
  const account = await getWorkspaceGoogleCredentials(workspaceId).catch(() => null);
  if (account?.credentials.refresh_token) {
    return { refreshToken: account.credentials.refresh_token };
  }
  if (account?.credentials.access_token) {
    return { accessToken: account.credentials.access_token };
  }
  return {
    error: 'Connect Google in Tools first (Gmail, Drive, or Calendar), then sync contacts.',
    code: 'google_not_connected',
  };
}

/** Run a Google Contacts pull for one workspace and record last_result. */
export async function runWorkspaceContactsSync(
  workspaceId: string,
): Promise<WorkspaceContactsSyncOutcome> {
  const auth = await resolveRefreshToken(workspaceId);
  if (auth.error) {
    const result: ContactsSyncLastResult = {
      ok: false,
      error: auth.error,
      at: new Date().toISOString(),
    };
    await recordContactsSyncRun(workspaceId, result).catch(() => undefined);
    return { ...result, imported: 0, skipped: 0 };
  }

  const sync = await syncGoogleContacts(auth.accessToken ?? '', workspaceId, {
    refreshToken: auth.refreshToken,
  });
  const failed = sync.errors.length > 0 && sync.imported === 0;
  const result: ContactsSyncLastResult = failed
    ? {
        ok: false,
        imported: sync.imported,
        skipped: sync.skipped,
        error: sync.errors[0] ?? 'Google sync failed',
        at: new Date().toISOString(),
      }
    : {
        ok: true,
        imported: sync.imported,
        skipped: sync.skipped,
        at: new Date().toISOString(),
      };
  await recordContactsSyncRun(workspaceId, result).catch(() => undefined);
  return { ...result, imported: sync.imported, skipped: sync.skipped };
}

export async function seedDefaultSchedulesForGoogleWorkspaces(): Promise<number> {
  const ids = await listWorkspaceIdsWithGoogleCredentials().catch(() => [] as string[]);
  let seeded = 0;
  for (const workspaceId of ids) {
    await ensureDefaultContactsSyncSchedule(workspaceId);
    seeded += 1;
  }
  return seeded;
}

export async function sweepDueContactsSyncSchedules(): Promise<{
  checked: number;
  ran: number;
  failures: number;
}> {
  await seedDefaultSchedulesForGoogleWorkspaces().catch(() => 0);
  const schedules = await listEnabledContactsSyncSchedules();
  let ran = 0;
  let failures = 0;
  for (const schedule of schedules) {
    if (!isContactsSyncDue(schedule)) continue;
    const hasGoogle = await workspaceHasGoogleAccount(schedule.workspaceId).catch(() => false);
    if (!hasGoogle) continue;
    const outcome = await runWorkspaceContactsSync(schedule.workspaceId);
    ran += 1;
    if (!outcome.ok) failures += 1;
  }
  return { checked: schedules.length, ran, failures };
}

export async function getScheduleStatus(workspaceId: string): Promise<
  ContactsSyncSchedule & { configured: boolean; configuredReason?: string }
> {
  const { credentialsConfigured } = await import('../channels/credential-store.js');
  if (!credentialsConfigured()) {
    const schedule = await getContactsSyncSchedule(workspaceId);
    return {
      ...schedule,
      configured: false,
      configuredReason: 'credential_key_missing',
    };
  }
  const [schedule, configured] = await Promise.all([
    getContactsSyncSchedule(workspaceId),
    workspaceHasGoogleAccount(workspaceId).catch(() => false),
  ]);
  return {
    ...schedule,
    configured,
    configuredReason: configured ? undefined : 'google_not_connected',
  };
}
