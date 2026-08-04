import { execFile, spawn } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export function isPtyEnabled(): boolean {
  return process.env.CARINA_PTY_ENABLED === 'true';
}

export async function runPtyCommand(
  command: string,
  workdir?: string,
  timeoutMs = 30_000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (!isPtyEnabled()) {
    throw new Error('PTY mode is disabled. Set CARINA_PTY_ENABLED=true to enable interactive terminal.');
  }

  if (process.env.LABYRINTH_ENABLED === 'true' && process.env.CARINA_PTY_SCOUT_ALLOW !== 'true') {
    throw new Error('PTY requires CARINA_PTY_SCOUT_ALLOW=true when Labyrinth Scout is enabled.');
  }

  const hasScript = await probeBinary('script', ['--version']);
  if (hasScript) {
    return runViaScript(command, workdir, timeoutMs);
  }

  const hasPython = await probeBinary('python3', ['--version']);
  if (hasPython) {
    return runViaPythonPty(command, workdir, timeoutMs);
  }

  throw new Error('PTY requires `script` or `python3` on the host.');
}

async function probeBinary(cmd: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(cmd, args);
    return true;
  } catch {
    return false;
  }
}

async function runViaScript(
  command: string,
  workdir?: string,
  timeoutMs = 30_000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { stdout, stderr } = await execFileAsync('script', ['-q', '-c', command, '/dev/null'], {
    cwd: workdir,
    timeout: timeoutMs,
    maxBuffer: 512 * 1024,
    env: { ...process.env, TERM: 'xterm-256color' },
  });
  return { stdout: String(stdout), stderr: String(stderr), exitCode: 0 };
}

function runViaPythonPty(
  command: string,
  workdir?: string,
  timeoutMs = 30_000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const py = `
import os, pty, select, sys, time
cmd = ${JSON.stringify(command)}
workdir = ${JSON.stringify(workdir ?? '')}
timeout = ${timeoutMs / 1000}
pid, fd = pty.fork()
if pid == 0:
    if workdir:
        os.chdir(workdir)
    os.execl("/bin/sh", "sh", "-c", cmd)
out = []
deadline = time.time() + timeout
while time.time() < deadline:
    r, _, _ = select.select([fd], [], [], 0.1)
    if r:
        try:
            chunk = os.read(fd, 4096)
            if not chunk:
                break
            out.append(chunk.decode("utf-8", errors="replace"))
        except OSError:
            break
    try:
        done, status = os.waitpid(pid, os.WNOHANG)
        if done:
            code = os.waitstatus_to_exitcode(status) if hasattr(os, "waitstatus_to_exitcode") else status
            sys.stdout.write("".join(out))
            sys.exit(code if isinstance(code, int) and code >= 0 else 0)
    except ChildProcessError:
        break
try:
    os.kill(pid, 9)
except OSError:
    pass
sys.stdout.write("".join(out))
sys.exit(124)
`;

  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-c', py], { env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c: Buffer) => { stdout += c.toString('utf8'); });
    child.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}
