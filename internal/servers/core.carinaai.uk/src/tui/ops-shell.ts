import { execSync } from 'node:child_process';

const DIRECT_SHELL_COMMANDS = new Set([
  'ls', 'pwd', 'whoami', 'id', 'date', 'uname', 'df', 'du', 'echo', 'env', 'which',
  'ps', 'free', 'uptime', 'hostname', 'printenv', 'wc', 'tree', 'find', 'grep',
  'cat', 'head', 'tail', 'touch', 'mkdir', 'rm', 'mv', 'cp', 'chmod', 'stat', 'file',
  'npm', 'pnpm', 'node', 'git', 'docker', 'curl', 'wget', 'jq', 'tar', 'zip', 'unzip',
]);

const SHELL_COMMAND_ALIASES: Record<string, string> = {
  whomai: 'whoami',
  whami: 'whoami',
  woami: 'whoami',
};

export function parseOpsShellInput(line: string): { command: string; args: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('/')) return null;

  let body = trimmed.startsWith('!') ? trimmed.slice(1).trim() : trimmed;
  if (!body) return null;

  const spaceIdx = body.indexOf(' ');
  const rawFirst = spaceIdx === -1 ? body : body.slice(0, spaceIdx);
  const args = spaceIdx === -1 ? '' : body.slice(spaceIdx + 1).trim();
  const normalizedFirst = rawFirst.replace(/^[^a-zA-Z0-9]+/, '').toLowerCase();
  if (!normalizedFirst) return null;

  const command = SHELL_COMMAND_ALIASES[normalizedFirst] ?? normalizedFirst;
  if (!DIRECT_SHELL_COMMANDS.has(command)) return null;

  return { command, args };
}

export function isOpsShellInput(line: string): boolean {
  return parseOpsShellInput(line) !== null;
}

export function normalizeOpsShellCommand(line: string): string {
  const parsed = parseOpsShellInput(line);
  if (!parsed) return line.trim().startsWith('!') ? line.trim().slice(1).trim() : line.trim();
  return parsed.args ? `${parsed.command} ${parsed.args}` : parsed.command;
}

export function runOpsShellCommand(line: string, cwd: string): string {
  const cmd = normalizeOpsShellCommand(line);
  if (!cmd) return '';
  try {
    return execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
      env: process.env,
      shell: '/bin/bash',
    });
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string; status?: number };
    const out = [e.stdout, e.stderr].filter(Boolean).join('');
    return out || e.message || `Exit ${e.status ?? 1}`;
  }
}
