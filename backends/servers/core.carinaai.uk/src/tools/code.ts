import type { Tool } from '../types/index.js';
import type { ConfirmFn } from '../agents/tool-runner.js';
import { checkDocker } from './sandbox.js';
import { runInSandbox, type SandboxResult as FactorySandboxResult } from '../sandbox/sandbox-factory.js';
import {
  BRIDGE_TIMEOUT_MS,
  detectLanguage,
  runCodeWithBridge,
  truncateCodeOutput,
} from './execute-code.js';

const LEGACY_TIMEOUT_MS = 5000;
const NEEDS_CONFIRM = /\b(import|require|process)\b/;

export { detectLanguage };

export const codeExecTool: Tool = {
  name: 'code-exec',
  dangerous: true,
  description:
    'Execute JavaScript or Python code in a sandboxed environment. JavaScript runs in a worker_threads sandbox on all platforms when Docker is unavailable (console.log supported; weaker isolation than Docker). Python requires Docker to be installed and running. Docker provides stronger isolation and enables the carina_tools bridge (file-read, file-write, search-files, patch, shell-exec) with a 5 minute timeout; worker_threads fallback uses a 5 second timeout. worker_threads cannot fully restrict filesystem or network access; do not use for untrusted multi-tenant input. Code using import, require, or process triggers a confirmation prompt. Language is auto-detected: Python if the code starts lines with def, import, from, or print(; JavaScript otherwise.',
  parameters: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Code to execute' },
      language: {
        type: 'string',
        enum: ['javascript', 'python'],
        description: 'Language (auto-detected if omitted)',
      },
      workdir: { type: 'string', description: 'Optional working directory (absolute or ~/ path)' },
    },
    required: ['code'],
  },
  needsConfirmation: (params) => NEEDS_CONFIRM.test(String(params.code ?? '')),
  execute: async (params) => {
    const code = String(params.code ?? '');
    const language =
      (params.language as 'javascript' | 'python' | undefined) ??
      detectLanguage(code);
    const sessionId =
      typeof params._sessionId === 'string' ? params._sessionId : 'default-session';
    const confirm =
      typeof params._confirm === 'function' ? (params._confirm as ConfirmFn) : undefined;
    const workdir = params.workdir !== undefined ? String(params.workdir) : undefined;
    const start = Date.now();
    const useBridge = await checkDocker();

    const result = useBridge
      ? await runCodeWithBridge({ code, language, sessionId, confirm, workdir })
      : await runInSandbox(code, language, LEGACY_TIMEOUT_MS, {
          memoryMb: 128,
          networkDisabled: true,
          workdir,
        });

    const stdout = truncateCodeOutput(result.stdout);
    const sandboxTier = useBridge
      ? 'docker' as const
      : (result as FactorySandboxResult).sandboxTier;
    const durationMs = useBridge
      ? Date.now() - start
      : (result as FactorySandboxResult).durationMs;
    return {
      output: result.exitCode === 0 ? stdout : null,
      error: result.exitCode !== 0 ? result.stderr || stdout : null,
      exitCode: result.exitCode,
      executionTime: Date.now() - start,
      bridge: useBridge,
      sandboxTier,
      durationMs,
      timeoutMs: useBridge ? BRIDGE_TIMEOUT_MS : LEGACY_TIMEOUT_MS,
    };
  },
};
