import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { transcribeAudioFile } from './transcribe-audio.js';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function audioExtension(mimeType?: string): string {
  const raw = String(mimeType ?? '').split(';')[0].trim().toLowerCase();
  if (raw === 'audio/webm' || raw === 'video/webm') return '.webm';
  if (raw === 'audio/ogg' || raw === 'application/ogg') return '.ogg';
  if (raw === 'audio/wav' || raw === 'audio/x-wav') return '.wav';
  if (raw === 'audio/mpeg' || raw === 'audio/mp3') return '.mp3';
  if (raw === 'audio/mp4' || raw === 'audio/m4a') return '.m4a';
  if (raw === 'audio/opus' || raw === 'audio/ogg;codecs=opus') return '.opus';
  return '.webm';
}

export async function transcribeUploadedAudio(
  audio: Buffer,
  mimeType?: string,
  language?: string,
): Promise<{ text: string } | { error: string }> {
  if (audio.length === 0) {
    return { error: 'audio payload is empty' };
  }
  if (audio.length > MAX_AUDIO_BYTES) {
    return { error: `audio exceeds ${MAX_AUDIO_BYTES} byte limit` };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-voice-'));
  const filePath = path.join(tempDir, `voice-${randomUUID()}${audioExtension(mimeType)}`);

  try {
    await fs.writeFile(filePath, audio);
    return await transcribeAudioFile(filePath, language);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
