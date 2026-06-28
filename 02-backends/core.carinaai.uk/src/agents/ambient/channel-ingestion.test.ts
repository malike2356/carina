import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config/index.js';
import {
  ChannelIngestionService,
  resetChannelIngestionServiceForTests,
} from './channel-ingestion.js';
import * as factPipeline from './fact-pipeline.js';

describe('ChannelIngestionService', () => {
  beforeEach(() => {
    resetChannelIngestionServiceForTests();
    vi.spyOn(factPipeline, 'processChannelBatch').mockResolvedValue(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('batches messages and flushes on demand', async () => {
    const service = new ChannelIngestionService();
    service.ingest(sampleMessage('C1'));
    service.ingest(sampleMessage('C1'));
    await service.flush();
    expect(factPipeline.processChannelBatch).toHaveBeenCalledTimes(1);
  });

  it('groups messages by channel before extraction', async () => {
    const service = new ChannelIngestionService();
    service.ingest(sampleMessage('C1'));
    service.ingest(sampleMessage('C2'));
    await service.flush();
    expect(factPipeline.processChannelBatch).toHaveBeenCalledTimes(2);
  });

  it('starts and stops periodic processing', () => {
    vi.useFakeTimers();
    const service = new ChannelIngestionService();
    service.start(1000);
    service.ingest(sampleMessage('C1'));
    vi.advanceTimersByTime(1000);
    service.stop();
    vi.useRealTimers();
    expect(factPipeline.processChannelBatch).toHaveBeenCalled();
  });

  it('respects max batch size', async () => {
    const service = new ChannelIngestionService();
    for (let i = 0; i < config.ambient.slack.maxMessagesPerBatch; i += 1) {
      service.ingest(sampleMessage('C1'));
    }
    expect(service.queueSize()).toBe(0);
  });
});

function sampleMessage(channelId: string) {
  return {
    channelId,
    channelName: `#${channelId}`,
    userId: 'U1',
    userName: 'Alex',
    text: 'We decided to ship the release on Friday.',
    timestamp: new Date().toISOString(),
    isPinned: false,
    hasFiles: false,
    reactions: [],
    permalink: `https://slack.com/archives/${channelId}/p1`,
  };
}
