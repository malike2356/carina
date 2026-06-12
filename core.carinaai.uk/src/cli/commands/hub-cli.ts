import chalk from 'chalk';
import {
  fetchHubPacks,
  fetchHubSkills,
  fetchRegistrySummary,
  hubBaseUrl,
} from '../../skills/hub/hub-client.js';

export async function runHubCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'browse';

  if (action === 'start') {
    const { startSkillsHub } = await import('../../skills/hub/server.js');
    await startSkillsHub();
    return;
  }

  if (action === 'browse' || action === 'open') {
    const url = hubBaseUrl();
    console.log(chalk.cyan(`Skills Hub: ${url}`));
    console.log(chalk.gray('Install a pack: carina packs install <name>'));
    return;
  }

  if (action === 'status' || action === 'registry') {
    try {
      const summary = await fetchRegistrySummary();
      console.log(chalk.bold('\nSkills Hub registry\n'));
      console.log(`  URL:        ${hubBaseUrl()}`);
      console.log(`  Packs:      ${summary.packCount}`);
      console.log(`  Skills:     ${summary.skillCount}`);
      console.log(`  Downloads:  ${summary.totalDownloads}`);
      console.log(`  Categories: ${summary.categories.join(', ') || '(none)'}`);
      console.log('');
    } catch (err) {
      console.error('Hub unreachable:', err instanceof Error ? err.message : err);
      console.error('Start locally: carina hub start');
      process.exit(1);
    }
    return;
  }

  if (action === 'packs' || action === 'list') {
    const q = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
    const category = args.includes('--category') ? args[args.indexOf('--category') + 1] : undefined;
    try {
      const packs = await fetchHubPacks({ q, category });
      console.log(chalk.bold(`\nSkill packs (${packs.length})\n`));
      for (const p of packs) {
        const tag = p.featured ? chalk.green(' *') : '';
        console.log(
          `  ${p.name.padEnd(18)}${tag}  ${String(p.skill_count).padStart(3)} skills  ${p.category ?? ''}  ${p.description.slice(0, 50)}`,
        );
      }
      console.log('');
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
    return;
  }

  if (action === 'skills' || action === 'search') {
    const q = args[1] && !args[1].startsWith('--') ? args[1] : '';
    const packIdx = args.indexOf('--pack');
    const pack = packIdx >= 0 ? args[packIdx + 1] : undefined;
    try {
      const skills = await fetchHubSkills({ q, pack, limit: 100 });
      console.log(chalk.bold(`\nSkills (${skills.length})\n`));
      for (const s of skills) {
        console.log(`  ${s.pack_name}/${s.name}`);
        console.log(chalk.gray(`    ${s.description.slice(0, 72)}`));
        if (s.triggers?.length) {
          console.log(chalk.gray(`    triggers: ${s.triggers.slice(0, 5).join(', ')}`));
        }
      }
      console.log('');
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
    return;
  }

  if (action === 'install') {
    const name = args[1];
    if (!name) {
      console.error('Usage: carina hub install <pack-name>');
      process.exit(1);
    }
    const { installPack } = await import('../../setup/install-pack.js');
    await installPack(name);
    return;
  }

  if (action === 'publish') {
    const packDir = args[1];
    if (!packDir) {
      console.error('Usage: carina hub publish <pack-dir> [--featured]');
      process.exit(1);
    }
    const { initHubDb } = await import('../../skills/hub/migrations.js');
    const { publishPackDirectory } = await import('../../skills/hub/publish-pack.js');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const storageDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../data/hub-packs',
    );
    await initHubDb();
    const result = await publishPackDirectory(packDir, storageDir, {
      featured: args.includes('--featured'),
    });
    console.log(chalk.green(`Published ${result.name}@${result.version} (${result.skillCount} skills)`));
    console.log(chalk.gray(`  archive: ${result.archivePath}`));
    return;
  }

  console.error('Usage: carina hub <start|browse|status|packs|skills|install|publish> [args]');
  process.exit(1);
}
