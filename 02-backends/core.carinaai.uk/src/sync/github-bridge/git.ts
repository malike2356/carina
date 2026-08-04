import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export class GitBridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitBridgeError';
  }
}

function runGit(
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env, GIT_TERMINAL_PROMPT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new GitBridgeError(`git ${args[0]} timed out`));
    }, opts.timeoutMs ?? 120_000);
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new GitBridgeError(`git ${args.join(' ')} failed (${code}): ${stderr || stdout}`.trim()));
    });
  });
}

function remoteUrl(owner: string, repo: string, token: string): string {
  const encoded = encodeURIComponent(token);
  return `https://x-access-token:${encoded}@github.com/${owner}/${repo}.git`;
}

/** Redact token from any string used in logs/errors. */
export function redactGitSecrets(text: string, token?: string | null): string {
  let out = text;
  if (token) out = out.split(token).join('[redacted]');
  out = out.replace(/x-access-token:[^@\s]+@/gi, 'x-access-token:[redacted]@');
  return out;
}

export async function ensureClone(opts: {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  localPath: string;
}): Promise<{ cloned: boolean }> {
  const { localPath, owner, repo, branch, token } = opts;
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  if (fs.existsSync(path.join(localPath, '.git'))) {
    await runGit(['remote', 'set-url', 'origin', remoteUrl(owner, repo, token)], { cwd: localPath });
    return { cloned: false };
  }
  if (fs.existsSync(localPath)) {
    fs.rmSync(localPath, { recursive: true, force: true });
  }
  try {
    await runGit([
      'clone',
      '--branch',
      branch,
      '--single-branch',
      remoteUrl(owner, repo, token),
      localPath,
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GitBridgeError(redactGitSecrets(msg, token));
  }
  return { cloned: true };
}

export async function pullRebase(opts: {
  localPath: string;
  branch: string;
  token: string;
  owner: string;
  repo: string;
}): Promise<void> {
  const { localPath, branch, token, owner, repo } = opts;
  try {
    await runGit(['remote', 'set-url', 'origin', remoteUrl(owner, repo, token)], { cwd: localPath });
    await runGit(['fetch', 'origin', branch], { cwd: localPath });
    await runGit(['checkout', branch], { cwd: localPath }).catch(async () => {
      await runGit(['checkout', '-B', branch, `origin/${branch}`], { cwd: localPath });
    });
    await runGit(['pull', '--rebase', 'origin', branch], { cwd: localPath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GitBridgeError(redactGitSecrets(msg, token));
  }
}

export async function commitAndPush(opts: {
  localPath: string;
  branch: string;
  token: string;
  owner: string;
  repo: string;
  message: string;
  paths: string[];
}): Promise<{ pushed: boolean; committed: boolean }> {
  const { localPath, branch, token, owner, repo, message, paths } = opts;
  if (!paths.length) return { pushed: false, committed: false };
  try {
    await runGit(['remote', 'set-url', 'origin', remoteUrl(owner, repo, token)], { cwd: localPath });
    await runGit(['add', '--', ...paths], { cwd: localPath });
    const status = await runGit(['status', '--porcelain'], { cwd: localPath });
    if (!status.stdout.trim()) return { pushed: false, committed: false };
    await runGit(['-c', 'user.name=Carina Agent Sync', '-c', 'user.email=agent-sync@carina.local', 'commit', '-m', message], {
      cwd: localPath,
    });
    await runGit(['push', 'origin', `HEAD:${branch}`], { cwd: localPath });
    return { pushed: true, committed: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GitBridgeError(redactGitSecrets(msg, token));
  }
}

export async function listTrackedFiles(localPath: string): Promise<string[]> {
  const { stdout } = await runGit(['ls-files'], { cwd: localPath });
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
