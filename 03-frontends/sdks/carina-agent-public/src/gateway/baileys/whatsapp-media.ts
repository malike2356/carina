import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { transcribeAudioFile } from '../../utils/transcribe-audio.js';

type Downloadable = {
  downloadMediaMessage: (
    msg: Record<string, unknown>,
    type: string,
    opts: Record<string, unknown>,
    ctx: Record<string, unknown>,
  ) => Promise<Buffer>;
};

const AUDIO_MIMES = new Set(['audio/ogg', 'audio/opus', 'audio/mpeg', 'audio/mp4', 'audio/wav']);

export function mediaDir(): string {
  return path.join(
    process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina'),
    'media',
    'whatsapp-inbound',
  );
}

export async function saveInboundMedia(
  baileys: Downloadable,
  msg: Record<string, unknown>,
  reupload: (msg: Record<string, unknown>) => Promise<Record<string, unknown>>,
): Promise<{ filePath: string; mime: string; kind: 'audio' | 'image' | 'document' | 'video' } | null> {
  const content = msg.message as Record<string, unknown> | undefined;
  if (!content) return null;

  let mime = '';
  let kind: 'audio' | 'image' | 'document' | 'video' = 'document';
  if (content.audioMessage) {
    mime = String((content.audioMessage as Record<string, unknown>).mimetype ?? 'audio/ogg');
    kind = 'audio';
  } else if (content.imageMessage) {
    mime = String((content.imageMessage as Record<string, unknown>).mimetype ?? 'image/jpeg');
    kind = 'image';
  } else if (content.documentMessage) {
    mime = String((content.documentMessage as Record<string, unknown>).mimetype ?? 'application/octet-stream');
    kind = 'document';
  } else if (content.videoMessage) {
    mime = String((content.videoMessage as Record<string, unknown>).mimetype ?? 'video/mp4');
    kind = 'video';
  } else {
    return null;
  }

  const dir = mediaDir();
  await fs.mkdir(dir, { recursive: true });
  const ext = mime.includes('ogg') ? '.ogg'
    : mime.includes('opus') ? '.opus'
      : mime.includes('jpeg') || mime.includes('jpg') ? '.jpg'
        : mime.includes('png') ? '.png'
          : mime.includes('pdf') ? '.pdf'
            : mime.includes('mp4') ? '.mp4'
              : '.bin';

  const filePath = path.join(dir, `wa-${Date.now()}${ext}`);
  const buffer = await baileys.downloadMediaMessage(
    msg,
    'buffer',
    {},
    { reuploadRequest: reupload },
  );
  await fs.writeFile(filePath, buffer);
  return { filePath, mime, kind };
}

export async function transcribeInboundAudio(filePath: string): Promise<string | null> {
  if (process.env.CARINA_WHATSAPP_AUTO_TRANSCRIBE === 'false') return null;
  const result = await transcribeAudioFile(filePath);
  if ('error' in result) return null;
  return result.text.trim() || null;
}

export function isAudioMime(mime: string): boolean {
  return AUDIO_MIMES.has(mime) || mime.startsWith('audio/');
}
