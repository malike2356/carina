import { config } from '../../config/index.js';
import type { AmbientChannelMessage } from './types.js';
import { processChannelBatch } from './fact-pipeline.js';

export class ChannelIngestionService {
  private ingestionQueue: AmbientChannelMessage[] = [];
  private processingInterval: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  ingest(message: AmbientChannelMessage): void {
    this.ingestionQueue.push(message);
    if (this.ingestionQueue.length >= config.ambient.slack.maxMessagesPerBatch) {
      void this.flush();
    }
  }

  start(batchIntervalMs = config.ambient.slack.batchIntervalMs): void {
    if (this.processingInterval) return;
    this.processingInterval = setInterval(() => void this.flush(), batchIntervalMs);
    this.processingInterval.unref?.();
  }

  stop(): void {
    if (!this.processingInterval) return;
    clearInterval(this.processingInterval);
    this.processingInterval = null;
  }

  async flush(): Promise<void> {
    if (this.flushing || this.ingestionQueue.length === 0) return;
    this.flushing = true;
    const batch = this.ingestionQueue.splice(0, config.ambient.slack.maxMessagesPerBatch);

    try {
      const byChannel = new Map<string, AmbientChannelMessage[]>();
      for (const msg of batch) {
        const existing = byChannel.get(msg.channelId) ?? [];
        existing.push(msg);
        byChannel.set(msg.channelId, existing);
      }

      console.log(`[carina:ambient] Processing ${batch.length} channel messages`);

      for (const [channelId, messages] of byChannel) {
        const channelName = messages[0]?.channelName ?? channelId;
        await processChannelBatch(channelId, channelName, messages);
      }
    } finally {
      this.flushing = false;
    }
  }

  queueSize(): number {
    return this.ingestionQueue.length;
  }
}

let sharedIngestion: ChannelIngestionService | null = null;

export function getChannelIngestionService(): ChannelIngestionService {
  if (!sharedIngestion) sharedIngestion = new ChannelIngestionService();
  return sharedIngestion;
}

export function resetChannelIngestionServiceForTests(): void {
  sharedIngestion?.stop();
  sharedIngestion = null;
}
