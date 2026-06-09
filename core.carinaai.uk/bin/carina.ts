#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { envExists } from '../src/config/load-env.js';
import { CARINA_PACKS_DIR } from '../src/config/paths.js';
import { runCliSetup } from '../src/cli/commands/setup.js';
import { getConfigValue, loadFromYaml, setConfigValue } from '../src/cli/config/loader.js';
import { loadLocalEnv } from '../src/cli/config/env.js';

const args = process.argv.slice(2);
const command = args[0] ?? '';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readPackageInfo(): { name: string; version: string } {
  const candidates = [
    path.resolve(__dirname, '../package.json'),
    path.resolve(__dirname, '../../package.json'),
  ];
  for (const packagePath of candidates) {
    if (!fs.existsSync(packagePath)) continue;
    const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf-8')) as { name?: string; version?: string };
    return {
      name: parsed.name ?? 'carina',
      version: parsed.version ?? '0.0.0',
    };
  }
  return { name: 'carina', version: '0.0.0' };
}

const PACKAGE = readPackageInfo();

async function runAgent(cliOnly: boolean): Promise<void> {
  if (!envExists()) {
    await runCliSetup();
  }
  if (cliOnly) {
    process.env.WEB_ENABLED = 'false';
    process.env.TELEGRAM_BOT_TOKEN = '';
  }
  await import('../src/index.js');
}

async function runChat(): Promise<void> {
  loadLocalEnv();
  await runAgent(true);
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

async function runProfileCommand(): Promise<void> {
  const action = args[1] ?? 'list';
  const name = args[2];
  const {
    listProfiles,
    createProfile,
    activateProfile,
    getActiveProfileName,
  } = await import('../src/profiles/manager.js');

  if (action === 'list') {
    const profiles = await listProfiles();
    const active = getActiveProfileName();
    if (profiles.length === 0) {
      console.log('No profiles. Create one: carina profile create <name>');
      return;
    }
    for (const p of profiles) {
      console.log(active === p ? `* ${p}` : `  ${p}`);
    }
    return;
  }

  if (action === 'create') {
    if (!name) {
      console.error('Usage: carina profile create <name>');
      process.exit(1);
    }
    const profile = await createProfile(name);
    console.log(`Profile created: ${profile.name}`);
    console.log(`  dir: ${profile.dir}`);
    return;
  }

  if (action === 'use') {
    if (!name) {
      console.error('Usage: carina profile use <name>');
      process.exit(1);
    }
    const profile = activateProfile(name);
    console.log(`Active profile: ${profile.name}`);
    console.log(`  CARINA_HOME=${profile.dir}`);
    return;
  }

  console.error('Usage: carina profile <list|create|use> [name]');
  process.exit(1);
}

async function runConfigCommand(): Promise<void> {
  const action = args[1] ?? 'list';
  const keyPath = args[2];
  const value = args[3];

  if (action === 'list') {
    console.log(YAML.stringify(await loadFromYaml()));
    return;
  }

  if (action === 'get') {
    if (!keyPath) {
      console.error('Usage: carina config get <path>');
      process.exit(1);
    }
    const result = await getConfigValue(keyPath);
    if (typeof result === 'object') console.log(YAML.stringify(result));
    else console.log(result ?? '');
    return;
  }

  if (action === 'set') {
    if (!keyPath || value === undefined) {
      console.error('Usage: carina config set <path> <value>');
      process.exit(1);
    }
    await setConfigValue(keyPath, value);
    console.log(`Updated ${keyPath}`);
    return;
  }

  console.error('Usage: carina config <list|get|set>');
  process.exit(1);
}

async function main(): Promise<void> {
  switch (command) {
    case 'setup':
      await runCliSetup();
      break;
    case 'serve':
      loadLocalEnv();
      {
        const { runServe } = await import('../src/cli/commands/serve.js');
        await runServe();
      }
      break;
    case 'config':
      await runConfigCommand();
      break;
    case 'profile':
      await runProfileCommand();
      break;
    case 'chat':
      await runChat();
      break;
    case 'tui': {
      loadLocalEnv();
      const { runTui } = await import('../src/tui/index.js');
      await runTui({ memoryReady: true });
      break;
    }
    case 'install-pack': {
      const name = args[1];
      if (!name) {
        console.error('Usage: carina install-pack <pack-name>');
        process.exit(1);
      }
      const { installPack } = await import('../src/setup/install-pack.js');
      await installPack(name);
      break;
    }
    case 'list-packs':
      await listPacks();
      break;
    case 'ide': {
      const action = args[1] ?? 'install';
      const target = (args[2] ?? 'all') as 'vscode' | 'cursor' | 'all';
      const { buildIdeExtensions, installIdeExtension } = await import('../src/cli/commands/ide.js');
      if (action === 'build') {
        await buildIdeExtensions();
      } else if (action === 'install') {
        await installIdeExtension(target);
      } else {
        console.error('Usage: carina ide <install|build> [vscode|cursor|all]');
        process.exit(1);
      }
      break;
    }
    case 'web':
      loadLocalEnv();
      process.env.WEB_ENABLED = 'true';
      process.env.SKIP_CLI = 'true';
      await runAgent(false);
      break;
    case 'version':
    case '--version':
    case '-v':
      console.log(`${PACKAGE.name} ${PACKAGE.version}`);
      break;
    case 'help':
    case '--help':
    case '-h':
      console.log(`Carina v${PACKAGE.version}

Usage:
  carina                  Start interactive CLI (default)
  carina chat             Start interactive CLI
  carina tui              Rich terminal UI (provider/profile picker)
  carina setup            First-run setup wizard
  carina serve            Start local web/API server on localhost:3000
  carina config list      Print ~/.carina/config.yaml
  carina config get <key> Read a config value
  carina config set <key> <value>
  carina profile list       List isolated profiles
  carina profile create <n> Create a new profile
  carina profile use <n>    Switch active profile
  carina install-pack <n> Install skill pack from Skills Hub
  carina list-packs       List installed skill packs
  carina ide install      Build and install VS Code + Cursor extensions
  carina ide install vscode|cursor
  carina ide build        Build VSIX packages only
  carina web              Start web UI only
  carina --version        Print version
`);
      break;
    default:
      await runChat();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
