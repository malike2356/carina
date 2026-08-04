import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/property-channel-store.js', () => {
  const stores = new Map<string, unknown>();
  return {
    loadJsonStore: <T,>(file: string, empty: () => T): T => {
      if (!stores.has(file)) stores.set(file, empty());
      return stores.get(file) as T;
    },
    saveJsonStore: <T,>(file: string, value: T) => {
      stores.set(file, value);
    },
    resetJsonStoreCache: () => stores.clear(),
    propertyChannelStoreDir: () => '/tmp/pc-test',
  };
});

vi.mock('./video-builder.js', () => ({
  runRenderJob: vi.fn(async (jobId: string) => {
    const { updateRenderJob, getRenderJob } = await import('./store.js');
    updateRenderJob(jobId, {
      status: 'ready',
      progress: 100,
      completedAt: new Date().toISOString(),
      assets: { videoPath: `/tmp/${jobId}.mp4` },
    });
    return getRenderJob(jobId)!;
  }),
}));

describe('render-queue', () => {
  beforeEach(async () => {
    vi.resetModules();
    const { resetJsonStoreCache } = await import('../../lib/property-channel-store.js');
    resetJsonStoreCache();
    process.env.PROPERTY_CHANNEL_RENDER_WORKER = 'false';
  });

  it('drains a queued job to ready without duplicating ready jobs', async () => {
    const { createRenderJob } = await import('./store.js');
    const { drainRenderQueueOnce, __resetRenderWorkerForTests } = await import('./render-queue.js');
    __resetRenderWorkerForTests();

    const job = createRenderJob({
      workspaceId: 'ws',
      channelId: 'ch',
      dayIndex: 0,
      title: 'Day 1',
      scriptText: 'Hello property investors in Manchester.',
      thumbnailPrompt: 'bold text',
      niche: 'buy-to-let-investment',
      location: 'Manchester',
      theme: 'Yields',
    });
    expect(job.status).toBe('queued');

    const first = await drainRenderQueueOnce(1);
    expect(first.processed).toBe(1);

    const { getRenderJob, createRenderJob: recreate } = await import('./store.js');
    const ready = getRenderJob(job.id);
    expect(ready?.status).toBe('ready');

    const again = recreate({
      workspaceId: 'ws',
      channelId: 'ch',
      dayIndex: 0,
      title: 'Day 1',
      scriptText: 'Hello again',
      thumbnailPrompt: 'bold text',
    });
    expect(again.id).toBe(job.id);
    expect(again.status).toBe('ready');

    const second = await drainRenderQueueOnce(1);
    expect(second.processed).toBe(0);
  });
});
