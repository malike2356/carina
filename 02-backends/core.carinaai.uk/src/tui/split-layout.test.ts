import { describe, expect, it } from 'vitest';
import { computeSplitLayout, mergeSplitLines } from './split-layout.js';
import { buildScoutSnapshot } from './panels/scout-panel.js';
import { sidePanelFromFKey } from './panels/panel-manager.js';

describe('split layout', () => {
  it('allocates side panel width when panel is open', () => {
    const layout = computeSplitLayout({ cols: 120, rows: 30 }, 'scout');
    expect(layout.panelWidth).toBeGreaterThan(20);
    expect(layout.mainWidth + layout.panelWidth + 1).toBe(120);
  });

  it('collapses side panel on narrow terminals', () => {
    const layout = computeSplitLayout({ cols: 60, rows: 24 }, 'memory');
    expect(layout.panelWidth).toBe(0);
    expect(layout.sidePanel).toBe('none');
  });

  it('merges main and panel columns with divider', () => {
    const merged = mergeSplitLines(['left'], ['right'], 5);
    expect(merged[0]).toBe('left│right');
  });
});

describe('operator side panels', () => {
  it('maps function keys to panel types', () => {
    expect(sidePanelFromFKey('f1')).toBe('scout');
    expect(sidePanelFromFKey('f5')).toBe('close');
    expect(sidePanelFromFKey('f6')).toBe('security');
  });

  it('builds scout snapshot with bounded trust score', () => {
    const snap = buildScoutSnapshot();
    expect(snap.trustScore).toBeGreaterThanOrEqual(0);
    expect(snap.trustScore).toBeLessThanOrEqual(100);
  });
});
