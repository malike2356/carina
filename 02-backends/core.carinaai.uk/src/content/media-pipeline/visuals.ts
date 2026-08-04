import fs from 'fs';
import path from 'path';
import { propertyChannelStoreDir } from '../../lib/property-channel-store.js';
import type { StructuredScript } from '../script-generator/templates/script-structure.js';
import { resolveBundledPlaceholderStill } from './bundled-still.js';
import { resolveStockStill } from './stock-visuals.js';

export interface CaptionCue {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface VisualSegment {
  order: number;
  type: 'property-image' | 'text-overlay' | 'b-roll-transition' | 'lower-third' | 'end-screen';
  source: 'workspace-asset-library' | 'stock' | 'generated' | 'bundled-placeholder';
  caption: string;
  startSeconds: number;
  durationSeconds: number;
  /** Absolute path to a still image used for this segment. */
  stillPath?: string;
}

export interface VisualsManifest {
  path: string;
  segments: VisualSegment[];
  captionCues: CaptionCue[];
  /** Primary still for Ken Burns / static zoom in compositor. */
  backgroundStillPath: string;
  /** Ordered stills for hook / body / cta segments (Phase B). */
  segmentStillPaths: string[];
}

export interface VisualsEngine {
  buildPlan(input: { jobId: string; location: string; script: StructuredScript }): Promise<VisualsManifest>;
}

export { resolveBundledPlaceholderStill };

function buildCaptionCues(script: StructuredScript): CaptionCue[] {
  const cues: CaptionCue[] = [];
  let cursor = 0;
  for (const section of script.sections) {
    const chunk = section.text.replace(/\s+/g, ' ').trim();
    const parts =
      section.label === 'body'
        ? chunk.split(/(?<=\.)\s+/).filter(Boolean).slice(0, 8)
        : [chunk.slice(0, 140)];
    const slice = section.approxSeconds / Math.max(1, parts.length);
    for (const part of parts) {
      const startSeconds = cursor;
      const endSeconds = cursor + slice;
      cues.push({
        startSeconds,
        endSeconds,
        text: part.slice(0, 90),
      });
      cursor = endSeconds;
    }
  }
  return cues;
}

function mapSource(stockSource: string): VisualSegment['source'] {
  if (stockSource === 'workspace-folder') return 'workspace-asset-library';
  if (stockSource === 'generated') return 'generated';
  return 'bundled-placeholder';
}

/**
 * Builds the visual plan: timed segments + caption cues + faceless stills.
 * Prefer workspace stock folder; else generate branded PNG stills per section;
 * fall back to Phase A placeholder if generation fails.
 */
export const defaultVisualsEngine: VisualsEngine = {
  async buildPlan(input) {
    let cursor = 0;
    const segments: VisualSegment[] = [];
    const segmentStillPaths: string[] = [];
    let stillIndex = 0;

    for (const section of input.script.sections) {
      const stock = await resolveStockStill({
        jobId: input.jobId,
        location: input.location,
        sectionLabel: section.label,
        index: stillIndex,
      });
      stillIndex += 1;
      segmentStillPaths.push(stock.path);
      const source = mapSource(stock.source);

      if (section.label === 'hook') {
        segments.push({
          order: segments.length,
          type: 'property-image',
          source,
          caption: `${input.location} property, hook: ${section.text.slice(0, 60)}`,
          startSeconds: cursor,
          durationSeconds: section.approxSeconds,
          stillPath: stock.path,
        });
      } else if (section.label === 'body') {
        const points = section.text.split('\n').filter(Boolean);
        const safePoints = points.length > 0 ? points : [section.text.slice(0, 120) || 'Key points'];
        const perPoint = Math.max(10, Math.floor(section.approxSeconds / Math.max(1, safePoints.length)));
        for (const point of safePoints) {
          const bodyStock = await resolveStockStill({
            jobId: input.jobId,
            location: input.location,
            sectionLabel: 'body',
            index: stillIndex,
          });
          stillIndex += 1;
          segmentStillPaths.push(bodyStock.path);
          segments.push({
            order: segments.length,
            type: 'property-image',
            source: mapSource(bodyStock.source),
            caption: point.slice(0, 80),
            startSeconds: cursor,
            durationSeconds: perPoint,
            stillPath: bodyStock.path,
          });
          segments.push({
            order: segments.length,
            type: 'text-overlay',
            source: 'generated',
            caption: point.slice(0, 80),
            startSeconds: cursor,
            durationSeconds: perPoint,
          });
          cursor += perPoint;
        }
        segments.push({
          order: segments.length,
          type: 'lower-third',
          source: 'generated',
          caption: `${input.location} property details`,
          startSeconds: Math.max(0, cursor - perPoint),
          durationSeconds: perPoint,
        });
        continue;
      } else {
        segments.push({
          order: segments.length,
          type: 'end-screen',
          source: 'generated',
          caption: 'Subscribe and watch next video',
          startSeconds: cursor,
          durationSeconds: section.approxSeconds,
          stillPath: stock.path,
        });
      }
      cursor += section.approxSeconds;
    }

    const backgroundStillPath = segmentStillPaths[0] ?? resolveBundledPlaceholderStill();
    const captionCues = buildCaptionCues(input.script);
    const dir = path.join(propertyChannelStoreDir(), 'media', 'visuals');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${input.jobId}.json`);
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          jobId: input.jobId,
          backgroundStillPath,
          segmentStillPaths,
          note: 'Faceless stock path: workspace PROPERTY_CHANNEL_STOCK_DIR or generated stills; bundled SVG is fallback only.',
          segments,
          captionCues,
        },
        null,
        2,
      ),
    );

    return { path: filePath, segments, captionCues, backgroundStillPath, segmentStillPaths };
  },
};
