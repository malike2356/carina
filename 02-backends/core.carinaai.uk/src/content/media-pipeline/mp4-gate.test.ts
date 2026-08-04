import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('property channel mp4 gate', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-mp4-gate-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('rejects missing, non-mp4, and tiny files', async () => {
    const { isValidPropertyChannelMp4 } = await import('./mp4-gate.js');
    expect(await isValidPropertyChannelMp4(undefined)).toBe(false);
    expect(await isValidPropertyChannelMp4(path.join(tmp, 'plan.json'))).toBe(false);

    const tiny = path.join(tmp, 'tiny.mp4');
    fs.writeFileSync(tiny, 'not-a-video');
    expect(await isValidPropertyChannelMp4(tiny)).toBe(false);
  });

  it('accepts a real ffmpeg-generated mp4 with a video stream', async () => {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    const out = path.join(tmp, 'smoke.mp4');
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=320x240:d=1',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=1',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-shortest',
        out,
      ],
      { timeout: 30_000 },
    );

    const { isValidPropertyChannelMp4 } = await import('./mp4-gate.js');
    expect(await isValidPropertyChannelMp4(out)).toBe(true);
  });
});

describe('youtube-upload refuses non-mp4', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-yt-upload-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('does not call uploadVideo when ready job has only a JSON manifest', async () => {
    const { resetJsonStoreCache } = await import('../../lib/property-channel-store.js');
    resetJsonStoreCache();

    const uploadMod = await import('../../connectors/youtube/upload.js');
    const uploadSpy = vi.spyOn(uploadMod, 'uploadVideo').mockResolvedValue({
      videoId: 'should-not-upload',
      uploadStatus: 'uploaded',
    });

    const { createRenderJob, updateRenderJob } = await import('./store.js');
    const { saveCalendar } = await import('../script-generator/store.js');

    const job = createRenderJob({
      workspaceId: 'ws-1',
      channelId: 'chan-1',
      dayIndex: 0,
      title: 'Test',
      scriptText: 'script only',
      thumbnailPrompt: 'thumb',
    });
    const manifestPath = path.join(tmpHome, 'fake-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify({ not: 'mp4' }));
    updateRenderJob(job.id, {
      status: 'ready',
      progress: 100,
      assets: { videoManifestPath: manifestPath },
    });

    saveCalendar('ws-1', 'chan-1', [
      {
        dayIndex: 0,
        date: '2026-08-03',
        niche: 'buy-to-let-investment',
        theme: 'Yield',
        title: 'Test',
        description: 'desc',
        tags: ['uk'],
        thumbnailPrompt: 'thumb',
        script: {
          sections: [{ label: 'hook', text: 'h', approxSeconds: 10 }],
          fullText: 'x',
          estimatedDurationSeconds: 60,
        },
      },
    ]);

    const { runYouTubeUpload } = await import(
      '../../workflows/templates/property-channel/steps/youtube-upload.js'
    );

    await expect(
      runYouTubeUpload({
        id: 'run-1',
        workspaceId: 'ws-1',
        input: {
          workspaceId: 'ws-1',
          niche: 'buy-to-let-investment',
          location: 'Manchester',
          publishTime: '18:30',
          channelId: 'chan-1',
        },
        status: 'running',
        currentStepIndex: 4,
        steps: {} as never,
        context: { 'channel-provision': { channelId: 'chan-1' } },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/completed MP4 render/i);

    expect(uploadSpy).not.toHaveBeenCalled();
  });
});
