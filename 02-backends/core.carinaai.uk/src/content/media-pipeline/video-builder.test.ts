import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function makeWavSilence(seconds: number, sampleRate = 16000): Buffer {
  const samples = sampleRate * seconds;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

describe('media pipeline video builder', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-media-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('progresses a render job through queued to rendering to ready with MP4', async () => {
    const { resetJsonStoreCache } = await import('../../lib/property-channel-store.js');
    resetJsonStoreCache();

    const { queueVideoRenderJob, runRenderJob } = await import('./video-builder.js');
    const { createVoiceoverEngine } = await import('./voiceover.js');
    const { defaultVisualsEngine } = await import('./visuals.js');
    const { defaultThumbnailEngine } = await import('./thumbnail.js');

    const audioPath = path.join(tmpHome, 'fixture.wav');
    fs.writeFileSync(audioPath, makeWavSilence(2));

    const job = queueVideoRenderJob({
      workspaceId: 'ws-1',
      channelId: 'chan-1',
      dayIndex: 0,
      title: 'Manchester buy-to-let yields explained',
      location: 'Manchester',
      niche: 'buy-to-let-investment',
      theme: 'Yield fundamentals',
      scriptText: '[HOOK]\nHook text here.\n[BODY]\n1. Point one.\n[CALL TO ACTION]\nSubscribe.',
      thumbnailPrompt: 'Bold text over a Manchester property photo',
    });
    expect(job.status).toBe('queued');

    const ready = await runRenderJob(job.id, 'buy-to-let-investment', {
      voiceoverEngine: createVoiceoverEngine({
        generateSpeech: async () => ({
          filePath: audioPath,
          cleanup: async () => {},
        }),
      }),
      visualsEngine: defaultVisualsEngine,
      thumbnailEngine: defaultThumbnailEngine,
    });

    expect(ready.status).toBe('ready');
    expect(ready.progress).toBe(100);
    expect(ready.assets.voiceoverPath).toBeTruthy();
    expect(ready.assets.visualsManifestPath).toBeTruthy();
    expect(ready.assets.thumbnailPath).toMatch(/\.png$/);
    expect(ready.assets.videoManifestPath).toBeTruthy();
    expect(ready.assets.videoPath).toMatch(/\.mp4$/);
    expect(fs.existsSync(ready.assets.videoPath!)).toBe(true);
    expect(fs.statSync(ready.assets.videoPath!).size).toBeGreaterThan(1024);
    expect(fs.existsSync(ready.assets.thumbnailPath!)).toBe(true);
    expect(fs.statSync(ready.assets.thumbnailPath!).size).toBeLessThan(2 * 1024 * 1024);
  }, 120_000);

  it('is idempotent: queuing the same workspace/channel/day twice returns the same job', async () => {
    const { resetJsonStoreCache } = await import('../../lib/property-channel-store.js');
    resetJsonStoreCache();
    const { queueVideoRenderJob } = await import('./video-builder.js');
    const input = {
      workspaceId: 'ws-1',
      channelId: 'chan-1',
      dayIndex: 3,
      title: 'Day 4 video',
      location: 'Leeds',
      niche: 'buy-to-let-investment' as const,
      theme: 'Test theme',
      scriptText: 'script text',
      thumbnailPrompt: 'thumbnail prompt',
    };
    const first = queueVideoRenderJob(input);
    const second = queueVideoRenderJob(input);
    expect(second.id).toBe(first.id);
  });

  it('does not re-render an already-ready job with mp4', async () => {
    const { resetJsonStoreCache } = await import('../../lib/property-channel-store.js');
    resetJsonStoreCache();

    const { queueVideoRenderJob, runRenderJob } = await import('./video-builder.js');
    const { createVoiceoverEngine } = await import('./voiceover.js');
    const { defaultVisualsEngine } = await import('./visuals.js');
    const { defaultThumbnailEngine } = await import('./thumbnail.js');

    const audioPath = path.join(tmpHome, 'fixture2.wav');
    fs.writeFileSync(audioPath, makeWavSilence(2));

    const job = queueVideoRenderJob({
      workspaceId: 'ws-1',
      channelId: 'chan-1',
      dayIndex: 5,
      title: 'Day 6 video',
      location: 'Leeds',
      niche: 'buy-to-let-investment',
      theme: 'Test theme',
      scriptText: 'script text',
      thumbnailPrompt: 'thumbnail prompt',
    });

    const deps = {
      voiceoverEngine: createVoiceoverEngine({
        generateSpeech: async () => ({
          filePath: audioPath,
          cleanup: async () => {},
        }),
      }),
      visualsEngine: defaultVisualsEngine,
      thumbnailEngine: defaultThumbnailEngine,
    };

    const first = await runRenderJob(job.id, 'buy-to-let-investment', deps);
    const second = await runRenderJob(job.id, 'buy-to-let-investment', deps);
    expect(second).toEqual(first);
    expect(first.assets.videoPath).toMatch(/\.mp4$/);
  }, 120_000);
});
