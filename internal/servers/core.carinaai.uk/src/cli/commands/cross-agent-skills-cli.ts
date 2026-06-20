import chalk from 'chalk';
import readline from 'readline';
import { CrossEcosystemSearch, getLastSearchResults } from '../../skills/cross-agent/discovery/search.js';
import { indexAllSources } from '../../skills/cross-agent/discovery/indexer.js';
import { ingestNamedEcosystemSkill, ingestSkill, fetchSkillContent, buildMetadata } from '../../skills/cross-agent/pipeline.js';
import { listImportedSkills } from '../../skills/cross-agent/store.js';
import type { CarinaSkill } from '../../skills/cross-agent/types.js';
import { llmConvert } from '../../skills/cross-agent/llm-service.js';
import { detectFormat } from '../../skills/cross-agent/detector.js';

function parseFlags(args: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--all') flags.all = true;
    else if (arg === '--no-cache') flags.noCache = true;
    else if (arg === '--llm') flags.llm = true;
    else if (arg === '--json') flags.json = true;
    else if (arg === '--yes' || arg === '-y') flags.yes = true;
    else if (arg.startsWith('--hub=')) flags.hub = arg.slice('--hub='.length);
    else if (arg === '--hub') flags.hub = args[++i] ?? '';
    else if (arg.startsWith('--from=')) flags.from = arg.slice('--from='.length);
    else if (arg === '--from') flags.from = args[++i] ?? '';
    else if (arg.startsWith('--llm-model=')) flags.llmModel = arg.slice('--llm-model='.length);
    else if (arg === '--llm-model') flags.llmModel = args[++i] ?? '';
    else if (arg.startsWith('--source=')) flags.source = arg.slice('--source='.length);
    else if (arg === '--source') flags.source = args[++i] ?? '';
    else if (arg.startsWith('--result=')) flags.result = arg.slice('--result='.length);
    else if (arg === '--result') flags.result = args[++i] ?? '';
  }
  return flags;
}

async function promptYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question(`${question} [y/N] `, resolve);
  });
  rl.close();
  return answer.trim().toLowerCase() === 'y';
}

function printSkillPreview(skill: CarinaSkill): void {
  console.log(chalk.bold('\nConverted Skill Preview\n'));
  console.log(`  Name:        ${skill.name}`);
  console.log(`  Description: ${skill.description}`);
  console.log(`  Category:    ${skill.category}`);
  console.log(`  Tags:        ${skill.tags.join(', ') || 'none'}`);
  console.log(`  Triggers:    ${skill.triggers.join(', ') || 'none'}`);
  console.log(`  Tools:       ${skill.tools.required.join(', ') || 'none detected'}`);
  console.log(`  Permissions: network=${skill.permissions.network}, shell=${skill.permissions.shell}`);
  console.log(`\n  Body preview:\n  ${skill.content.slice(0, 500).replace(/\n/g, '\n  ')}${skill.content.length > 500 ? '...' : ''}\n`);
}

