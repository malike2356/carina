import type { Tool } from '../types/index.js';
import { runCodeInSandbox } from './sandbox.js';

const TIMEOUT_MS = 5000;
const NEEDS_CONFIRM = /\b(import|require|process)\b/;

function detectLanguage(code: string): 'javascript' | 'python' {
  if (/^\s*(def |import |print\(|from )/m.test(code)) return 'python';
  return 'javascript';
}

export const codeExecTool: Tool = {
  name: 'code-exec',
  dangerous: true,
  description:
    'Execute JavaScript or Python in a Docker sandbox (no network). Falls back to VM for JS if Docker unavailable.',
  parameters: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Code to execute' },
      language: {
        type: 'string',
        enum: ['javascript', 'python'],
        description: 'Language (auto-detected if omitted)',
      },
    },
    required: ['code'],
  },
  needsConfirmation: (params) => NEEDS_CONFIRM.test(String(params.code ?? '')),
  execute: async (params) => {
    const code = String(params.code ?? '');
    const language =
      (params.language as 'javascript' | 'python' | undefined) ??
      detectLanguage(code);
    const start = Date.now();

    const result = await runCodeInSandbox(code, language, {
      timeout: TIMEOUT_MS,
      memoryMb: 128,
      networkDisabled: true,
    });

    return {
      output: result.exitCode === 0 ? result.stdout : null,
      error: result.exitCode !== 0 ? result.stderr : null,
      exitCode: result.exitCode,
      executionTime: Date.now() - start,
    };
  },
};
