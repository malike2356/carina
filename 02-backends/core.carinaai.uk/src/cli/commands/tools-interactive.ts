import { checkbox, confirm, search, select } from '@inquirer/prompts';
import chalk from 'chalk';
import {
  PLATFORM_NAMES,
  TOOLSET_NAMES,
  TOOLSETS_PATH,
  describePlatformToolsets,
  loadToolsetsConfig,
  resolvePlatformEnabledToolsets,
  saveToolsetsConfig,
  setDefaultToolsets,
  setPlatformToolsets,
  toggleDisabledTool,
} from '../../tools/toolset-config.js';
import { listAllToolNames, runToolsCommand } from './tools-cli.js';

export async function runToolsInteractiveMenu(): Promise<void> {
  console.log(chalk.cyan.bold('\n  Carina tools configuration\n'));

  let done = false;
  while (!done) {
    const cfg = loadToolsetsConfig();
    const defaultInfo = describePlatformToolsets('default', cfg);

    const action = await select({
      message: `Default: ${defaultInfo.enabledToolsets.length} toolsets, ${defaultInfo.toolCount} tools`,
      choices: [
        { name: 'Toggle default toolsets', value: 'default-toolsets' },
        { name: 'Toggle per-platform toolsets', value: 'platform-toolsets' },
        { name: 'Toggle individual tools (global disable)', value: 'tools' },
        { name: 'Enable all default toolsets', value: 'enable-all-sets' },
        { name: 'Disable all default toolsets', value: 'disable-all-sets' },
        { name: 'Clear globally disabled tools', value: 'clear-disabled' },
        { name: 'List tools (default)', value: 'list' },
        { name: 'Platform summary', value: 'platforms' },
        { name: 'Done', value: 'done' },
      ],
    });

    if (action === 'done') {
      done = true;
      continue;
    }

    if (action === 'default-toolsets') {
      const enabledSets = new Set(resolvePlatformEnabledToolsets(cfg, 'default'));
      const selected = await checkbox({
        message: 'Default enabled toolsets',
        choices: TOOLSET_NAMES.map((name) => ({
          name,
          value: name,
          checked: enabledSets.has(name),
        })),
      });
      await saveToolsetsConfig(setDefaultToolsets(selected, cfg));
      console.log(chalk.green(`Saved ${selected.length} default toolsets`));
      continue;
    }

    if (action === 'platform-toolsets') {
      const platform = await select({
        message: 'Platform',
        choices: PLATFORM_NAMES.filter((p) => p !== 'default').map((name) => {
          const info = describePlatformToolsets(name, cfg);
          return {
            name: `${name} (${info.toolCount} tools${info.usingPreset ? ', preset' : ''})`,
            value: name,
          };
        }),
      });
      const enabledSets = new Set(resolvePlatformEnabledToolsets(cfg, platform));
      const selected = await checkbox({
        message: `Toolsets for ${platform}`,
        choices: TOOLSET_NAMES.map((name) => ({
          name,
          value: name,
          checked: enabledSets.has(name),
        })),
      });
      await saveToolsetsConfig(setPlatformToolsets(platform, selected, cfg));
      console.log(chalk.green(`Saved ${selected.length} toolsets for ${platform}`));
      continue;
    }

    if (action === 'tools') {
      const disabledTools = new Set(cfg.default?.disabled ?? []);
      const allTools = listAllToolNames();
      const picked = await search({
        message: 'Search tool to toggle',
        source: async (term = '') => {
          const q = term.toLowerCase();
          return allTools
            .filter((t) => !q || t.includes(q))
            .slice(0, 20)
            .map((t) => ({
              name: `${disabledTools.has(t) ? '[off]' : '[on]'} ${t}`,
              value: t,
            }));
        },
      });
      const enable = await confirm({
        message: `Enable ${picked}?`,
        default: disabledTools.has(picked),
      });
      await saveToolsetsConfig(toggleDisabledTool(picked, !enable, cfg));
      console.log(chalk.green(`Tool ${picked} is now ${enable ? 'on' : 'off'} globally`));
      continue;
    }

    if (action === 'enable-all-sets') {
      await saveToolsetsConfig(setDefaultToolsets([...TOOLSET_NAMES], cfg));
      console.log(chalk.green('All default toolsets enabled'));
      continue;
    }

    if (action === 'disable-all-sets') {
      await saveToolsetsConfig(setDefaultToolsets([], cfg));
      console.log(chalk.yellow('All default toolsets disabled'));
      continue;
    }

    if (action === 'clear-disabled') {
      const next = { ...cfg, default: { ...cfg.default, disabled: [] } };
      await saveToolsetsConfig(next);
      console.log(chalk.green('Cleared globally disabled tools list'));
      continue;
    }

    if (action === 'list') {
      await runToolsCommand(['list']);
      continue;
    }

    if (action === 'platforms') {
      await runToolsCommand(['platform', 'list']);
    }
  }

  console.log(chalk.gray(`\nTools config saved to ${TOOLSETS_PATH}\n`));
}
