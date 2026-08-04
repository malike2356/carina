import { execFile } from 'child_process';
import fs from 'fs';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const PROPERTY_CHANNEL_MP4_REQUIRED_ERROR =
  'YouTube Channel Beta: publishing requires a completed MP4 render. ' +
  'Full video render is in progress; scripts and scheduling work, but YouTube upload stays blocked until an MP4 is ready.';

/**
 * Returns true when path looks like a usable local MP4 (exists, .mp4 suffix,
 * optional ffprobe confirms a video stream). Used by youtube-upload and tests.
 */
export async function isValidPropertyChannelMp4(filePath: string | undefined): Promise<boolean> {
  if (!filePath || !filePath.toLowerCase().endsWith('.mp4')) return false;
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  if (stat.size < 1024) return false;

  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=codec_type',
        '-of',
        'csv=p=0',
        filePath,
      ],
      { timeout: 15_000 },
    );
    return stdout.trim().includes('video');
  } catch {
    // If ffprobe is missing, still insist on a non-tiny .mp4 file on disk.
    return stat.size > 10_000;
  }
}
