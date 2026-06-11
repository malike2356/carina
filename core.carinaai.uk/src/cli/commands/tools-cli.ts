import chalk from 'chalk';
import { registry } from '../../tools/registry.js';
import '../../tools/index.js';
import {
  PLATFORM_NAMES,
  TOOLSET_NAMES,
  TOOLSETS_PATH,
  describePlatformToolsets,
  loadToolsetsConfig,
  resolveActiveToolNames,
  resolvePlatformEnabledToolsets,
  saveToolsetsConfig,
  setDefaultToolsets,
  setPlatformToolsets,
  toggleDefaultToolset,
  toggleDisabledTool,
  togglePlatformToolset,
} from '../../tools/toolset-config.js';

export {
  TOOLSETS_PATH,
  TOOLSET_NAMES,
  loadToolsetsConfig,
  saveToolsetsConfig,
} from '../../tools/toolset-config.js';

export function listAllToolNames(): string[] {
  return registry.list().map((t) => t.name).sort();
}

function isInteractiveDefault(args: string[]): boolean {
  if (args.length > 0) return false;
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function runToolsCommand(args: string[]): Promise<void> {
  const action = args[0] ?? (isInteractiveDefault(args) ? 'menu' : 'list');

  if (action === 'menu' || action === 'interactive') {
    const { runToolsInteractiveMenu } = await import('./tools-interactive.js');
    await runToolsInteractiveMenu();
    return;
  }

  if (action === 'list') {
    const platform = args[1];
    const tools = registry.list().sort((a, b) => a.name.localeCompare(b.name));
    const allowed = resolveActiveToolNames({ platform });
    const allowedSet = allowed ? new Set(allowed) : null;
    const title = platform ? `Tools for platform: ${platform}` : 'Tools (default)';
    console.log(chalk.bold(`\n${title} (${tools.length} registered)\n`));
    for (const tool of tools) {
      const on = !allowedSet || allowedSet.has(tool.name);
      const status = on ? chalk.green('on') : chalk.red('off');
      console.log(`  ${status}  ${tool.name.padEnd(28)} ${tool.description.slice(0, 55)}`);
    }
    console.log(`\nConfig: ${TOOLSETS_PATH}\n`);
    return;
  }

  if (action === 'toolsets') {
    const platform = args[1] ?? 'default';
    const cfg = loadToolsetsConfig();
    const enabled = new Set(resolvePlatformEnabledToolsets(cfg, platform));
    console.log(chalk.bold(`\nToolsets (${platform})\n`));
    for (const name of TOOLSET_NAMES) {
      const on = enabled.has(name);
      console.log(`  ${on ? chalk.green('on') : chalk.gray('off')}  ${name}`);
    }
    const info = describePlatformToolsets(platform, cfg);
    console.log(chalk.gray(`\n  ${info.toolCount} tools active${info.usingPreset ? ' (preset)' : ''}\n`));
    return;
  }

  if (action === 'platform' || action === 'platforms') {
    const sub = args[1] ?? 'list';
    const cfg = loadToolsetsConfig();

    if (sub === 'list') {
      console.log(chalk.bold('\nPer-platform toolsets\n'));
      for (const platform of PLATFORM_NAMES) {
        const info = describePlatformToolsets(platform, cfg);
        const marker = info.usingPreset ? chalk.gray('preset') : chalk.green('custom');
        console.log(
          `  ${platform.padEnd(14)} ${marker}  sets=${info.enabledToolsets.length}  tools=${info.toolCount}`,
        );
      }
      console.log('\nShow: carina tools platform show <name>\n');
      return;
    }

    if (sub === 'show') {
      const platform = args[2] ?? 'default';
      console.log(JSON.stringify(describePlatformToolsets(platform, cfg), null, 2));
      return;
    }

    if (sub === 'set') {
      const platform = args[2];
      const list = args[3];
      if (!platform || !list) {
        console.error('Usage: carina tools platform set <platform> <toolset,toolset,...>');
        process.exit(1);
      }
      const enabled = list.split(',').map((s) => s.trim()).filter(Boolean);
      const next = platform === 'default'
        ? setDefaultToolsets(enabled, cfg)
        : setPlatformToolsets(platform, enabled, cfg);
      await saveToolsetsConfig(next);
      console.log(chalk.green(`Set ${platform} toolsets: ${enabled.join(', ')}`));
      return;
    }

    if (sub === 'enable' || sub === 'disable') {
      const platform = args[2];
      const toolset = args[3];
      if (!platform || !toolset) {
        console.error(`Usage: carina tools platform ${sub} <platform> <toolset>`);
        process.exit(1);
      }
      const next = platform === 'default'
        ? toggleDefaultToolset(toolset, sub === 'enable', cfg)
        : togglePlatformToolset(platform, toolset, sub === 'enable', cfg);
      await saveToolsetsConfig(next);
      console.log(chalk.green(`Toolset ${toolset} ${sub}d on ${platform}`));
      return;
    }

    if (sub === 'reset') {
      const platform = args[2];
      if (!platform) {
        console.error('Usage: carina tools platform reset <platform>');
        process.exit(1);
      }
      const normalized = loadToolsetsConfig();
      if (platform === 'default') {
        await saveToolsetsConfig({ ...normalized, default: { disabled: normalized.default?.disabled } });
      } else {
        const platforms = { ...normalized.platforms };
        delete platforms[platform];
        await saveToolsetsConfig({ ...normalized, platforms });
      }
      console.log(chalk.green(`Reset ${platform} to preset toolsets`));
      return;
    }

    console.error('Usage: carina tools platform <list|show|set|enable|disable|reset> ...');
    process.exit(1);
  }

  if (action === 'enable' || action === 'disable') {
    const target = args[1];
    const platform = args[2];
    if (!target) {
      console.error(`Usage: carina tools ${action} <tool-or-toolset> [platform]`);
      process.exit(1);
    }
    const cfg = loadToolsetsConfig();

    if ((TOOLSET_NAMES as readonly string[]).includes(target)) {
      const next = platform && platform !== 'default'
        ? togglePlatformToolset(platform, target, action === 'enable', cfg)
        : toggleDefaultToolset(target, action === 'enable', cfg);
      await saveToolsetsConfig(next);
      const scope = platform && platform !== 'default' ? platform : 'default';
      console.log(`Toolset ${target} ${action}d (${scope})`);
      return;
    }

    await saveToolsetsConfig(toggleDisabledTool(target, action === 'disable', cfg));
    console.log(`Tool ${target} ${action}d globally`);
    return;
  }

  if (action === 'audit') {
    const {
      auditToolInventory,
      buildToolInventory,
      findUnregisteredTools,
    } = await import('../../tools/tool-inventory.js');
    const json = args.includes('--json');
    const report = auditToolInventory();
    if (json) {
      console.log(JSON.stringify({ report, tools: buildToolInventory() }, null, 2));
      return;
    }
    console.log(chalk.bold(`\nTool risk audit (${report.total} tools)\n`));
    for (const [risk, count] of Object.entries(report.byRisk)) {
      console.log(`  ${risk.padEnd(12)} ${count}`);
    }
    const unregistered = findUnregisteredTools();
    if (unregistered.length > 0) {
      console.log(chalk.red(`\nUnclassified tools (${unregistered.length}):`));
      console.log(`  ${unregistered.join(', ')}`);
    }
    if (report.missingDangerousFlag.length > 0) {
      console.log(chalk.yellow(`\nMissing dangerous flag (${report.missingDangerousFlag.length}):`));
      console.log(`  ${report.missingDangerousFlag.join(', ')}`);
    }
    console.log('');
    return;
  }

  if (action === 'show') {
    const name = args[1];
    if (!name) {
      console.error('Usage: carina tools show <name>');
      process.exit(1);
    }
    const tool = registry.get(name);
    if (!tool) {
      console.error(`Tool not found: ${name}`);
      process.exit(1);
    }
    const YAML = await import('yaml');
    console.log(YAML.stringify({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
    return;
  }

  console.error('Usage: carina tools <menu|list|audit|toolsets|platform|enable|disable|show> ...');
  process.exit(1);
}
