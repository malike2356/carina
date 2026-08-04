import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('voiceover engine', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-vo-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('writes a real audio file from mocked TTS and keeps estimate metadata', async () => {
    const { resetJsonStoreCache } = await import('../../lib/property-channel-store.js');
    resetJsonStoreCache();

    const speechDir = path.join(tmpHome, 'tts-tmp');
    fs.mkdirSync(speechDir, { recursive: true });
    const speechPath = path.join(speechDir, 'raw.mp3');
    fs.writeFileSync(speechPath, Buffer.alloc(2048, 1));

    const { createVoiceoverEngine } = await import('./voiceover.js');
    const engine = createVoiceoverEngine({
      generateSpeech: async () => ({
        filePath: speechPath,
        cleanup: async () => {
          fs.rmSync(speechPath, { force: true });
        },
      }),
    });

    const asset = await engine.synthesize({
      jobId: 'job-1',
      scriptText: 'This is a short property narration script for Manchester yields.',
    });

    expect(asset.path.endsWith('.mp3')).toBe(true);
    expect(fs.existsSync(asset.path)).toBe(true);
    expect(fs.statSync(asset.path).size).toBeGreaterThan(1000);
    expect(asset.accent).toBe('en-GB');
    expect(asset.estimatedDurationSeconds).toBeGreaterThan(0);
    expect(asset.durationSeconds).toBeGreaterThan(0);
    expect(asset.wordCount).toBeGreaterThan(5);
  });
});
