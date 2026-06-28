import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolveResearchAsset } from './research-paths.js';

describe('resolveResearchAsset', () => {
  it('finds stats-analysis.py from src tree', () => {
    const path = resolveResearchAsset('stats-analysis.py');
    expect(existsSync(path)).toBe(true);
    expect(path).toContain('src/tools/research/stats-analysis.py');
  });

  it('finds sav-io.py from src tree', () => {
    const path = resolveResearchAsset('sav-io.py');
    expect(existsSync(path)).toBe(true);
  });

  it('finds r-analyze.R from src tree', () => {
    const path = resolveResearchAsset('r-analyze.R');
    expect(existsSync(path)).toBe(true);
  });
});
