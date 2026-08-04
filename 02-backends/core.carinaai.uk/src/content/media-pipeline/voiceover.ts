import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { propertyChannelStoreDir } from '../../lib/property-channel-store.js';
import { generateSpeech } from '../../utils/tts.js';

const execFileAsync = promisify(execFile);

export interface VoiceoverAsset {
  path: string;
  durationSeconds: number;
  /** Script word-count based estimate kept for diagnostics. */
  estimatedDurationSeconds: number;
  accent: string;
  wordCount: number;
}

export interface VoiceoverEngine {
  synthesize(input: { jobId: string; scriptText: string; accent?: string }): Promise<VoiceoverAsset>;
}

const WORDS_PER_MINUTE = 150;

export function estimateDurationSeconds(text: string): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(30, Math.round((wordCount / WORDS_PER_MINUTE) * 60));
}

export async function probeAudioDurationSeconds(filePath: string): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath],
      { timeout: 15_000 },
    );
    const seconds = Number.parseFloat(stdout.trim());
    return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
  } catch {
    return undefined;
  }
}

export type SpeechGenerator = typeof generateSpeech;

/**
 * UK English voiceover via Carina TTS (Edge with OpenAI fallback). Writes a
 * real mp3 under the property-channel media store for the compositor.
 */
export function createVoiceoverEngine(deps: { generateSpeech?: SpeechGenerator } = {}): VoiceoverEngine {
  const synthesizeSpeech = deps.generateSpeech ?? generateSpeech;

  return {
    async synthesize(input) {
      const accent = input.accent ?? 'en-GB';
      const wordCount = input.scriptText.split(/\s+/).filter(Boolean).length;
      const estimatedDurationSeconds = estimateDurationSeconds(input.scriptText);

      const speech = await synthesizeSpeech(input.scriptText);
      try {
        const dir = path.join(propertyChannelStoreDir(), 'media', 'voiceover');
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, `${input.jobId}.mp3`);
        fs.copyFileSync(speech.filePath, filePath);

        const probed = await probeAudioDurationSeconds(filePath);
        const asset: VoiceoverAsset = {
          path: filePath,
          durationSeconds: probed ?? estimatedDurationSeconds,
          estimatedDurationSeconds,
          accent,
          wordCount,
        };

        const metaPath = path.join(dir, `${input.jobId}.meta.json`);
        fs.writeFileSync(metaPath, JSON.stringify({ jobId: input.jobId, ...asset }, null, 2));
        return asset;
      } finally {
        await speech.cleanup();
      }
    },
  };
}

export const defaultVoiceoverEngine: VoiceoverEngine = createVoiceoverEngine();
