import type { TerminalSize } from './terminal.js';
import { computeLayout, type LayoutFrame } from './layout.js';
import type { SidePanelType } from './panels/panel-manager.js';

export interface SplitLayout extends LayoutFrame {
  mainWidth: number;
  panelWidth: number;
  sidePanel: SidePanelType;
}

export function computeSplitLayout(size: TerminalSize, sidePanel: SidePanelType): SplitLayout {
  const base = computeLayout(size);
  if (sidePanel === 'none' || base.narrow) {
    return {
      ...base,
      mainWidth: base.width,
      panelWidth: 0,
      sidePanel: 'none',
    };
  }
  const mainWidth = Math.max(28, Math.floor(base.width * 0.65));
  const panelWidth = Math.max(20, base.width - mainWidth - 1);
  return { ...base, mainWidth, panelWidth, sidePanel };
}

export function mergeSplitLines(mainLines: string[], panelLines: string[], panelWidth: number): string[] {
  if (panelWidth <= 0) return mainLines;
  const height = Math.max(mainLines.length, panelLines.length);
  const merged: string[] = [];
  for (let i = 0; i < height; i++) {
    const left = mainLines[i] ?? '';
    const right = (panelLines[i] ?? '').padEnd(panelWidth).slice(0, panelWidth);
    merged.push(`${left}│${right}`);
  }
  return merged;
}
