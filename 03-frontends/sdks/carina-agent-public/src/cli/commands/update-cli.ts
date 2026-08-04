import chalk from 'chalk';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function readVersion(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(here, '../../../package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
  return pkg.version;
}

export async function runUpdateCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'check';
  const current = readVersion();

  if (action === 'check') {
    let latest = current;
    try {
      const res = await fetch('https://registry.npmjs.org/carina-agent/latest', {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json() as { version: string };
        latest = data.version;
      }
    } catch {
      console.log(chalk.yellow('Could not reach npm registry.'));
    }
    console.log(`Installed: ${current}`);
    console.log(`Latest:    ${latest}`);
    if (latest !== current) {
      console.log(chalk.yellow('\nUpdate: npm install -g carina-agent@latest'));
    } else {
      console.log(chalk.green('\nYou are on the latest version.'));
    }
    return;
  }

  if (action === 'run') {
    console.log('Run globally: npm install -g carina-agent@latest');
    console.log('Or from source: cd core.carinaai.uk && pnpm build && npm link');
    return;
  }

  console.error('Usage: carina update <check|run>');
  process.exit(1);
}
