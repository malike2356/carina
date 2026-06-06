#!/usr/bin/env node
import fs from 'fs';
import { envExists } from '../src/config/load-env.js';
import { CARINA_PACKS_DIR } from '../src/config/paths.js';
import { ensureCarinaHome, runSetupWizard } from '../src/setup/wizard.js';
import { installPack } from '../src/setup/install-pack.js';

const VERSION = '0.1.0';
const args = process.argv.slice(2);
const command = args[0] ?? '';

async function runAgent(cliOnly: boolean): Promise<void> {
  if (!envExists()) {
    await ensureCarinaHome();
    await runSetupWizard();
  }
  if (cliOnly) {
    process.env.WEB_ENABLED = 'false';
    process.env.TELEGRAM_BOT_TOKEN = '';
  }
  await import('../src/index.js');
}

async function listPacks(): Promise<void> {
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
  for (const p of packs) console.log('  -', p);
}

async function main(): Promise<void> {
  switch (command) {
    case 'setup':
      await ensureCarinaHome();
      await runSetupWizard();
      break;
    case 'install-pack': {
      const name = args[1];
      if (!name) {
        console.error('Usage: carina install-pack <pack-name>');
        process.exit(1);
      }
      await installPack(name);
      break;
    }
    case 'list-packs':
      await listPacks();
      break;
    case 'web':
      process.env.WEB_ENABLED = 'true';
      process.env.SKIP_CLI = 'true';
      await runAgent(false);
      break;
    case 'version':
      console.log('carina-agent', VERSION);
      break;
    case 'help':
    case '--help':
    case '-h':
      console.log(`Carina Agent v${VERSION}

Usage:
  carina                  Start interactive CLI (default)
  carina setup            First-run setup wizard
  carina install-pack <n> Install skill pack from Skills Hub
  carina list-packs       List installed skill packs
  carina web              Start web UI only
  carina version          Print version
`);
      break;
    default:
      await runAgent(true);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
