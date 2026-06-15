import type { HubPackRow } from '../../../skills/hub/registry.js';
import { isPackVerified } from '../../../skills/hub/hub-client.js';

export function formatPackSearchTable(packs: HubPackRow[]): string {
  if (packs.length === 0) return 'No packs matched your query.';
  const lines = ['NAME                VERSION  VERIFIED  AUTHOR              DESCRIPTION'];
  for (const p of packs) {
    const verified = isPackVerified(p) ? 'yes' : '';
    lines.push(
      [
        p.name.padEnd(20),
        p.version.padEnd(8),
        verified.padEnd(9),
        (p.author ?? '').slice(0, 18).padEnd(20),
        p.description.slice(0, 60),
      ].join(' '),
    );
  }
  return lines.join('\n');
}

export function parseSemver(version: string): [number, number, number] {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isSemverNewer(candidate: string, current: string): boolean {
  const a = parseSemver(candidate);
  const b = parseSemver(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

export function readFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

export function readOption(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx < 0) return undefined;
  return args[idx + 1];
}

export function positionalArg(args: string[]): string | undefined {
  return args.find((a) => !a.startsWith('--'));
}
