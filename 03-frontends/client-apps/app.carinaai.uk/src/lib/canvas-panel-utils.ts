import type { CanvasPanelLanguage } from './canvas-panel-types';

export const MIN_WIDTH = 300;
export const DEFAULT_WIDTH = 420;
const MAX_WIDTH_RATIO = 0.62;

export function titleFromContent(content: string, language: CanvasPanelLanguage): string {
  if (language === 'artifact' || language === 'canvas' || language === 'diagram') {
    try {
      const parsed = JSON.parse(content) as { title?: string };
      if (parsed?.title?.trim()) return parsed.title.trim();
    } catch {
      // not JSON
    }
  }
  return language === 'diagram' ? 'Diagram' : 'Artifact';
}

export function clampWidth(width: number): number {
  if (typeof window === 'undefined') return width;
  const max = Math.max(MIN_WIDTH, Math.floor(window.innerWidth * MAX_WIDTH_RATIO));
  return Math.max(MIN_WIDTH, Math.min(width, max));
}

export function readStoredCanvasPanelWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH;
  try {
    const raw = localStorage.getItem('carina-canvas-panel-width-v1');
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed)) {
      return clampWidth(parsed);
    }
  } catch {
    // ignore
  }
  return DEFAULT_WIDTH;
}
