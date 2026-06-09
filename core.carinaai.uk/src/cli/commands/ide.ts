import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function extensionDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../../../extensions/carina-ide'),
    path.resolve(__dirname, '../../../extensions/carina-ide'),
    path.resolve(process.cwd(), '../extensions/carina-ide'),
    path.resolve(process.cwd(), 'extensions/carina-ide'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
  }
  throw new Error('Carina IDE extension sources not found. Clone the full carina repo.');
}

function run(cmd: string, cwd: string): void {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

export async function installIdeExtension(target: 'vscode' | 'cursor' | 'all' = 'all'): Promise<void> {
  const dir = extensionDir();
  if (!fs.existsSync(path.join(dir, 'node_modules'))) {
    console.log('Installing extension dependencies...');
    run('pnpm install', dir);
  }

  const findVsix = (prefix: string): string => {
    const direct = fs.readdirSync(dir).find((f) => f.startsWith(prefix) && f.endsWith('.vsix'));
    if (!direct) throw new Error(`Missing ${prefix}*.vsix. Build failed.`);
    return path.join(dir, direct);
  };

  const installVsix = (prefix: string, cli: string) => {
    const full = findVsix(prefix);
    try {
      run(`${cli} --install-extension "${full}"`, dir);
      console.log(`Installed ${path.basename(full)} via ${cli}`);
    } catch {
      console.log(`Built ${full}. Install manually: ${cli} --install-extension ${full}`);
    }
  };

  if (target === 'vscode' || target === 'all') {
    run('pnpm package', dir);
    installVsix('carina-vscode', 'code');
  }

  if (target === 'cursor' || target === 'all') {
    run('pnpm package:cursor', dir);
    installVsix('carina-cursor', 'cursor');
  }
}

export async function buildIdeExtensions(): Promise<void> {
  const dir = extensionDir();
  if (!fs.existsSync(path.join(dir, 'node_modules'))) {
    run('pnpm install', dir);
  }
  run('pnpm package', dir);
  run('pnpm package:cursor', dir);
  console.log('Built carina-vscode and carina-cursor VSIX packages in extensions/carina-ide/');
}
