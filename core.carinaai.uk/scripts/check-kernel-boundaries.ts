#!/usr/bin/env tsx
/**
 * CI guard: @verlox/carina-core must not import commercial/private server code.
 * Run: pnpm boundary-check
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const PKG_JSON = path.join(ROOT, 'package.json');

const FORBIDDEN_IMPORT_PATTERNS = [
  /ops\.carinaai\.uk/,
  /console\.labyrinthscout\.com/,
  /\.\.\/ops\.carinaai/,
  /\.\.\/console\.labyrinthscout/,
];

const FORBIDDEN_FILES_PATTERNS = [
  /ops\.carinaai\.uk/,
  /console\.labyrinthscout\.com/,
  /labyrinthscout\.com\/src/,
];

const ALLOWED_DYNAMIC_IMPORTS = [
  /@carina\/scout/,
  /@carina\/web/,
  /@carina\/pack-/,
];

type Violation = { file: string; line: number; message: string };

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walkTsFiles(full, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

function checkSourceImports(): Violation[] {
  const violations: Violation[] = [];
  const files = walkTsFiles(SRC);

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const trimmed = line.trim();
      if (!trimmed.includes('import') && !trimmed.includes('require')) continue;

      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (!pattern.test(line)) continue;
        if (/^\s*\/\//.test(trimmed) || trimmed.startsWith('*')) continue;
        violations.push({
          file: rel,
          line: i + 1,
          message: `Forbidden import reference: ${pattern}`,
        });
      }

      if (/import\s*\(\s*['"][^'"]+['"]\s*\)/.test(line)) {
        const isAllowed = ALLOWED_DYNAMIC_IMPORTS.some((p) => p.test(line));
        if (isAllowed) continue;
        for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              file: rel,
              line: i + 1,
              message: 'Forbidden dynamic import of commercial server code',
            });
          }
        }
      }
    }
  }

  return violations;
}

function checkPackageFiles(): Violation[] {
  const violations: Violation[] = [];
  const pkg = JSON.parse(fs.readFileSync(PKG_JSON, 'utf8')) as { files?: string[] };
  const files: string[] = pkg.files ?? [];

  for (const entry of files) {
    for (const pattern of FORBIDDEN_FILES_PATTERNS) {
      if (pattern.test(entry)) {
        violations.push({
          file: 'package.json',
          line: 0,
          message: `Forbidden path in npm files list: ${entry}`,
        });
      }
    }
  }

  const distOps = path.join(ROOT, 'dist', 'src', 'gateway', 'web', 'ops');
  const srcOps = path.join(SRC, 'gateway', 'web', 'ops');
  if (fs.existsSync(srcOps)) {
    violations.push({
      file: 'src/gateway/web/ops',
      line: 0,
      message: 'Carina Ops UI must not live in @verlox/carina-core source (use hosted SaaS layer or ops.carinaai.uk)',
    });
  }
  if (fs.existsSync(distOps)) {
    violations.push({
      file: 'dist/src/gateway/web/ops',
      line: 0,
      message: 'Built tarball must not include gateway/web/ops (run prune-pack-dist.mjs)',
    });
  }

  return violations;
}

function main(): void {
  const violations = [...checkSourceImports(), ...checkPackageFiles()];

  if (violations.length === 0) {
    console.log('[boundary-check] OK: no commercial boundary violations');
    return;
  }

  console.error('[boundary-check] FAILED: commercial boundary violations found:\n');
  for (const v of violations) {
    const loc = v.line > 0 ? `${v.file}:${v.line}` : v.file;
    console.error(`  ${loc}: ${v.message}`);
  }
  process.exit(1);
}

main();