export async function runCrossAgentSkillsCommand(action: string, args: string[] = []): Promise<void> {
  const flags = parseFlags(args);
  const positional = args.filter((a) => !a.startsWith('--') && !['-y'].includes(a));

  if (action === 'search') {
    const query = positional.join(' ').trim();
    if (!query) {
      console.error('Usage: carina skills search <query> [--all] [--hub <source>] [--no-cache]');
      process.exit(1);
    }
    const search = new CrossEcosystemSearch();
    const result = await search.search(query, {
      sources: flags.hub ? [String(flags.hub)] : flags.all ? undefined : ['carina-hub', 'hermes-hub', 'openclaw-hub'],
      limit: flags.all ? 20 : 10,
      noCache: Boolean(flags.noCache),
    });
    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(chalk.bold(`\nSearch: "${query}" (${result.totalResults} results, ${result.searchTime}ms)\n`));
    let idx = 1;
    for (const source of result.sources) {
      console.log(chalk.cyan(`${source.name} (${source.resultCount})`));
    }
    console.log('');
    for (const row of result.results.slice(0, 30)) {
      console.log(
        `  ${String(idx++).padStart(2)}. ${row.name.padEnd(28)} ${row.source.padEnd(14)} ${row.version.padEnd(8)} ${row.ingestMethod ?? ''}`,
      );
      console.log(chalk.gray(`      ${row.description.slice(0, 80)}`));
    }
    console.log('');
    return;
  }

  if (action === 'sources') {
    const search = new CrossEcosystemSearch();
    const health = await search.connectorHealth();
    if (flags.json) {
      console.log(JSON.stringify(health, null, 2));
      return;
    }
    console.log(chalk.bold('\nSkill source connectors\n'));
    for (const row of health) {
      const status = row.available ? chalk.green('connected') : chalk.red('unavailable');
      console.log(`  ${row.name.padEnd(18)} ${status.padEnd(20)} ${row.latency}ms`);
    }
    console.log('');
    return;
  }

  if (action === 'info') {
    const name = positional[0];
    const source = String(flags.source ?? positional[1] ?? '');
    if (!name || !source) {
      console.error('Usage: carina skills info --source <hub> <name>');
      process.exit(1);
    }
    const search = new CrossEcosystemSearch();
    const row = await search.getSkill(source, name);
    if (!row) {
      console.error(`Skill not found: ${source}/${name}`);
      process.exit(1);
    }
    if (flags.json) {
      console.log(JSON.stringify(row, null, 2));
      return;
    }
    console.log(JSON.stringify(row, null, 2));
    return;
  }

  if (action === 'install') {
    if (flags.result) {
      const index = Number.parseInt(String(flags.result), 10) - 1;
      const rows = getLastSearchResults();
      const selected = rows[index];
      if (!selected) {
        console.error(`No search result #${flags.result}. Run carina skills search first.`);
        process.exit(1);
      }
      const search = new CrossEcosystemSearch();
      const skill = await search.installSkill(selected);
      console.log(chalk.green(`Installed ${skill.name} from ${selected.source}`));
      return;
    }

    if (flags.from) {
      const name = positional[0];
      if (!name) {
        console.error('Usage: carina skills install --from <hub> <name>');
        process.exit(1);
      }
      const result = await ingestNamedEcosystemSkill(String(flags.from), name, {
        forceLlm: Boolean(flags.llm),
        llmModel: flags.llmModel ? String(flags.llmModel) : undefined,
        skipReview: Boolean(flags.yes),
      });
      console.log(chalk.green(`Installed ${result.skill.name} from ${flags.from}`));
      console.log(`  Path: ${result.filePath}`);
      return;
    }

    const source = positional[0];
    if (!source) {
      console.error('Usage: carina skills install <url|path> [--llm] [--llm-model <model>] [--yes]');
      process.exit(1);
    }

    const fetched = await fetchSkillContent(source);
    const detection = await detectFormat(fetched.content, fetched.fileName);
    const metadata = buildMetadata(fetched.content, fetched.fileName, fetched.sourceUrl, detection.format);

    if (flags.llm || detection.confidence < 0.5 || detection.converter === 'llm-fallback') {
      console.log(chalk.yellow('Format uncertain or LLM forced. Running universal conversion...'));
      const llm = await llmConvert(fetched.content, metadata, {
        model: flags.llmModel ? String(flags.llmModel) : undefined,
      });
      printSkillPreview(llm.skill);
      if (!flags.yes) {
        const ok = await promptYesNo('Install this converted skill?');
        if (!ok) {
          console.log('Cancelled.');
          return;
        }
      }
    }

    const result = await ingestSkill(source, {
      forceLlm: Boolean(flags.llm),
      llmModel: flags.llmModel ? String(flags.llmModel) : undefined,
      skipReview: Boolean(flags.yes),
    });

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(chalk.green(`Installed ${result.skill.name}`));
    console.log(`  Source: ${result.skill.source.hub} (${result.detection.format}, confidence ${result.detection.confidence.toFixed(2)})`);
    console.log(`  Path: ${result.filePath}`);
    if (result.securityFlags.length > 0) {
      console.log(chalk.yellow(`  Security flags: ${result.securityFlags.join(', ')}`));
    }
    return;
  }

  if (action === 'update') {
    const imported = await listImportedSkills();
    let updated = 0;
    for (const row of imported) {
      if (!row.skill.source.url.startsWith('http')) continue;
      try {
        await ingestSkill(row.skill.source.url, { skipReview: true });
        updated++;
      } catch {
        // keep existing version
      }
    }
    console.log(chalk.green(`Checked ${imported.length} imported skills; refreshed ${updated}.`));
    return;
  }

  if (action === 'index') {
    const search = new CrossEcosystemSearch();
    const count = await indexAllSources(async (query: string) => {
      const result = await search.search(query, { limit: 20, noCache: true });
      return result.results;
    });
    console.log(chalk.green(`Indexed ${count} skills across ecosystems.`));
    return;
  }
}
