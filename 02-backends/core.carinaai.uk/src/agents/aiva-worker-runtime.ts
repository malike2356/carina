import type { WorkerMessage } from './aiva-worker-pool-types.js';
import type { AivaWorkerSpawnConfig } from './aiva-worker-pool-types.js';

/** Runs inside an isolated worker thread; handles coordinator messages. */
export class AivaWorkerRuntime {
  constructor(private readonly config: AivaWorkerSpawnConfig) {}

  get spawnConfig(): AivaWorkerSpawnConfig {
    return this.config;
  }

  async handle(msg: WorkerMessage): Promise<unknown> {
    if (msg.type === 'ping') {
      return 'pong';
    }

    if (msg.type === 'process_message') {
      const { processAivaMessageStreamDirect } = await import('../workers/aiva-process-message.js');
      let reply = '';
      for await (const event of processAivaMessageStreamDirect(msg.params)) {
        if (event.type === 'token') {
          reply += event.content;
        }
        if (event.type === 'replace') {
          reply = event.content;
        }
      }
      return reply;
    }

    throw new Error(`Unknown worker message type: ${(msg as { type: string }).type}`);
  }
}
