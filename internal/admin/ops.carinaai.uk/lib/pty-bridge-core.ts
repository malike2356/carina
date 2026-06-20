import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage } from 'node:http';
import { peekWsToken } from './ws-tokens.js';

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
const __opsDir = path.basename(__moduleDir) === 'dist' ? path.dirname(__moduleDir) : path.resolve(__moduleDir, '..');

export interface CarinaSpawnCommand {
  file: string;
  args: string[];
  cwd: string;
}

export function resolveCarinaSpawnCommand(): CarinaSpawnCommand {
  const coreRoot = path.resolve(
    process.env.CARINA_CORE_ROOT ?? path.join(__opsDir, '..', 'core.carinaai.uk'),
  );
  const mode = process.env.CARINA_TUI_MODE ?? 'operator';
  const tuiArgs = mode === 'ink'
    ? ['tui']
    : mode === 'simple'
      ? ['tui', '--simple']
      : ['tui', '--operator'];

  if (process.env.CARINA_BIN?.trim()) {
    const bin = path.resolve(process.env.CARINA_BIN.trim());
    if (bin.endsWith('.ts')) {
      const tsxCli = path.join(coreRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
      if (fs.existsSync(tsxCli)) {
        return { file: process.execPath, args: [tsxCli, bin, ...tuiArgs], cwd: coreRoot };
      }
    }
    return { file: process.execPath, args: [bin, ...tuiArgs], cwd: coreRoot };
  }

  const distBin = path.join(coreRoot, 'dist', 'bin', 'carina.js');
  if (fs.existsSync(distBin)) {
    return { file: process.execPath, args: [distBin, ...tuiArgs], cwd: coreRoot };
  }

  const srcBin = path.join(coreRoot, 'bin', 'carina.ts');
  const tsxCli = path.join(coreRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  if (fs.existsSync(srcBin) && fs.existsSync(tsxCli)) {
    return { file: process.execPath, args: [tsxCli, srcBin, ...tuiArgs], cwd: coreRoot };
  }

  throw new Error('Carina CLI not found. Set CARINA_CORE_ROOT or CARINA_BIN.');
}

export function isWsAuthorized(req: IncomingMessage): boolean {
  const auth = req.headers.authorization ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const adminToken = process.env.ADMIN_WS_TOKEN?.trim();
  if (adminToken && bearer === adminToken) return true;

  const url = new URL(req.url ?? '/', 'http://localhost');
  const queryToken = url.searchParams.get('token') ?? '';
  if (queryToken && peekWsToken(queryToken)) return true;

  if (process.env.NODE_ENV === 'development') return true;
  return false;
}

export function validateWsAuthToken(req: IncomingMessage): boolean {
  return isWsAuthorized(req);
}
