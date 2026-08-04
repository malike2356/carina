import chalk from 'chalk';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

export function resolvePackageJsonPath(here = path.dirname(fileURLToPath(import.meta.url))): string {
  const candidates = [
    path.resolve(here, '../../../package.json'),
    path.resolve(here, '../../../../package.json'),
  ];

  for (const pkgPath of candidates) {
    if (!existsSync(pkgPath)) continue;
    return pkgPath;
  }

  throw new Error(`Unable to resolve Carina package.json from ${here}`);
}

function readVersion(): string {
  const pkgPath = resolvePackageJsonPath();
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
  if (pkg.version) return pkg.version;
  throw new Error(`Carina package.json at ${pkgPath} does not contain a version`);
}

async function runGlobalNpmInstall(spec: string): Promise<void> {
  await execFileAsync('npm', ['install', '-g', spec, '--loglevel=error'], {
    windowsHide: true,
  });
}

export async function runUpdateCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'check';
  const json = args.includes('--json');
  const current = readVersion();

  if (action === 'check') {
    let latest = current;
    let registryReachable = true;
    try {
      const res = await fetch('https://registry.npmjs.org/carina-agent/latest', {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json() as { version: string };
        latest = data.version;
      } else {
        registryReachable = false;
      }
    } catch {
      registryReachable = false;
    }
    const installHint = process.platform === 'win32'
      ? 'carina update run  (or reinstall carina-setup.exe)'
      : 'carina update run  (or: npm install -g carina-agent@latest)';
    const payload = {
      current,
      latest,
      updateAvailable: latest !== current,
      registryReachable,
      installHint,
    };
    if (json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    if (!registryReachable) console.log(chalk.yellow('Could not reach npm registry.'));
    console.log(`Installed: ${current}`);
    console.log(`Latest:    ${latest}`);
    if (latest !== current) {
      console.log(chalk.yellow(`\nUpdate: ${installHint}`));
    } else {
      console.log(chalk.green('\nYou are on the latest version.'));
    }
    return;
  }

  if (action === 'run') {
    const versionArg = args.find((a) => a.startsWith('--version='))?.slice('--version='.length);
    const spec = versionArg ? `carina-agent@${versionArg}` : 'carina-agent@latest';
    console.log(chalk.cyan(`Updating ${spec}...`));
    try {
      await runGlobalNpmInstall(spec);
      console.log(chalk.green('Update complete.'));
      console.log('Restart open terminals, then run: carina doctor');
      if (process.platform === 'win32') {
        console.log('Or reinstall from the latest carina-setup.exe if PATH issues persist.');
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`Update failed: ${detail}`));
      console.error('Try manually: npm install -g ' + spec);
      process.exit(1);
    }
    return;
  }

  console.error('Usage: carina update <check|run> [--version=x.y.z]');
  process.exit(1);
}
