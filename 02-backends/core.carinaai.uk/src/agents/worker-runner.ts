import { isMainThread, parentPort, workerData } from 'worker_threads';
import type { AivaWorkerSpawnConfig } from './aiva-worker-pool-types.js';
import type { WorkerInboundMessage, WorkerResponse } from './aiva-worker-pool-types.js';
import { AivaWorkerRuntime } from './aiva-worker-runtime.js';

if (isMainThread) {
  throw new Error('worker-runner.ts must be run as a Worker, not directly');
}

if (!parentPort) {
  throw new Error('worker-runner.ts requires parentPort');
}

const port = parentPort;
const config = workerData as { config: AivaWorkerSpawnConfig };
const runtime = new AivaWorkerRuntime(config.config);

let bootstrapped = false;

async function ensureBootstrapped(): Promise<void> {
  if (bootstrapped) return;
  const { loadCarinaEnv } = await import('../config/load-env.js');
  loadCarinaEnv();
  // The main process loads provider settings from the workspace database at
  // startup. Isolated Aiva workers must do the same before creating a router,
  // otherwise Telegram and other channels can see an empty provider chain.
  const { loadSettingsFromDb } = await import('../config/settings-loader.js');
  await loadSettingsFromDb(config.config.workspaceId);
  const { initMemoryBackend } = await import('../memory/backends/index.js');
  initMemoryBackend();
  const { initRouter } = await import('../gateway/router.js');
  initRouter(true);
  const { initSkills } = await import('../skills/index.js');
  await initSkills();
  bootstrapped = true;
}

port.on('message', (msg: WorkerInboundMessage) => {
  void (async () => {
    try {
      await ensureBootstrapped();

      if (msg.type === 'process_message') {
        const { processAivaMessageStreamDirect } = await import('../workers/aiva-process-message.js');
        let reply = '';
        for await (const event of processAivaMessageStreamDirect(msg.params)) {
          port.postMessage({ id: msg.id, type: 'stream', event } satisfies WorkerResponse);
          if (event.type === 'token') {
            reply += event.content;
          }
          if (event.type === 'replace') {
            reply = event.content;
          }
        }
        port.postMessage({ id: msg.id, ok: true, result: reply } satisfies WorkerResponse);
        return;
      }

      const result = await runtime.handle(msg);
      port.postMessage({ id: msg.id, ok: true, result } satisfies WorkerResponse);
    } catch (err) {
      const error = err instanceof Error
        ? (err.stack ?? err.message)
        : String(err);
      port.postMessage({
        id: msg.id,
        ok: false,
        error,
      } satisfies WorkerResponse);
    }
  })();
});
