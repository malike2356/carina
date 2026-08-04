/**
 * Faceless stock / B-roll stills for Property Channel visuals.
 *
 * Prefer workspace Drive-linked assets when PROPERTY_CHANNEL_STOCK_DIR points
 * at a folder of jpg/png stills. Otherwise generate branded stills per segment
 * (hook / body / cta). Never calls paid stock APIs in CI.
 */
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { propertyChannelStoreDir } from '../../lib/property-channel-store.js';
import { resolveBundledPlaceholderStill } from './bundled-still.js';

const execFileAsync = promisify(execFile);

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export type StockSource = 'workspace-folder' | 'generated' | 'bundled-placeholder';

export interface StockStill {
  path: string;
  source: StockSource;
}

function stockDir(): string | null {
  const fromEnv = process.env.PROPERTY_CHANNEL_STOCK_DIR?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const defaultDir = path.join(propertyChannelStoreDir(), 'media', 'stock');
  if (fs.existsSync(defaultDir)) return defaultDir;
  return null;
}

function listFolderStills(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => IMAGE_EXTS.has(path.extname(name).toLowerCase()))
      .map((name) => path.join(dir, name))
      .sort();
  } catch {
    return [];
  }
}

async function generateSegmentStill(opts: {
  jobId: string;
  segmentKey: string;
  label: string;
  location: string;
  color: string;
}): Promise<string> {
  const dir = path.join(propertyChannelStoreDir(), 'media', 'stills', opts.jobId);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${opts.segmentKey}.png`);
  if (fs.existsSync(out) && fs.statSync(out).size > 1024) return out;

  const title = opts.label.replace(/'/g, '').slice(0, 40);
  const place = opts.location.replace(/'/g, '').slice(0, 40);
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        `color=c=${opts.color}:s=1920x1080:d=1`,
        '-vf',
        [
          `drawtext=text='${title}':fontcolor=white:fontsize=64:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h/2-80`,
          `drawtext=text='${place}':fontcolor=0xe2e8f0:fontsize=40:x=(w-text_w)/2:y=h/2+20`,
        ].join(','),
        '-frames:v',
        '1',
        out,
      ],
      { timeout: 30_000 },
    );
    return out;
  } catch {
    return resolveBundledPlaceholderStill();
  }
}

const SECTION_COLORS: Record<string, string> = {
  hook: '0x0f172a',
  body: '0x1e3a5f',
  cta: '0x134e4a',
};

/**
 * Resolve a still for a script section. Workspace folder stills are preferred;
 * otherwise generate a branded PNG; on total failure use the Phase A SVG placeholder path.
 */
export async function resolveStockStill(input: {
  jobId: string;
  location: string;
  sectionLabel: 'hook' | 'body' | 'cta';
  index: number;
}): Promise<StockStill> {
  const folder = stockDir();
  if (folder) {
    const stills = listFolderStills(folder);
    if (stills.length > 0) {
      const pick = stills[input.index % stills.length]!;
      return { path: pick, source: 'workspace-folder' };
    }
  }

  try {
    const pathOut = await generateSegmentStill({
      jobId: input.jobId,
      segmentKey: `${input.sectionLabel}-${input.index}`,
      label: input.sectionLabel === 'cta' ? 'Subscribe for more' : input.sectionLabel.toUpperCase(),
      location: input.location,
      color: SECTION_COLORS[input.sectionLabel] ?? '0x0f172a',
    });
    if (pathOut.endsWith('.svg')) {
      return { path: pathOut, source: 'bundled-placeholder' };
    }
    return { path: pathOut, source: 'generated' };
  } catch {
    return { path: resolveBundledPlaceholderStill(), source: 'bundled-placeholder' };
  }
}
