import path from 'path';
import type { ScheduledJob } from './cron-scheduler.js';
import { expandPath, isBlockedSystemWrite, isSafePath } from '../tools/path-utils.js';

export function resolveCronWorkdir(raw?: string | null): string | undefined {
  const value = String(raw ?? '').trim();
  if (!value) return undefined;
  const resolved = path.resolve(expandPath(value));
  if (!isSafePath(resolved) || isBlockedSystemWrite(resolved)) {
    throw new Error(`workdir is not allowed: ${value}`);
  }
  return resolved;
}

export function resolveJobWorkdir(job: Pick<ScheduledJob, 'workdir'>): string | undefined {
  return resolveCronWorkdir(job.workdir);
}
