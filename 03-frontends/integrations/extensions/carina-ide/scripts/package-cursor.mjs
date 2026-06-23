import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const extRoot = path.join(root, '..');
const pkgPath = path.join(extRoot, 'package.json');
const cursorPath = path.join(extRoot, 'cursor-package.json');
const backupPath = path.join(extRoot, 'package.vscode.backup.json');

const vscodePkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const cursorBase = JSON.parse(fs.readFileSync(cursorPath, 'utf8'));

const merged = {
  ...vscodePkg,
  ...cursorBase,
  scripts: vscodePkg.scripts,
  devDependencies: vscodePkg.devDependencies,
};

fs.writeFileSync(backupPath, JSON.stringify(vscodePkg, null, 2));
fs.writeFileSync(pkgPath, JSON.stringify(merged, null, 2));

try {
  execSync('pnpm build && vsce package --no-dependencies -o carina-cursor-0.1.0.vsix', {
    cwd: extRoot,
    stdio: 'inherit',
    env: { ...process.env, CARINA_IDE_CLIENT: 'cursor' },
  });
} finally {
  fs.writeFileSync(pkgPath, fs.readFileSync(backupPath, 'utf8'));
  fs.unlinkSync(backupPath);
}
