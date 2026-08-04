import fs from 'fs';
import { CARINA_PACKS_DIR } from '../../config/paths.js';

export async function runPacksCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';
  const name = args[1];

  if (action === 'list') {
    if (!fs.existsSync(CARINA_PACKS_DIR)) {
      console.log('No skill packs installed.');
      return;
    }
    const entries = fs.readdirSync(CARINA_PACKS_DIR, { withFileTypes: true });
    const packs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    if (packs.length === 0) {
      console.log('No skill packs installed.');
      return;
    }
    console.log('Installed packs:');
    for (const p of packs) console.log(`  - ${p}`);
    return;
  }

  if (action === 'install') {
    if (!name) {
      console.error('Usage: carina packs install <pack-name>');
      process.exit(1);
    }
    const { installPack } = await import('../../setup/install-pack.js');
    await installPack(name);
    return;
  }

  if (action === 'remove') {
    if (!name) {
      console.error('Usage: carina packs remove <pack-name>');
      process.exit(1);
    }
    const target = `${CARINA_PACKS_DIR}/${name}`;
    if (!fs.existsSync(target)) {
      console.error(`Pack not found: ${name}`);
      process.exit(1);
    }
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`Removed pack: ${name}`);
    return;
  }

  console.error('Usage: carina packs <list|install|remove> [name]');
  process.exit(1);
}
