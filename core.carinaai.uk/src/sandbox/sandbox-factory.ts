import { checkDocker } from './docker-availability.js';
import type { DockerRunOptions } from './docker-runner.js';

export type SandboxTier = 'docker' | 'worker_threads';

export type SandboxResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  sandboxTier: SandboxTier;
  durationMs: number;
};

export type CodeSandboxOptions = Partial<
  Pick<DockerRunOptions, 'workdir' | 'bridgeDir' | 'memoryMb' | 'networkDisabled'>
>;

const WORKER_TIER_NOTE =
  '\n[Note: Running in worker_threads sandbox. Install Docker for stronger isolation.]';

export async function runInSandbox(
  code: string,
  language: 'javascript' | 'python',
  timeoutMs: number,
  options: CodeSandboxOptions = {},
): Promise<SandboxResult> {
  const dockerOk = await checkDocker();
  const runOptions: DockerRunOptions = {
    timeout: timeoutMs,
    memoryMb: options.memoryMb ?? 128,
    networkDisabled: options.networkDisabled ?? true,
    workdir: options.workdir,
    bridgeDir: options.bridgeDir,
  };

  if (language !== 'javascript') {
    if (!dockerOk) {
      return {
        stdout: '',
        stderr:
          'Python code execution requires Docker. Install Docker Desktop and ensure it is running, or use JavaScript which runs natively.',
        exitCode: 1,
        sandboxTier: 'worker_threads',
        durationMs: 0,
      };
    }
  }

  if (options.bridgeDir && !dockerOk) {
    return {
      stdout: '',
      stderr:
        'Bridge code execution requires Docker. Install Docker Desktop and ensure it is running.',
      exitCode: 1,
      sandboxTier: 'worker_threads',
      durationMs: 0,
    };
  }

  if (dockerOk) {
    const { runInDocker } = await import('./docker-sandbox.js');
    const start = Date.now();
    const result = await runInDocker(code, language, runOptions);
    return { ...result, sandboxTier: 'docker', durationMs: Date.now() - start };
  }

  if (process.env.CARINA_REQUIRE_DOCKER_SANDBOX === 'true') {
    return {
      stdout: '',
      stderr:
        'Docker is required for code execution (CARINA_REQUIRE_DOCKER_SANDBOX=true) but Docker is not available.',
      exitCode: 1,
      sandboxTier: 'worker_threads',
      durationMs: 0,
    };
  }

  const { runInWorker } = await import('./worker-sandbox.js');
  const start = Date.now();
  const result = await runInWorker(code, timeoutMs);
  const warning = WORKER_TIER_NOTE;
  return {
    stdout: result.stdout,
    stderr: result.stderr + warning,
    exitCode: result.exitCode,
    sandboxTier: 'worker_threads',
    durationMs: Date.now() - start,
  };
}
