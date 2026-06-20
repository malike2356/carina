#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runCli, setPackageInfo } from '../src/cli/registry.js';
import type { PackageInfo } from '../src/cli/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readPackageInfo(): PackageInfo {
  if (process.env.CARINA_PACKAGE_NAME) {
    return {
      name: process.env.CARINA_PACKAGE_NAME,
      version: process.env.CARINA_PACKAGE_VERSION ?? '0.0.0',
    };
  }
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

function isInteractiveLaunch(args: string[]): boolean {
  if (args.length === 0) return true;
  if (args.length === 1 && (args[0] === '--interactive' || args[0] === '-i')) return true;
  return false;
}

const pkg = readPackageInfo();
setPackageInfo(pkg);

const args = process.argv.slice(2);

if (args.includes('--setup')) {
  const rest = args.filter((a) => a !== '--setup' && a !== '--interactive' && a !== '-i');
  import('../src/cli/commands/setup.js')
    .then(({ runCliSetup }) => runCliSetup(rest))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else if (isInteractiveLaunch(args)) {
  import('../src/tui/ink/start.js')
    .then(({ startInkTUI }) => startInkTUI({ version: pkg.version }))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else {
  const cliArgs = args.filter((a) => a !== '--interactive' && a !== '-i');
  runCli(cliArgs, pkg).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
