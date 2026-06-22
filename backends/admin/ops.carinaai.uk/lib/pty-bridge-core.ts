import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage } from 'node:http';
import { peekWsToken } from './ws-tokens.js';

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
let __opsDir = path.dirname(__moduleDir);
if (path.basename(__opsDir) === 'dist') {
  __opsDir = path.dirname(__opsDir);
}

function resolveDefaultCoreRoot(): string {
  if (process.env.CARINA_CORE_ROOT?.trim()) {
    return path.resolve(process.env.CARINA_CORE_ROOT.trim());
  }
  const candidates = [
    path.resolve(__opsDir, '../core.carinaai.uk'),
    path.resolve(__opsDir, '../../servers/core.carinaai.uk'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  }
  return candidates[0];
}

export interface CarinaSpawnCommand {
  file: string;
  args: string[];
  cwd: string;
}

export function resolveCarinaCliCommand(cliArgs: string[]): CarinaSpawnCommand {
  const coreRoot = resolveDefaultCoreRoot();

  if (process.env.CARINA_BIN?.trim()) {
    const bin = path.resolve(process.env.CARINA_BIN.trim());
    if (bin.endsWith('.ts')) {
      const tsxCli = path.join(coreRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
      if (fs.existsSync(tsxCli)) {
        return { file: process.execPath, args: [tsxCli, bin, ...cliArgs], cwd: coreRoot };
      }
    }
    return { file: process.execPath, args: [bin, ...cliArgs], cwd: coreRoot };
  }

  const distBin = path.join(coreRoot, 'dist', 'bin', 'carina.js');
  if (fs.existsSync(distBin)) {
    return { file: process.execPath, args: [distBin, ...cliArgs], cwd: coreRoot };
  }

  const srcBin = path.join(coreRoot, 'bin', 'carina.ts');
  const tsxCli = path.join(coreRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  if (fs.existsSync(srcBin) && fs.existsSync(tsxCli)) {
    return { file: process.execPath, args: [tsxCli, srcBin, ...cliArgs], cwd: coreRoot };
  }

  throw new Error('Carina CLI not found. Set CARINA_CORE_ROOT or CARINA_BIN.');
}

export function resolveCarinaSpawnCommand(): CarinaSpawnCommand {
  const mode = process.env.CARINA_TUI_MODE ?? 'simple';
  const tuiArgs = mode === 'ink'
    ? ['tui']
    : mode === 'simple'
      ? ['tui', '--simple']
      : ['tui', '--operator'];
  return resolveCarinaCliCommand(tuiArgs);
}

function resolveBridgeSecret(): string {
  return (
    process.env.CARINA_TERMINAL_BRIDGE_SECRET?.trim() ||
    process.env.CARINA_INTERNAL_KEY?.trim() ||
    process.env.CARINA_OPS_TOKEN?.trim() ||
    ''
  );
}

function verifyBridgeJwt(token: string): boolean {
  const secret = resolveBridgeSecret();
  if (!secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [header, body, sig] = parts as [string, string, string];
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  if (sig !== expected) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as {
      kind?: string;
      exp?: number;
    };
    if (payload.kind !== 'terminal-bridge') return false;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export function isWsAuthorized(req: IncomingMessage): boolean {
  const auth = req.headers.authorization ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const adminToken = process.env.ADMIN_WS_TOKEN?.trim();
  if (adminToken && bearer === adminToken) return true;

  const url = new URL(req.url ?? '/', 'http://localhost');
  const queryToken = url.searchParams.get('token') ?? '';
  if (queryToken && peekWsToken(queryToken)) return true;
  if (queryToken && verifyBridgeJwt(queryToken)) return true;

  if (process.env.NODE_ENV === 'development') return true;
  return false;
}

export function validateWsAuthToken(req: IncomingMessage): boolean {
  return isWsAuthorized(req);
}
