import { ensurePlatformDirs } from '../lib/platform-paths.js';
import {
  checkDocker,
  isDockerAvailable,
  resetDockerCheck,
} from '../sandbox/docker-availability.js';
import { runDockerContainer } from '../sandbox/docker-runner.js';
import { runOpenShellContainer } from '../sandbox/openshell-sandbox.js';
import { runInSandbox as runCodeInSandboxFactory } from '../sandbox/sandbox-factory.js';
import { executeShellCommand } from './platform.js';

export {
  checkDocker,
  isDockerAvailable,
  resetDockerCheck,
};

export interface SandboxOptions {
  timeout: number;
  memoryMb: number;
  networkDisabled: boolean;
  workdir?: string;
  bridgeDir?: string;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function initSandbox(): Promise<void> {
  ensurePlatformDirs();
  const ok = await checkDocker();
  if (!ok) {
    console.warn(
      'Docker not found - JavaScript code-exec uses worker_threads sandbox. Install Docker for full isolation and Python support.',
    );
  }
}

export async function runInSandbox(
  command: string,
  image: string,
  options: SandboxOptions,
): Promise<SandboxResult> {
  return runDockerContainer(command, image, options);
}

export async function runInOpenShell(
  command: string,
  image: string,
  options: SandboxOptions,
): Promise<SandboxResult> {
  return runOpenShellContainer(command, image, options);
}

export async function runCodeInSandbox(
  code: string,
  language: 'javascript' | 'python',
  options: SandboxOptions,
): Promise<SandboxResult> {
  const result = await runCodeInSandboxFactory(code, language, options.timeout, {
    workdir: options.workdir,
    bridgeDir: options.bridgeDir,
    memoryMb: options.memoryMb,
    networkDisabled: options.networkDisabled,
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}

export async function runDirectShell(
  command: string,
  options: { timeout: number; workdir?: string },
): Promise<SandboxResult> {
  return executeShellCommand(command, options.timeout, options.workdir);
}
