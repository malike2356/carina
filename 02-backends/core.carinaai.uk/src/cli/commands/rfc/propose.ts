import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPackageInfo } from '../../registry.js';
import { config } from '../../../config/index.js';
import {
  defaultRfcDirFromModule,
  proposeRfc,
  resolveRfcDir,
} from './rfc-lib.js';

export async function runRfcPropose(args: string[]): Promise<void> {
  const title = args.join(' ').trim().replace(/^["']|["']$/g, '');
  if (!title) {
    console.error('Usage: carina rfc propose "<title>"');
    process.exit(1);
  }

  const rfcDir = resolveRfcDir(process.cwd());
  const fallbackDir = defaultRfcDirFromModule(import.meta.url);
  const effectiveDir = await dirHasTemplate(rfcDir) ? rfcDir : fallbackDir;

  const pkg = readPackageInfo();
  const targetVersion = pkg.version ? `@verlox/carina-core ${pkg.version}` : '@verlox/carina-core 0.x';

  const result = await proposeRfc(title, {
    rfcDir: effectiveDir,
    targetApiVersion: targetVersion,
  });

  console.log(`Created ${result.relativePath}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Edit the RFC (Summary, Motivation, Design, Drawbacks, Alternatives)');
  console.log('  2. Optional: post a draft in GitHub Discussions (RFCs category) for pre-PR feedback');
  console.log('  3. Open a PR with this RFC file for community review');
  console.log('');
  console.log(`Docs: ${config.product.docsUrl}/developer/rfc-process`);

  const editor = process.env.EDITOR ?? process.env.VISUAL;
  if (editor) {
    const child = spawn(editor, [result.filePath], {
      stdio: 'inherit',
      shell: true,
    });
    await new Promise<void>((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${editor} exited with code ${code}`));
      });
    });
  } else {
    console.log(`Edit: ${result.filePath}`);
  }
}

async function dirHasTemplate(dir: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, '0000-template.md'));
    return true;
  } catch {
    return false;
  }
}
