import chalk from 'chalk';
import os from 'os';
import fsp from 'fs/promises';
import path from 'path';
import {
  fetchHubMarketplace,
  fetchHubMarketplaceEntry,
  fetchHubPacks,
  fetchHubSkills,
  fetchRegistrySummary,
  hubBaseUrl,
} from '../../skills/hub/hub-client.js';
import type { MarketplaceEntry, MarketplaceEntryKind } from '../../skills/hub/marketplace-types.js';

function hubTokenPath(): string {
  const home = process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina');
  return path.join(home, 'hub-token');
}

export async function readHubToken(): Promise<string | undefined> {
  try {
    const raw = await fsp.readFile(hubTokenPath(), 'utf-8');
    return raw.trim() || undefined;
  } catch {
    return undefined;
  }
}

function trustBadge(entry: MarketplaceEntry): string {
  const parts: string[] = [];
  if (entry.trust.featured) parts.push(chalk.green('featured'));
  if (entry.trust.verified) parts.push(chalk.cyan('verified'));
  parts.push(entry.trust.publisher);
  parts.push(entry.trust.validation);
  return parts.join(',');
}

function statusColor(status: string): (text: string) => string {
  if (status === 'enabled') return chalk.green;
  if (status === 'installed' || status === 'disabled') return chalk.yellow;
  return chalk.gray;
}

async function printCatalog(entries: MarketplaceEntry[], title: string): Promise<void> {
  console.log(chalk.bold(`\n${title} (${entries.length})\n`));
  for (const entry of entries.slice(0, 100)) {
    const color = statusColor(entry.status);
    console.log(
      `${entry.id.padEnd(32)} ${color(entry.status.padEnd(9))} ${trustBadge(entry)}`,
    );
    console.log(chalk.gray(`  ${entry.description.slice(0, 72)}`));
  }
  if (entries.length > 100) {
    console.log(chalk.gray(`\n  ... and ${entries.length - 100} more`));
  }
  console.log('');
}

