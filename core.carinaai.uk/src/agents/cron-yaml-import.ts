import type { CronJobYamlEntry } from './cron-job-types.js';
import { parseCronYamlEntry } from './cron-yaml-parser.js';
import {
  createJob,
  listJobs,
  parseSchedule,
  registerJob,
  updateJob,
  type ScheduledJob,
} from './cron-scheduler.js';

function normalizeContextFrom(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return [String(raw)];
}

export function parseCronYamlEntryFromDoc(raw: Record<string, unknown>): CronJobYamlEntry {
  return parseCronYamlEntry(raw);
}

function entryToJobInput(entry: CronJobYamlEntry): Omit<ScheduledJob, 'id' | 'lastRun' | 'nextRun' | 'createdAt' | 'status' | 'failureCount'> & { status?: ScheduledJob['status'] } {
  const scriptConfig = entry.scriptConfig
    ?? (entry.script ? { script: entry.script } : null);

  return {
    name: entry.id ?? entry.name,
    schedule: entry.schedule,
    prompt: entry.prompt ?? null,
    scriptPath: null,
    scriptConfig,
    noAgent: Boolean(entry.noAgent),
    deliver: entry.deliver ?? 'local',
    repeatCount: null,
    runsRemaining: null,
    contextFrom: normalizeContextFrom(entry.contextFrom),
    chainAfter: [],
    enabledToolsets: entry.enabledToolsets ?? [],
    workdir: entry.workdir ?? null,
    originSessionId: null,
    originChannel: null,
    originConversationId: null,
    originThreadId: null,
    deliverChannels: entry.deliveryChannels ?? entry.deliver_channels ?? [],
    profileName: 'default',
    modelProvider: null,
    modelName: null,
    failureLimit: entry.failureLimit ?? 3,
  };
}

export async function importCronYamlEntries(entries: CronJobYamlEntry[]): Promise<string[]> {
  const existing = await listJobs();
  const imported: string[] = [];

  for (const raw of entries) {
    const entry = typeof raw === 'object' && raw !== null && 'schedule' in raw
      ? (raw as CronJobYamlEntry)
      : parseCronYamlEntry(raw as unknown as Record<string, unknown>);

    if (!entry.schedule) {
      throw new Error(`Cron entry "${entry.name}" is missing schedule.`);
    }
    parseSchedule(entry.schedule);

    const slug = entry.id ?? entry.name;
    const match = existing.find((j) => j.name === slug);
    const input = entryToJobInput(entry);

    if (match) {
      const updated = await updateJob(match.id, input);
      if (updated?.status === 'active') registerJob(updated);
      imported.push(updated?.id ?? match.id);
    } else {
      const job = await createJob(input);
      imported.push(job.id);
      existing.push(job);
    }
  }

  return imported;
}

export async function importCronYamlDocument(doc: unknown): Promise<string[]> {
  const entries = Array.isArray(doc) ? doc : [doc];
  const parsed = entries.map((entry) => parseCronYamlEntry(entry as Record<string, unknown>));
  return importCronYamlEntries(parsed);
}
