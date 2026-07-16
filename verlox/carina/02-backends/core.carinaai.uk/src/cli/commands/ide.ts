import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function repoRoot(): string {
  const candidates = [
    path.resolve(__dirname, '../../../../'),
    path.resolve(__dirname, '../../../'),
    process.cwd(),
    path.resolve(process.cwd(), '..'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'extensions'))) return dir;
  }
  throw new Error('Carina repo root not found.');
}

function extensionDir(): string {
  const dir = path.join(repoRoot(), 'extensions', 'carina-ide');
  if (!fs.existsSync(path.join(dir, 'package.json'))) {
    throw new Error('Carina VS Code extension sources not found.');
  }
  return dir;
}

function jetbrainsDir(): string {
  const dir = path.join(repoRoot(), 'extensions', 'carina-jetbrains');
  if (!fs.existsSync(path.join(dir, 'build.gradle.kts'))) {
    throw new Error('Carina JetBrains plugin sources not found.');
  }
  return dir;
}

function run(cmd: string, cwd: string): void {
  execSync(cmd, { cwd, stdio: 'inherit', shell: '/bin/bash' });
}

function findJetBrainsZip(): string {
  const dist = path.join(jetbrainsDir(), 'build', 'distributions');
  if (!fs.existsSync(dist)) throw new Error('JetBrains build/distributions not found. Run build first.');
  const zip = fs.readdirSync(dist).find((f) => f.endsWith('.zip'));
  if (!zip) throw new Error('No .zip in build/distributions');
  return path.join(dist, zip);
}

export async function buildJetBrainsPlugin(): Promise<string> {
  const dir = jetbrainsDir();
  run('bash scripts/build.sh', dir);
  return findJetBrainsZip();
}

async function installVsCodeTargets(target: 'vscode' | 'cursor' | 'zed' | 'all'): Promise<void> {
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

  if (target === 'zed' || target === 'all') {
    run('pnpm package:zed', dir);
    installVsix('carina-zed', 'zed');
  }
}

export async function installIdeExtension(
  target: 'vscode' | 'cursor' | 'zed' | 'jetbrains' | 'all' = 'all',
): Promise<void> {
  if (target === 'jetbrains') {
    const zip = await buildJetBrainsPlugin();
    console.log(`JetBrains plugin built: ${zip}`);
    console.log('Install: Settings > Plugins > Install Plugin from Disk...');
    return;
  }

  if (target === 'all') {
    const zip = await buildJetBrainsPlugin();
    console.log(`JetBrains plugin built: ${zip}`);
    console.log('Install manually: Settings > Plugins > Install Plugin from Disk...');
    await installVsCodeTargets('all');
    return;
  }

  await installVsCodeTargets(target);
}

export async function buildIdeExtensions(): Promise<void> {
  const zip = await buildJetBrainsPlugin();
  console.log(`JetBrains: ${zip}`);

  const dir = extensionDir();
  if (!fs.existsSync(path.join(dir, 'node_modules'))) {
    run('pnpm install', dir);
  }
  run('pnpm package', dir);
  run('pnpm package:cursor', dir);
  run('pnpm package:zed', dir);
  console.log('Built carina-vscode, carina-cursor, carina-zed VSIX + JetBrains zip');
}
