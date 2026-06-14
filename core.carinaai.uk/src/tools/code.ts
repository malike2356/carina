import type { Tool } from '../types/index.js';
import type { ConfirmFn } from '../agents/tool-runner.js';
import { checkDocker, runCodeInSandbox } from './sandbox.js';
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
    'Execute JavaScript or Python code and return the output. Docker required for Python (python:3.12-alpine) and for JS isolation (node:22-alpine); falls back to Node.js vm sandbox for JS when Docker is unavailable (no console.log in vm mode - use return value instead). Timeout: 5 minutes with Docker bridge (carina_tools module available for file-read, file-write, search-files, patch, shell-exec); 5 seconds in vm fallback. No network access. Code using import, require, or process triggers a confirmation prompt. Language is auto-detected: Python if the code starts lines with def, import, from, or print(; JavaScript otherwise.',
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
      : await runCodeInSandbox(code, language, {
          timeout: LEGACY_TIMEOUT_MS,
          memoryMb: 128,
          networkDisabled: true,
          workdir,
        });

    const stdout = truncateCodeOutput(result.stdout);
    return {
      output: result.exitCode === 0 ? stdout : null,
      error: result.exitCode !== 0 ? result.stderr || stdout : null,
      exitCode: result.exitCode,
      executionTime: Date.now() - start,
      bridge: useBridge,
      timeoutMs: useBridge ? BRIDGE_TIMEOUT_MS : LEGACY_TIMEOUT_MS,
    };
  },
};
