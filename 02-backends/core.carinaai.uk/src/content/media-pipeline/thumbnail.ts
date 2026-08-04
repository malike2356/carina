import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { propertyChannelStoreDir } from '../../lib/property-channel-store.js';

const execFileAsync = promisify(execFile);

export interface ThumbnailAsset {
  path: string;
  width: 1280;
  height: 720;
  sizeBytes: number;
}

export interface ThumbnailEngine {
  render(input: {
    jobId: string;
    prompt: string;
    hookText: string;
    location?: string;
    brandLabel?: string;
  }): Promise<ThumbnailAsset>;
}

const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines.slice(0, 3);
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\\\'")
    .replace(/%/g, '%%');
}

/**
 * Renders a 1280x720 PNG thumbnail via ffmpeg (property-styled background,
 * brand label, location chip, bold hook text). Raster only so YouTube
 * thumbnails.set accepts it (<2MB jpeg/png).
 */
export const defaultThumbnailEngine: ThumbnailEngine = {
  async render(input) {
    const lines = wrapText(input.hookText, 26);
    const dir = path.join(propertyChannelStoreDir(), 'media', 'thumbnails');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${input.jobId}.png`);
    const brand = escapeDrawtext((input.brandLabel ?? 'Channel').slice(0, 28));
    const place = escapeDrawtext((input.location ?? '').slice(0, 32));

    const drawtexts = [
      `drawbox=x=0:y=0:w=1280:h=720:color=0x0f172a:t=fill`,
      `drawbox=x=0:y=520:w=1280:h=200:color=0x020617@0.55:t=fill`,
      `drawtext=text='${brand}':fontcolor=0x38bdf8:fontsize=34:x=48:y=40`,
      place
        ? `drawtext=text='${place}':fontcolor=0xcbd5e1:fontsize=28:x=48:y=90`
        : null,
      ...lines.map((line, i) => {
        const y = 280 + i * 68;
        return `drawtext=text='${escapeDrawtext(line)}':fontcolor=white:fontsize=56:borderw=4:bordercolor=black:x=(w-text_w)/2:y=${y}`;
      }),
    ]
      .filter(Boolean)
      .join(',');

    try {
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'color=c=0x0f172a:s=1280x720:d=1',
          '-vf',
          drawtexts,
          '-frames:v',
          '1',
          filePath,
        ],
        { timeout: 30_000 },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Thumbnail ffmpeg render failed: ${msg}`);
    }

    const sizeBytes = fs.statSync(filePath).size;
    if (sizeBytes > MAX_THUMBNAIL_BYTES) {
      throw new Error(`Generated thumbnail is ${sizeBytes} bytes, over the 2MB limit`);
    }

    return { path: filePath, width: 1280, height: 720, sizeBytes };
  },
};
