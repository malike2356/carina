import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { resolveCarinaHome } from '../../config/paths.js';
import { loadConfig, resolveGithubBridgeScope } from './config.js';
import type { GithubBridgeConfig } from './types.js';
import { pullNow, pushApprovedDurableUpdates } from './service.js';

type ScopeTimer = {
  pullTimer: ReturnType<typeof setInterval> | null;
  pushTimer: ReturnType<typeof setInterval> | null;
};

const timers = new Map<string, ScopeTimer>();

export function githubBridgeSchedulerEnabled(): boolean {
  if (process.env.AGENT_SYNC_GITHUB_ENABLED === 'false') return false;
  return true;
}

function stopScopeTimers(scopeKey: string): void {
  const timersForScope = timers.get(scopeKey);
  if (!timersForScope) return;
  if (timersForScope.pullTimer) clearInterval(timersForScope.pullTimer);
  if (timersForScope.pushTimer) clearInterval(timersForScope.pushTimer);
  timers.delete(scopeKey);
}

function clearAllTimers(): void {
  for (const scopeKey of Array.from(timers.keys())) {
    stopScopeTimers(scopeKey);
  }
}

async function listScopedConfigs(): Promise<Array<{ scopeKey: string; config: GithubBridgeConfig }>> {
  const baseDir = path.join(resolveCarinaHome(), 'data', 'github-agent-sync');
  const entries = await fs.readdir(baseDir, { withFileTypes: true }).catch(() => []);
  const scoped = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const [scopeKindRaw, ...rest] = entry.name.split(':');
        const scopeKind = scopeKindRaw === 'user' || scopeKindRaw === 'shared' ? scopeKindRaw : 'workspace';
        const scopeId = rest.length ? rest.join(':') : null;
        const resolved = resolveGithubBridgeScope({ scopeKind, scopeId });
        const config = await loadConfig(resolved);
        return { scopeKey: resolved.scopeKey, config };
      }),
  );
  return scoped.filter(({ config }) => config.enabled);
}

async function listScheduledConfigs(): Promise<Array<{ scopeKey: string; config: GithubBridgeConfig }>> {
  const scoped = await listScopedConfigs();
  if (scoped.length) return scoped;
  const defaultConfig = await loadConfig();
  const resolved = resolveGithubBridgeScope({
    scopeKind: defaultConfig.scopeKind,
    scopeId: defaultConfig.scopeId,
  });
  return defaultConfig.enabled ? [{ scopeKey: resolved.scopeKey, config: defaultConfig }] : [];
}

function scheduleScope(scopeKey: string, config: GithubBridgeConfig): void {
  stopScopeTimers(scopeKey);

  const scope = resolveGithubBridgeScope({
    scopeKind: config.scopeKind,
    scopeId: config.scopeId,
  });

  const pullMs = Math.max(config.pullIntervalMinutes, 1) * 60_000;
  void pullNow(scope).then((result) => {
    if (result.ok) {
      console.log(chalk.gray(`[agent-sync:${scopeKey}] initial pull ok (${result.indexed ?? 0} chunks indexed)`));
    } else if (result.error) {
      console.warn(chalk.yellow(`[agent-sync:${scopeKey}] initial pull: ${result.error}`));
    }
  });

  const pullTimer = setInterval(() => {
    void pullNow(scope).then((result) => {
      if (!result.ok && result.error) {
        console.warn(chalk.yellow(`[agent-sync:${scopeKey}] pull: ${result.error}`));
      }
    });
  }, pullMs);
  pullTimer.unref?.();

  let pushTimer: ReturnType<typeof setInterval> | null = null;
  if (config.pushIntervalMinutes > 0) {
    const pushMs = Math.max(config.pushIntervalMinutes, 1) * 60_000;
    pushTimer = setInterval(() => {
      void pushApprovedDurableUpdates({}, scope).then((result) => {
        if (!result.ok && result.error) {
          console.warn(chalk.yellow(`[agent-sync:${scopeKey}] push: ${result.error}`));
        }
      });
    }, pushMs);
    pushTimer.unref?.();
  }

  timers.set(scopeKey, { pullTimer, pushTimer });

  console.log(
    chalk.gray(
      `[agent-sync:${scopeKey}] scheduled (pull every ${config.pullIntervalMinutes}m` +
        (config.pushIntervalMinutes > 0 ? `, push every ${config.pushIntervalMinutes}m` : ', push on save only') +
        `) -> ${config.owner}/${config.repo}@${config.branch}`,
    ),
  );
}

export async function startGithubBridgeSchedule(): Promise<void> {
  if (!githubBridgeSchedulerEnabled()) return;
  clearAllTimers();

  const configs = await listScheduledConfigs();
  if (!configs.length) {
    console.log(chalk.gray('[agent-sync] GitHub bridge idle (disabled). Enable in Settings or AGENT_SYNC_GITHUB_ENABLED=true'));
    return;
  }

  for (const { scopeKey, config } of configs) {
    scheduleScope(scopeKey, config);
  }
}

export function stopGithubBridgeSchedule(): void {
  clearAllTimers();
}
