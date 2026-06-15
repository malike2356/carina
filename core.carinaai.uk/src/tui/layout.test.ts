import { describe, expect, it } from 'vitest';
import { tabBar, computeLayout, TUI_VIEWS } from './layout.js';

describe('tui layout', () => {
  it('marks narrow terminals below 72 columns', () => {
    const layout = computeLayout({ cols: 60, rows: 24 });
    expect(layout.narrow).toBe(true);
    expect(layout.contentHeight).toBeGreaterThan(3);
  });

  it('renders tab bar with active view highlighted', () => {
    const bar = tabBar('processes', 120);
    expect(bar).toContain('[3:Processes]');
    expect(TUI_VIEWS).toHaveLength(6);
  });

  it('shortens tab bar on very narrow width', () => {
    const bar = tabBar('chat', 30);
    expect(bar.length).toBeLessThanOrEqual(30);
  });
});
