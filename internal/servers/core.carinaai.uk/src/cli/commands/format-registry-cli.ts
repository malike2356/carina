import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { resolveCarinaHome } from '../../config/paths.js';
import { getFormatRegistryClient } from '../../skills/cross-agent/registry-client.js';
import { detectFormatFromSignatures } from '../../skills/cross-agent/detector.js';

export async function runFormatRegistryCommand(action: string, args: string[] = []): Promise<void> {
  const flags = args.includes('--json') ? { json: true } : { json: false };
  const positional = args.filter((a) => !a.startsWith('--'));
  const client = getFormatRegistryClient();
  await client.ensureLoaded();

  if (action === 'list') {
    const formats = client.listFormats();
    if (flags.json) {
      console.log(JSON.stringify(formats, null, 2));
      return;
    }
    console.log(chalk.bold(`\nFormat registry (${formats.length})\n`));
    for (const format of formats) {
      console.log(`  ${format.id.padEnd(22)} ${format.ecosystem.padEnd(14)} ${format.name}`);
    }
    console.log('');
    return;
  }

  if (action === 'search') {
    const query = positional.join(' ').trim();
    if (!query) {
      console.error('Usage: carina format-registry search <query>');
      process.exit(1);
    }
    const formats = client.searchFormats(query);
    if (flags.json) {
      console.log(JSON.stringify(formats, null, 2));
      return;
    }
    for (const format of formats) {
      console.log(`${format.id}  ${format.description}`);
    }
    return;
  }

  if (action === 'info') {
    const id = positional[0];
    if (!id) {
      console.error('Usage: carina format-registry info <id>');
      process.exit(1);
    }
    const format = client.getFormat(id);
    if (!format) {
      console.error(`Unknown format: ${id}`);
      process.exit(1);
    }
    console.log(JSON.stringify(format, null, 2));
    return;
  }

  if (action === 'update') {
    await client.refresh(true);
    const { hasUpdates, newFormats } = await client.checkForUpdates();
    if (flags.json) {
      console.log(JSON.stringify({ updated: true, hasUpdates, newFormats }, null, 2));
      return;
    }
    console.log(chalk.green(`Format registry refreshed. New formats: ${newFormats.length || 0}`));
    return;
  }

  if (action === 'contribute') {
    const id = positional[0] ?? 'custom-format';
    const source = positional[1];
    if (!source) {
      console.error('Usage: carina format-registry contribute <id> <skill-file>');
      process.exit(1);
    }
    const content = await fs.readFile(path.resolve(source), 'utf8');
    const detection = detectFormatFromSignatures(content, path.basename(source));
    const template = {
      id,
      name: id,
      version: '1.0.0',
      description: `Community format definition for ${id}`,
      ecosystem: 'custom',
      detection: {
        fileNames: [path.basename(source)],
        contentPatterns: [],
      },
      mapping: {
        category: { source: 'static', value: `imported-${id}` },
      },
      permissions: {
        defaults: { network: false, filesystem: [], shell: false },
      },
      suggestedDetection: detection,
    };
    const out = path.join(resolveCarinaHome(), 'skills', `${id}.format.json`);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, JSON.stringify(template, null, 2), 'utf8');
    console.log(chalk.green(`Wrote template: ${out}`));
    console.log('Edit the file, then submit with: carina format-registry submit <path>');
    return;
  }

  if (action === 'submit') {
    const file = positional[0];
    if (!file) {
      console.error('Usage: carina format-registry submit <format.json>');
      process.exit(1);
    }
    console.log(`Submit ${path.resolve(file)} to the public format-registry repository when ready.`);
    console.log('Local validation only in this build; open a PR at github.com/carinaai/format-registry');
    return;
  }

  console.error('Usage: carina format-registry <list|search|info|update|contribute|submit>');
  process.exit(1);
}
