import { execSync } from 'node:child_process';

const DIRECT_SHELL_COMMANDS = new Set([
  'ls', 'pwd', 'whoami', 'id', 'date', 'uname', 'df', 'du', 'echo', 'env', 'which',
  'ps', 'free', 'uptime', 'hostname', 'printenv', 'wc', 'tree', 'find', 'grep',
  'cat', 'head', 'tail', 'touch', 'mkdir', 'rm', 'mv', 'cp', 'chmod', 'stat', 'file',
  'npm', 'pnpm', 'node', 'git', 'docker', 'curl', 'wget', 'jq', 'tar', 'zip', 'unzip',
]);

export function isOpsShellInput(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('/')) return false;
  if (trimmed.startsWith('!')) return trimmed.length > 1;
  const first = trimmed.split(/\s+/)[0]?.toLowerCase() ?? '';
  return DIRECT_SHELL_COMMANDS.has(first);
}

export function normalizeOpsShellCommand(line: string): string {
  const trimmed = line.trim();
  return trimmed.startsWith('!') ? trimmed.slice(1).trim() : trimmed;
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
