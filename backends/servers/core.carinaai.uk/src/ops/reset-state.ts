import fs from 'fs/promises';
import path from 'path';
import { CARINA_HOME } from '../config/paths.js';

export type ResetScope = 'soft' | 'state' | 'full';

export type ResetPlan = {
  scope: ResetScope;
  homeDir: string;
  items: string[];
  warnings: string[];
};

export type ResetResult = {
  scope: ResetScope;
  removed: string[];
  dryRun: boolean;
  auditId: string;
};

const SOFT_ITEMS = [
  'sessions',
  'run',
  'thread-ownership.json',
  'channel-dm-pairing.json',
  'data/logs',
  'data/cache',
] as const;

const STATE_ITEMS = [
  ...SOFT_ITEMS,
  'approvals.json',
  'pairing.json',
  'devices.json',
  'nodes.json',
  'commitments.json',
  'checkpoints',
  'data/checkpoints',
] as const;

const FULL_ITEMS = [
  ...STATE_ITEMS,
  'config.yaml',
  'toolsets.yaml',
  'agents.json',
  'profiles',
  'workspaces',
  'agents',
  'packs',
  'plugins',
  'extensions',
  'credentials.json',
  'hooks',
  'DREAMS.md',
  '.env',
] as const;

const PRESERVE_ALWAYS = ['backups'] as const;

function itemsForScope(scope: ResetScope): readonly string[] {
  if (scope === 'soft') return SOFT_ITEMS;
  if (scope === 'state') return STATE_ITEMS;
  return FULL_ITEMS;
}

function auditPath(homeDir: string): string {
  return path.join(homeDir, 'reset-audit.jsonl');
}

export async function appendResetAudit(
  homeDir: string,
  entry: Record<string, unknown>,
): Promise<void> {
  await fs.mkdir(homeDir, { recursive: true });
  const line = JSON.stringify({ at: new Date().toISOString(), ...entry });
  await fs.appendFile(auditPath(homeDir), `${line}\n`, { mode: 0o600 });
}

export async function planReset(
  scope: ResetScope,
  homeDir = CARINA_HOME,
): Promise<ResetPlan> {
  const items = [...itemsForScope(scope)];
  const warnings: string[] = [
    'Reset is operator-only and does not uninstall the carina CLI.',
    'Stop carina web and active sessions before resetting.',
  ];

  if (scope === 'soft') {
    warnings.push('Soft reset clears sessions and ephemeral runtime state only.');
  } else if (scope === 'state') {
    warnings.push('State reset also clears approvals, pairing, and checkpoint data.');
  } else {
    warnings.push('Full reset removes config, workspaces, and secrets from CARINA_HOME.');
    warnings.push('Backups under ~/.carina/backups are preserved unless you delete them manually.');
  }

  for (const keep of PRESERVE_ALWAYS) {
    const idx = items.indexOf(keep);
    if (idx >= 0) items.splice(idx, 1);
  }

  return { scope, homeDir, items, warnings };
}

export type ResetOptions = {
  homeDir?: string;
  dryRun?: boolean;
  force?: boolean;
};

export async function executeReset(
  scope: ResetScope,
  options: ResetOptions = {},
): Promise<ResetResult> {
  const homeDir = options.homeDir ?? CARINA_HOME;
  const plan = await planReset(scope, homeDir);

  if (!options.force && !options.dryRun) {
    throw new Error(
      `Reset requires --force. Preview with: carina reset --scope ${scope} --dry-run`,
    );
  }

  const removed: string[] = [];
  for (const item of plan.items) {
    const target = path.join(homeDir, item);
    if (options.dryRun) {
      try {
        await fs.access(target);
        removed.push(item);
      } catch {
        // absent
      }
      continue;
    }
    try {
      await fs.rm(target, { recursive: true, force: true });
      removed.push(item);
    } catch {
      // skip missing
    }
  }

  const auditId = `reset-${Date.now()}`;
  if (!options.dryRun) {
    await appendResetAudit(homeDir, {
      id: auditId,
      scope,
      removed,
      dryRun: false,
    });
  }

  return { scope, removed, dryRun: Boolean(options.dryRun), auditId };
}

export async function listResetAudit(homeDir = CARINA_HOME, limit = 20): Promise<string[]> {
  try {
    const raw = await fs.readFile(auditPath(homeDir), 'utf-8');
    return raw.trim().split('\n').filter(Boolean).slice(-limit);
  } catch {
    return [];
  }
}
