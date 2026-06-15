import { runDockerContainer, type DockerRunOptions } from './docker-runner.js';

export type DockerSandboxResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

function shellEscape(code: string): string {
  return code.replace(/'/g, `'\\''`);
}

export async function runInDocker(
  code: string,
  language: 'javascript' | 'python',
  options: DockerRunOptions,
): Promise<DockerSandboxResult> {
  const image = language === 'python' ? 'python:3.12-alpine' : 'node:22-alpine';

  if (options.bridgeDir) {
    const command =
      language === 'python'
        ? 'PYTHONPATH=/bridge python3 /bridge/script.py'
        : 'node /bridge/script.js';
    return runDockerContainer(command, image, options);
  }

  const escaped = shellEscape(code);
  const command =
    language === 'python' ? `python3 -c '${escaped}'` : `node -e '${escaped}'`;

  return runDockerContainer(command, image, options);
}
