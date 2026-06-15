import {
  defaultRfcDirFromModule,
  listRfcs,
  resolveRfcDir,
} from './rfc-lib.js';
import fs from 'node:fs/promises';
import path from 'node:path';

function readFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

export async function runRfcList(args: string[]): Promise<void> {
  const asJson = readFlag(args, '--json');
  const rfcDir = resolveRfcDir(process.cwd());
  const fallbackDir = defaultRfcDirFromModule(import.meta.url);
  const effectiveDir = await dirHasTemplate(rfcDir) ? rfcDir : fallbackDir;

  const rfcs = await listRfcs(effectiveDir);

  if (asJson) {
    console.log(JSON.stringify(rfcs, null, 2));
    return;
  }

  if (rfcs.length === 0) {
    console.log('No RFCs yet.');
    console.log('Create one: carina rfc propose "Your title"');
    return;
  }

  console.log('RFCs:\n');
  for (const rfc of rfcs) {
    const num = String(rfc.number).padStart(4, '0');
    console.log(`  RFC-${num}  ${rfc.status.padEnd(12)}  ${rfc.title}`);
    if (rfc.targetApiVersion) {
      console.log(`           ${rfc.targetApiVersion}`);
    }
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
