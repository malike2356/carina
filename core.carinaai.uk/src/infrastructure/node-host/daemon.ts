import { runPollDaemon } from './daemon-poll.js';
import { runNodeWsDaemon, resolveNodeTransport } from './ws-transport.js';
import type { NodeDaemonOptions } from './daemon-types.js';

export type { NodeDaemonOptions } from './daemon-types.js';

export async function runNodeDaemon(options: NodeDaemonOptions): Promise<void> {
  const transport = options.transport ?? resolveNodeTransport();
  const useWs = transport === 'ws' || (transport === 'auto' && process.env.CARINA_NODE_WS !== 'false');
  if (useWs) {
    try {
      await runNodeWsDaemon({
        config: options.config,
        onCommand: options.onCommand,
        signal: options.signal,
        containerMode: options.containerMode,
      });
      return;
    } catch {
      if (transport === 'ws') {
        throw new Error('WebSocket node transport failed and poll fallback is disabled');
      }
    }
  }
  await runPollDaemon(options);
}

export { executeCommand } from './execute-command.js';
