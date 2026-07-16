import { describe, expect, it } from 'vitest';
import {
  clampTerminalColumns,
  clampTerminalRows,
  computeResponsiveFrame,
  fitLine,
  resolveLayoutMode,
  TUI_MIN_COLUMNS,
  TUI_MIN_ROWS,
} from './responsive-frame.js';

describe('responsive-frame', () => {
  it('clamps terminal size to minimum usable bounds', () => {
    expect(clampTerminalColumns(20)).toBe(TUI_MIN_COLUMNS);
    expect(clampTerminalRows(8)).toBe(TUI_MIN_ROWS);
  });

  it('uses compact mode on narrow terminals', () => {
    const frame = computeResponsiveFrame(60, 24);
    expect(frame.mode).toBe('compact');
    expect(frame.twoColumn).toBe(false);
    expect(frame.showTagline).toBe(false);
    expect(frame.showQuickCommands).toBe(false);
    expect(frame.showSystemHealth).toBe(false);
    expect(frame.leftWidth).toBe(frame.contentWidth);
    expect(frame.rightWidth).toBe(0);
  });

  it('uses normal mode on medium terminals', () => {
    const frame = computeResponsiveFrame(90, 24);
    expect(frame.mode).toBe('normal');
    expect(frame.twoColumn).toBe(false);
    expect(frame.showSessionMeta).toBe(true);
    expect(frame.showActiveProjects).toBe(true);
    expect(frame.showQuickCommands).toBe(false);
  });

  it('uses wide mode on large terminals', () => {
    const frame = computeResponsiveFrame(132, 30);
    expect(frame.mode).toBe('wide');
    expect(frame.twoColumn).toBe(true);
    expect(frame.showTagline).toBe(true);
    expect(frame.showQuickCommands).toBe(true);
    expect(frame.leftWidth + frame.rightWidth).toBeLessThanOrEqual(frame.contentWidth);
    expect(frame.leftWidth).toBeGreaterThanOrEqual(28);
    expect(frame.rightWidth).toBeGreaterThanOrEqual(20);
  });

  it('keeps body height above footer and header', () => {
    const frame = computeResponsiveFrame(50, 14);
    expect(frame.bodyHeight).toBeGreaterThanOrEqual(4);
    expect(frame.headerHeight + frame.footerHeight + frame.bodyHeight).toBeLessThanOrEqual(frame.rows);
  });

  it('resolves compact mode when height is limited', () => {
    expect(resolveLayoutMode(120, 16)).toBe('compact');
  });

  it('truncates composed header lines safely', () => {
    const line = fitLine([
      'User: Laud',
      'Session: #7a2f4e',
      '18:42:21',
    ], 28);
    expect(line.length).toBeLessThanOrEqual(28);
  });
});
