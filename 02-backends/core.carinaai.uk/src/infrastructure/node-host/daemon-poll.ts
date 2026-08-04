import type { NodeDaemonOptions } from './daemon-types.js';
import type { NodeCommand } from './types.js';
import { executeCommand } from './execute-command.js';

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    }, { once: true });
  });
}

export async function runPollDaemon(options: NodeDaemonOptions): Promise<void> {
  const fetchFn = options.fetchImpl ?? fetch;
  const interval = options.pollIntervalMs ?? Number(process.env.CARINA_NODE_POLL_MS ?? 3_000);
  const base = options.config.gatewayUrl.replace(/\/$/, '');
  const headers = {
    Authorization: `Bearer ${options.config.token}`,
    'Content-Type': 'application/json',
  };

  while (!options.signal?.aborted) {
    try {
      const res = await fetchFn(`${base}/api/nodes/commands/poll`, { headers });
      if (res.status === 401) {
        throw new Error('Node authentication failed; token revoked or invalid');
      }
      if (!res.ok) {
        await sleep(interval, options.signal);
        continue;
      }
      const body = await res.json() as { commands?: NodeCommand[] };
      for (const cmd of body.commands ?? []) {
        if (options.onCommand) {
          await options.onCommand(cmd);
        }
        const outcome = await executeCommand(cmd, { containerMode: options.containerMode });
        await fetchFn(`${base}/api/nodes/commands/${cmd.id}/complete`, {
          method: 'POST',
          headers,
          body: JSON.stringify(outcome),
        });
      }
      await fetchFn(`${base}/api/nodes/heartbeat`, { method: 'POST', headers });
    } catch (err) {
      if (options.signal?.aborted) break;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('authentication failed')) throw err;
    }
    await sleep(interval, options.signal);
  }
}