export async function runHubCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'browse';
  const json = args.includes('--json');
  const rest = args.filter((a) => a !== '--json');

  if (action === 'start') {
    const { startSkillsHub } = await import('../../skills/hub/server.js');
    await startSkillsHub();
    return;
  }

  if (action === 'browse' || action === 'open') {
    const url = hubBaseUrl();
    console.log(chalk.cyan(`Carina Hub: ${url}`));
    console.log(chalk.gray('Browse: carina hub catalog [--kind pack|channel|mcp|...]'));
    console.log(chalk.gray('Install: carina hub install <kind:slug>'));
    return;
  }

  if (action === 'status' || action === 'registry') {
    try {
      const [summary, marketplace] = await Promise.all([
        fetchRegistrySummary(),
        fetchHubMarketplace(),
      ]);
      if (json) {
        console.log(JSON.stringify({ summary, marketplace: marketplace.summary }, null, 2));
        return;
      }
      console.log(chalk.bold('\nCarina Hub\n'));
      console.log(`  URL:        ${hubBaseUrl()}`);
      console.log(`  Packs:      ${summary.packCount}`);
      console.log(`  Skills:     ${summary.skillCount}`);
      console.log(`  Marketplace entries: ${marketplace.summary.total}`);
      console.log(`  Featured:   ${marketplace.summary.featured}`);
      console.log(`  Verified:   ${marketplace.summary.verified}`);
      console.log(`  Installed:  ${marketplace.summary.installed}`);
      console.log(`  Categories: ${summary.categories.join(', ') || '(none)'}`);
      console.log('');
    } catch {
      const { queryMarketplaceCatalog } = await import('../../skills/hub/marketplace-catalog.js');
      const local = await queryMarketplaceCatalog();
      if (json) {
        console.log(JSON.stringify(local.summary, null, 2));
        return;
      }
      console.log(chalk.bold('\nCarina Hub (local catalog)\n'));
      console.log(`  Marketplace entries: ${local.summary.total}`);
      console.log(`  Featured: ${local.summary.featured}; Verified: ${local.summary.verified}`);
      console.log(chalk.gray('  Remote hub offline; showing builtin catalog only.'));
      console.log('');
    }
    return;
  }

  if (action === 'catalog' || action === 'marketplace') {
    const kindIdx = rest.indexOf('--kind');
    const kind = kindIdx >= 0 ? rest[kindIdx + 1] as MarketplaceEntryKind : undefined;
    const featured = rest.includes('--featured');
    const verified = rest.includes('--verified');
    const qIdx = rest.indexOf('--q');
    const q = qIdx >= 0
      ? rest[qIdx + 1]
      : (rest[1] && !rest[1].startsWith('--') ? rest[1] : undefined);
    try {
      const { entries, summary } = await fetchHubMarketplace({ kind, q, featured, verified });
      if (json) {
        console.log(JSON.stringify({ summary, entries }, null, 2));
        return;
      }
      await printCatalog(entries, `Marketplace${kind ? ` (${kind})` : ''}`);
      console.log(chalk.gray(`Total ${summary.total}; featured ${summary.featured}; verified ${summary.verified}`));
    } catch {
      const { queryMarketplaceCatalog } = await import('../../skills/hub/marketplace-catalog.js');
      const local = await queryMarketplaceCatalog({ kind, q, featured, verified });
      if (json) {
        console.log(JSON.stringify(local, null, 2));
        return;
      }
      await printCatalog(local.entries, `Marketplace (local)${kind ? ` (${kind})` : ''}`);
    }
    return;
  }

  if (action === 'show') {
    const id = rest[1];
    if (!id) {
      console.error('Usage: carina hub show <kind:slug> [--json]');
      process.exit(1);
    }
    try {
      const remote = await fetchHubMarketplaceEntry(id);
      if (json) {
        console.log(JSON.stringify(remote.entry, null, 2));
        return;
      }
      const entry = remote.entry;
      console.log(chalk.bold(`\n${entry.name} (${entry.id})\n`));
      console.log(`  Version:  ${entry.version}`);
      console.log(`  Author:   ${entry.author}`);
      console.log(`  Status:   ${entry.status}`);
      console.log(`  Trust:    ${trustBadge(entry)}`);
      console.log(`  Risk:     ${entry.trust.risk}`);
      console.log(`  ${entry.description}`);
      if (entry.install.envKeys?.length) {
        console.log(chalk.gray(`  Env: ${entry.install.envKeys.join(', ')}`));
      }
      console.log('');
    } catch {
      const { getMarketplaceEntry } = await import('../../skills/hub/marketplace-catalog.js');
      const entry = await getMarketplaceEntry(id);
      if (!entry) {
        console.error(`Not found: ${id}`);
        process.exit(1);
      }
      if (json) {
        console.log(JSON.stringify(entry, null, 2));
        return;
      }
      console.log(JSON.stringify(entry, null, 2));
    }
    return;
  }

  if (action === 'install' || action === 'enable' || action === 'disable' || action === 'update' || action === 'remove') {
    const id = rest[1];
    if (!id) {
      console.error(`Usage: carina hub ${action} <kind:slug>`);
      process.exit(1);
    }
    const {
      marketplaceInstall,
      marketplaceEnable,
      marketplaceDisable,
      marketplaceUpdate,
      marketplaceRemove,
    } = await import('../../skills/hub/marketplace-install.js');
    const bypassEval = rest.includes('--bypass-eval');
    const allowDangerous = rest.includes('--allow-dangerous');
    let result;
    if (action === 'install') {
      try {
        result = await marketplaceInstall(id, { bypassEval, allowDangerous });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Install failed: ${msg}`));
        console.error(chalk.gray('Try: carina hub show ' + id));
        process.exit(1);
      }
    } else if (action === 'enable') {
      result = await marketplaceEnable(id);
    } else if (action === 'disable') {
      result = await marketplaceDisable(id);
    } else if (action === 'update') {
      result = await marketplaceUpdate(id, { bypassEval });
    } else {
      result = await marketplaceRemove(id);
    }
    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(chalk.green(result.message));
    return;
  }

  if (action === 'packs') {
    const q = rest[1] && !rest[1].startsWith('--') ? rest[1] : undefined;
    const category = rest.includes('--category') ? rest[rest.indexOf('--category') + 1] : undefined;
    try {
      const packs = await fetchHubPacks({ q, category });
      if (json) {
        console.log(JSON.stringify({ packs }, null, 2));
        return;
      }
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

  if (action === 'skills') {
    const q = rest[1] && !rest[1].startsWith('--') ? rest[1] : '';
    const packIdx = rest.indexOf('--pack');
    const pack = packIdx >= 0 ? rest[packIdx + 1] : undefined;
    try {
      const skills = await fetchHubSkills({ q, pack, limit: 100 });
      if (json) {
        console.log(JSON.stringify({ skills }, null, 2));
        return;
      }
      console.log(chalk.bold(`\nSkills (${skills.length})\n`));
      for (const s of skills) {
        console.log(`  ${s.pack_name}/${s.name}`);
        console.log(chalk.gray(`    ${s.description.slice(0, 72)}`));
      }
      console.log('');
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
    return;
  }

  if (action === 'author' && rest[1] === 'init') {
    const name = rest[2];
    const author = rest[rest.indexOf('--author') + 1] ?? process.env.CARINA_PACK_AUTHOR ?? 'community';
    const description = rest[rest.indexOf('--description') + 1] ?? `Domain pack ${name}`;
    const category = rest[rest.indexOf('--category') + 1] ?? 'general';
    const outIdx = rest.indexOf('--out');
    const targetDir = outIdx >= 0 ? rest[outIdx + 1] : `./packs/${name}`;
    if (!name) {
      console.error('Usage: carina hub author init <name> [--author Org] [--description text] [--category domain] [--out dir]');
      process.exit(1);
    }
    const { initDomainPackDirectory, validateDomainPackForPublish } = await import('../../skills/hub/domain-pack-author.js');
    const scaffold = await initDomainPackDirectory({
      targetDir: targetDir!,
      name,
      author: String(author),
      description: String(description),
      category: String(category),
    });
    const validation = await validateDomainPackForPublish(scaffold.dir);
    console.log(chalk.green(`Scaffolded domain pack at ${scaffold.dir}`));
    for (const file of scaffold.files) console.log(chalk.gray(`  ${file}`));
    if (!validation.ok) {
      console.log(chalk.yellow('\nValidation issues before publish:'));
      for (const issue of validation.issues) console.log(`  - ${issue}`);
    }
    return;
  }

  if (action === 'ecosystem') {
    const { buildEcosystemMetrics } = await import('../../skills/hub/ecosystem-metrics.js');
    const metrics = await buildEcosystemMetrics();
    if (json) {
      console.log(JSON.stringify(metrics, null, 2));
      return;
    }
    console.log(chalk.bold('\nCarina ecosystem\n'));
    console.log(`  Marketplace entries: ${metrics.marketplace.total}`);
    console.log(`  Domain packs:        ${metrics.marketplace.packs}`);
    console.log(`  Verified:            ${metrics.marketplace.verified}`);
    console.log(`  Community publishers:${metrics.marketplace.community}`);
    console.log(chalk.gray(`\n  ${metrics.proof.categoryClaim}`));
    for (const outcome of metrics.proof.measurableOutcomes) {
      console.log(chalk.gray(`  - ${outcome}`));
    }
    console.log('');
    return;
  }

  if (action === 'publish') {
    const target = rest[1];
    if (!target) {
      console.error('Usage: carina hub publish <pack-dir|marketplace.json> [--featured]');
      process.exit(1);
    }
    if (target.endsWith('.json')) {
      const fs = await import('fs/promises');
      const raw = JSON.parse(await fs.readFile(target, 'utf-8'));
      const { validateMarketplaceEntryInput } = await import('../../skills/hub/marketplace-validate.js');
      const { upsertHubMarketplaceEntry } = await import('../../skills/hub/marketplace-registry.js');
      const { initHubDb } = await import('../../skills/hub/migrations.js');
      await initHubDb();
      const input = validateMarketplaceEntryInput(raw);
      await upsertHubMarketplaceEntry(input);
      console.log(chalk.green(`Published marketplace entry ${input.id}`));
      return;
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
    const result = await publishPackDirectory(target, storageDir, {
      featured: rest.includes('--featured'),
    });
    console.log(chalk.green(`Published ${result.name}@${result.version} (${result.skillCount} skills)`));
    return;
  }

  if (action === 'search') {
    const query = rest.slice(1).filter((a) => !a.startsWith('--')).join(' ');
    if (!query) {
      console.error('Usage: carina hub search <query>');
      process.exit(1);
    }
    try {
      const { entries } = await fetchHubMarketplace({ q: query });
      if (json) {
        console.log(JSON.stringify(entries, null, 2));
        return;
      }
      await printCatalog(entries, `Search: "${query}"`);
    } catch {
      const { queryMarketplaceCatalog } = await import('../../skills/hub/marketplace-catalog.js');
      const local = await queryMarketplaceCatalog({ q: query });
      await printCatalog(local.entries, `Search (local): "${query}"`);
    }
    return;
  }

  if (action === 'info') {
    const raw = rest[1];
    if (!raw) {
      console.error('Usage: carina hub info <pack-name>');
      process.exit(1);
    }
    const id = raw.includes(':') ? raw : `pack:${raw}`;
    await runHubCommand(['show', id, ...(json ? ['--json'] : [])]);
    return;
  }

  if (action === 'uninstall') {
    const id = rest[1];
    if (!id) {
      console.error('Usage: carina hub uninstall <kind:slug>');
      process.exit(1);
    }
    await runHubCommand(['remove', id, ...(json ? ['--json'] : [])]);
    return;
  }

  if (action === 'list') {
    try {
      const { entries } = await fetchHubMarketplace();
      const installed = entries.filter(
        (e) => e.status === 'installed' || e.status === 'enabled',
      );
      if (json) {
        console.log(JSON.stringify(installed, null, 2));
        return;
      }
      if (installed.length === 0) {
        console.log(chalk.gray('No installed hub entries. Run: carina hub install <kind:slug>'));
        return;
      }
      await printCatalog(installed, 'Installed');
    } catch {
      const { queryMarketplaceCatalog } = await import('../../skills/hub/marketplace-catalog.js');
      const local = await queryMarketplaceCatalog();
      const installed = local.entries.filter(
        (e) => e.status === 'installed' || e.status === 'enabled',
      );
      if (json) {
        console.log(JSON.stringify(installed, null, 2));
        return;
      }
      await printCatalog(installed, 'Installed (local)');
    }
    return;
  }

  if (action === 'outdated') {
    try {
      const { entries } = await fetchHubMarketplace();
      const installed = entries.filter(
        (e) => e.status === 'installed' || e.status === 'enabled',
      );
      const outdated: Array<{ id: string; local: string; remote: string }> = [];
      for (const entry of installed) {
        try {
          const remote = await fetchHubMarketplaceEntry(entry.id);
          if (remote.entry.version !== entry.version) {
            outdated.push({
              id: entry.id,
              local: entry.version,
              remote: remote.entry.version,
            });
          }
        } catch {
          // remote entry unavailable; skip
        }
      }
      if (json) {
        console.log(JSON.stringify(outdated, null, 2));
        return;
      }
      if (outdated.length === 0) {
        console.log(chalk.green('All installed hub entries are up to date.'));
        return;
      }
      console.log(chalk.bold('\nOutdated\n'));
      for (const o of outdated) {
        console.log(`  ${o.id.padEnd(32)} local=${o.local}  remote=${o.remote}`);
      }
      console.log(chalk.gray('\nRun: carina hub update <kind:slug>\n'));
    } catch {
      console.error(chalk.red('Could not reach hub to check for updates.'));
      process.exit(1);
    }
    return;
  }

  if (action === 'login') {
    const token = rest[1];
    if (!token) {
      console.error('Usage: carina hub login <api-token>');
      process.exit(1);
    }
    const tokenPath = hubTokenPath();
    await fsp.mkdir(path.dirname(tokenPath), { recursive: true });
    await fsp.writeFile(tokenPath, token, { mode: 0o600 });
    console.log(chalk.green('Hub token saved to ' + tokenPath));
    return;
  }

  if (action === 'logout') {
    try {
      await fsp.unlink(hubTokenPath());
      console.log(chalk.green('Hub token removed.'));
    } catch {
      console.log(chalk.gray('No hub token found.'));
    }
    return;
  }

  console.error(
    'Usage: carina hub <start|browse|status|catalog|search|ecosystem|author|show|info|install|enable|disable|update|remove|uninstall|list|outdated|login|logout|packs|skills|publish> [args]',
  );
  process.exit(1);
}
