import chalk from 'chalk';
import { input, select } from '@inquirer/prompts';
import { llm } from '../brain/llm.js';
import {
  activateProfile,
  getActiveProfileName,
  listProfiles,
} from '../profiles/manager.js';
import {
  applyProfileProviderFromConfig,
  describeNamedProfileScope,
} from '../profiles/scope.js';
import { loadProfilePersonality } from '../profiles/personality.js';
import { getPromptCacheStats } from '../brain/prompt-cache.js';
import { PROVIDER_DEFINITIONS, ROUTABLE_PROVIDER_NAMES } from '../brain/provider-registry.js';
import { describeProviderTags, providerCostLabel } from '../brain/provider-tags.js';
import { providerTransportType } from '../brain/provider-registry.js';
import { listCheckpoints, latestCheckpoint, restoreCheckpoint } from '../tools/checkpoint-store.js';
import { registry } from '../tools/index.js';
import { buildEntranceSnapshot, printEntrance } from '../cli/entrance.js';

export interface TuiOptions {
  memoryReady?: boolean;
  sessionId?: string;
  simple?: boolean;
}

const HELP_LINES = [
  'CARINA simple TUI commands',
  '/help          show commands',
  '/profile       show or switch profile',
  '/provider      switch LLM provider',
  '/plugins       list installed extension bundles',
  '/copilot       show Free Copilot provider chain',
  '/checkpoints   list recent checkpoints',
  '/restore       restore latest checkpoint',
  '/cache         prompt cache stats',
  '/quit          exit',
];

function printBanner(personalityName: string): void {
  printEntrance(buildEntranceSnapshot({
    surface: 'tui',
    memoryReady: true,
    toolCount: registry.list().length,
  }));
  console.log(chalk.gray(`  personality: ${personalityName}\n`));
}

export async function runSimpleTui(options: TuiOptions = {}): Promise<void> {
  const { ensureFirstRunReady } = await import('../cli/first-run.js');
  await ensureFirstRunReady();

  const { getRouter } = await import('../gateway/router.js');
  const { loadLastSurfaceSession, saveLastSurfaceSession } = await import('../surfaces/session-store.js');
  const { resolveSurfaceExternalUserId } = await import('../surfaces/index.js');

  const router = getRouter();
  const externalUserId = resolveSurfaceExternalUserId('tui');
  const last = await loadLastSurfaceSession('tui');
  const started = await router.startSurfaceSession('tui', externalUserId);
  const sessionId = options.sessionId ?? last?.sessionId ?? started.sessionId;

  let personalityName = 'Carina';
  try {
    const personality = await loadProfilePersonality();
    personalityName = personality.name;
  } catch {
    personalityName = 'Carina';
  }

  printBanner(personalityName);
  console.log(chalk.gray(`  session: ${sessionId}\n`));

  let running = true;
  while (running) {
    const line = await input({ message: chalk.green('you>') });
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed === '/quit' || trimmed === '/exit') {
      running = false;
      break;
    }

    if (trimmed === '/help') {
      for (const helpLine of HELP_LINES) {
        console.log(chalk.gray(`  ${helpLine}`));
      }
      continue;
    }

    if (trimmed === '/provider') {
      const configured = llm.list();
      const routableDefs = PROVIDER_DEFINITIONS.filter((d) =>
        ROUTABLE_PROVIDER_NAMES.includes(d.name as never),
      );
      const choice = await select({
        message: 'Select provider',
        choices: routableDefs.map((def) => {
          const ok = configured.includes(def.name);
          const meta = [
            providerCostLabel(def.tags.cost),
            def.authType,
            def.status,
            providerTransportType(def),
          ].join(' · ');
          const tags = describeProviderTags(def);
          const label = ok
            ? `${def.name}  ${def.displayName}  [${meta}]  ${tags}`
            : `${def.name}  ${def.displayName}  [${meta}]  ${tags}  (missing key)`;
          return {
            name: label,
            value: def.name,
            disabled: ok ? false : 'missing key',
          };
        }),
      });
      llm.use(String(choice));
      console.log(chalk.yellow(`Switched to ${choice}`));
      continue;
    }

    if (trimmed.startsWith('/profile')) {
      const arg = trimmed.slice('/profile'.length).trim();
      if (!arg) {
        const name = getActiveProfileName() ?? 'default';
        try {
          const scope = describeNamedProfileScope(name, getActiveProfileName());
          console.log(chalk.yellow(JSON.stringify(scope, null, 2)));
        } catch {
          console.log(chalk.yellow(`Active profile: ${name} (no scope details)`));
        }
        continue;
      }
      if (arg === 'list') {
        const profiles = await listProfiles();
        const active = getActiveProfileName();
        for (const p of profiles) {
          console.log(active === p ? chalk.yellow(`* ${p}`) : `  ${p}`);
        }
        continue;
      }
      try {
        const profile = activateProfile(arg);
        applyProfileProviderFromConfig(profile);
        personalityName = (await loadProfilePersonality()).name;
        console.log(chalk.yellow(`Switched to profile: ${profile.name}`));
      } catch (err) {
        console.log(chalk.red(err instanceof Error ? err.message : String(err)));
      }
      continue;
    }

    if (trimmed === '/checkpoints') {
      const checkpoints = await listCheckpoints(5);
      if (checkpoints.length === 0) {
        console.log(chalk.yellow('No checkpoints for this profile.'));
        continue;
      }
      for (const c of checkpoints) {
        console.log(chalk.yellow(`  ${c.checkpoint_id.slice(0, 8)}  ${c.label ?? ''}`));
      }
      continue;
    }

    if (trimmed === '/restore') {
      const latest = await latestCheckpoint();
      if (!latest) {
        console.log(chalk.yellow('No checkpoints to restore.'));
        continue;
      }
      const confirm = await input({ message: `Restore latest (${latest.checkpoint_id.slice(0, 8)})? [y/N]` });
      if (!/^y(es)?$/i.test(confirm.trim())) continue;
      try {
        const result = await restoreCheckpoint(latest.checkpoint_id);
        console.log(chalk.yellow(`Restored ${result.restored.length} path(s)`));
      } catch (err) {
        console.log(chalk.red(err instanceof Error ? err.message : String(err)));
      }
      continue;
    }

    if (trimmed === '/cache') {
      const stats = getPromptCacheStats();
      console.log(chalk.yellow(`Prompt cache: size=${stats.size} hits=${stats.hits} misses=${stats.misses}`));
      continue;
    }

    process.stdout.write(chalk.green('\nCarina: '));
    for await (const chunk of router.handle({
      id: String(Date.now()),
      sessionId,
      content: trimmed,
      source: 'cli',
      timestamp: new Date(),
    })) {
      process.stdout.write(chunk);
    }
    console.log('\n');
  }

  await saveLastSurfaceSession('tui', {
    sessionId,
    externalUserId,
    updatedAt: new Date().toISOString(),
  });

  console.log(chalk.gray('Goodbye.\n'));
}

export async function runTui(options: TuiOptions = {}): Promise<void> {
  const { ensureFirstRunReady } = await import('../cli/first-run.js');
  await ensureFirstRunReady();

  if (options.simple || process.env.CARINA_TUI_SIMPLE === 'true') {
    await runSimpleTui(options);
    return;
  }

  try {
    const { runOperatorTui } = await import('./app.js');
    await runOperatorTui(options);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('interactive terminal')) {
      console.error(msg);
      process.exit(1);
    }
    console.error(chalk.yellow(`Operator TUI unavailable (${msg}); falling back to simple mode.`));
    await runSimpleTui(options);
  }
}
