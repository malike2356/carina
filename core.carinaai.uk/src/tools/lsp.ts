import path from 'path';
import type { Tool } from '../types/index.js';
import {
  defaultLspSessionKey,
  lspDefinition,
  lspDiagnostics,
  lspHover,
  lspReferences,
  startLspServer,
  stopLspServer,
} from '../lsp/client.js';

function sessionKey(params: Record<string, unknown>): string {
  return defaultLspSessionKey(String(params._sessionId ?? 'default'));
}

export const lspTool: Tool = {
  name: 'lsp',
  description:
    'Language Server Protocol integration. Actions: start, definition, references, hover, diagnostics, stop.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['start', 'definition', 'references', 'hover', 'diagnostics', 'stop'],
      },
      command: { type: 'string', description: 'LSP server command for start (e.g. typescript-language-server)' },
      args: { type: 'array', items: { type: 'string' } },
      root: { type: 'string', description: 'Project root path' },
      file: { type: 'string' },
      line: { type: 'number' },
      character: { type: 'number' },
    },
    required: ['action'],
  },
  execute: async (params) => {
    const action = String(params.action ?? '');
    const key = sessionKey(params);

    if (action === 'start') {
      const command = String(params.command ?? process.env.CARINA_LSP_COMMAND ?? '').trim();
      const root = path.resolve(String(params.root ?? process.cwd()));
      if (!command) {
        return { error: 'command is required (or set CARINA_LSP_COMMAND)' };
      }
      const args = Array.isArray(params.args) ? params.args.map(String) : ['--stdio'];
      await startLspServer(key, command, args, root);
      return { started: true, session: key, root };
    }

    if (action === 'stop') {
      stopLspServer(key);
      return { stopped: true, session: key };
    }

    const file = path.resolve(String(params.file ?? ''));
    const line = Number(params.line ?? 0);
    const character = Number(params.character ?? 0);
    if (!file) return { error: 'file is required' };

    if (action === 'definition') return { result: await lspDefinition(key, file, line, character) };
    if (action === 'references') return { result: await lspReferences(key, file, line, character) };
    if (action === 'hover') return { result: await lspHover(key, file, line, character) };
    if (action === 'diagnostics') return { diagnostics: await lspDiagnostics(key, file) };

    return { error: `unknown action: ${action}` };
  },
};
