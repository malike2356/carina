import readline from 'readline';
import type { McpServerState } from './handlers.js';
import { handleMcpRequest, type JsonRpcRequest, type JsonRpcResponse } from './handlers.js';

export async function runMcpStdioServer(state: McpServerState): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  await new Promise<void>((resolve, reject) => {
    rl.on('line', (line) => {
      void (async () => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          const request = JSON.parse(trimmed) as JsonRpcRequest;
          const response = await handleMcpRequest(state, request);
          if (response) {
            writeResponse(response);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          writeResponse({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: `Parse error: ${message}` },
          });
        }
      })();
    });

    rl.on('close', () => resolve());
    rl.on('error', (err) => reject(err));
    process.stdin.on('end', () => resolve());
  });
}

function writeResponse(response: JsonRpcResponse): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}
