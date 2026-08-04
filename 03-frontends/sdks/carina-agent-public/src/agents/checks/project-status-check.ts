import { execFile } from 'child_process';
import { promisify } from 'util';
import type { CarinaMessage } from '../../types/index.js';
import type { CheckResult } from './email-check.js';

const execFileAsync = promisify(execFile);

export interface ProjectStatusOptions {
  source: CarinaMessage['source'];
  projectPath?: string;
}

export async function checkProjectStatus(options: ProjectStatusOptions): Promise<CheckResult> {
  if (options.source !== 'cli' || !options.projectPath) {
    return { name: 'project-status', urgent: false, summary: null };
  }

  const [status, log] = await Promise.all([
    execFileAsync('git', ['status', '--porcelain'], { cwd: options.projectPath }),
    execFileAsync('git', ['log', '-1', '--pretty=%h %cr %s'], { cwd: options.projectPath }),
  ]);

  const dirty = status.stdout.trim();
  const latest = log.stdout.trim();
  return {
    name: 'project-status',
    urgent: false,
    summary: dirty
      ? `Project has uncommitted changes:\n${dirty}\nLatest commit: ${latest}`
      : `Project is clean. Latest commit: ${latest}`,
  };
}
