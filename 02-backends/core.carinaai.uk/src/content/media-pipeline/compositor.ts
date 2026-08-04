import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { propertyChannelStoreDir } from '../../lib/property-channel-store.js';
import { VIDEO_FORMAT_SPEC } from './types.js';
import type { VoiceoverAsset } from './voiceover.js';
import type { VisualsManifest } from './visuals.js';
import type { ThumbnailAsset } from './thumbnail.js';

const execFileAsync = promisify(execFile);

export interface VideoManifest {
  path: string;
  videoPath: string;
  format: typeof VIDEO_FORMAT_SPEC;
  durationSeconds: number;
  estimatedFileSizeMb: number;
  voiceover: VoiceoverAsset;
  visuals: VisualsManifest;
  thumbnail: ThumbnailAsset;
}

function escapeAssText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

function formatAssTime(seconds: number): string {
  const totalCs = Math.max(0, Math.round(seconds * 100));
  const h = Math.floor(totalCs / 360000);
  const m = Math.floor((totalCs % 360000) / 6000);
  const s = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function writeAssSubtitles(filePath: string, cues: VisualsManifest['captionCues']): void {
  const dialogue = cues
    .map((cue) => {
      const text = escapeAssText(cue.text).slice(0, 90);
      return `Dialogue: 0,${formatAssTime(cue.startSeconds)},${formatAssTime(cue.endSeconds)},Default,,0,0,0,,${text}`;
    })
    .join('\n');

  const content = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,80,80,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${dialogue}
`;
  fs.writeFileSync(filePath, content);
}

async function materializeStillPng(stillPath: string, outPng: string): Promise<void> {
  const lower = stillPath.toLowerCase();
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    if (stillPath !== outPng) fs.copyFileSync(stillPath, outPng);
    return;
  }
  // SVG/placeholder: ffmpeg often lacks an SVG decoder; use a branded lavfi still.
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=0x0f172a:s=1920x1080:d=1',
      '-vf',
      "drawtext=text='Channel':fontcolor=white:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2",
      '-frames:v',
      '1',
      outPng,
    ],
    { timeout: 30_000 },
  );
}

/**
 * Muxes voiceover + still (slow zoom) + captions into H.264/AAC MP4.
 * Writes a sidecar JSON manifest and a first-class .mp4 at videoPath.
 * Phase A may run inline from the media step; Phase B must move this to a queue.
 */
export async function composeVideo(input: {
  jobId: string;
  voiceover: VoiceoverAsset;
  visuals: VisualsManifest;
  thumbnail: ThumbnailAsset;
}): Promise<VideoManifest> {
  const durationSeconds = Math.max(
    input.voiceover.durationSeconds,
    input.visuals.segments.reduce((max, s) => Math.max(max, s.startSeconds + s.durationSeconds), 0),
    5,
  );
  const estimatedFileSizeMb = Math.round(((8000 + 192) * durationSeconds) / 8 / 1000);

  const dir = path.join(propertyChannelStoreDir(), 'media', 'videos');
  const workDir = path.join(propertyChannelStoreDir(), 'media', 'work', input.jobId);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(workDir, { recursive: true });

  const videoPath = path.join(dir, `${input.jobId}.mp4`);
  const stillPng = path.join(workDir, 'still.png');
  const assPath = path.join(workDir, 'captions.ass');

  await materializeStillPng(input.visuals.backgroundStillPath, stillPng);
  writeAssSubtitles(assPath, input.visuals.captionCues);

  // Normalize voiceover loudness before mux (Phase C quality).
  const normalizedAudio = path.join(workDir, 'voiceover-loudnorm.mp3');
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        input.voiceover.path,
        '-af',
        'loudnorm=I=-16:TP=-1.5:LRA=11',
        '-ar',
        '44100',
        normalizedAudio,
      ],
      { timeout: 120_000 },
    );
  } catch {
    fs.copyFileSync(input.voiceover.path, normalizedAudio);
  }

  // Slow zoom (Ken Burns-ish) over the voiceover length; burn ASS captions.
  const vf =
    `scale=2000:1125,zoompan=z='min(zoom+0.0004,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,` +
    `ass=${assPath.replace(/\\/g, '/').replace(/:/g, '\\:')}`;

  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-loop',
        '1',
        '-i',
        stillPng,
        '-i',
        normalizedAudio,
        '-vf',
        vf,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-shortest',
        '-t',
        String(Math.ceil(durationSeconds)),
        '-r',
        '30',
        videoPath,
      ],
      { timeout: Math.max(120_000, Math.ceil(durationSeconds) * 2000) },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`ffmpeg compose failed: ${msg}`);
  }

  if (!fs.existsSync(videoPath) || fs.statSync(videoPath).size < 1024) {
    throw new Error('ffmpeg compose finished without a usable MP4');
  }

  const manifestBody = {
    jobId: input.jobId,
    format: VIDEO_FORMAT_SPEC,
    durationSeconds,
    estimatedFileSizeMb,
    videoPath,
    voiceover: input.voiceover,
    visuals: input.visuals,
    thumbnail: input.thumbnail,
  };

  const manifestDir = path.join(propertyChannelStoreDir(), 'media', 'video-manifests');
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, `${input.jobId}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifestBody, null, 2));

  return {
    path: manifestPath,
    videoPath,
    format: VIDEO_FORMAT_SPEC,
    durationSeconds,
    estimatedFileSizeMb,
    voiceover: input.voiceover,
    visuals: input.visuals,
    thumbnail: input.thumbnail,
  };
}
