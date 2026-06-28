import { describe, expect, it } from 'vitest';
import {
  classifyVramProfile,
  FLUX_VRAM_MIN_MB,
  SD_VRAM_MIN_MB,
  vramMbFromSystemStats,
} from './hardware.js';

describe('vramMbFromSystemStats', () => {
  it('reads max device vram_total in bytes', () => {
    const mb = vramMbFromSystemStats({
      devices: [
        { vram_total: 4 * 1024 ** 3 },
        { vram_total: 16 * 1024 ** 3 },
      ],
    });
    expect(mb).toBe(16 * 1024);
  });

  it('returns null when stats are empty', () => {
    expect(vramMbFromSystemStats({})).toBeNull();
  });
});

describe('classifyVramProfile', () => {
  it('marks flux capable at 12 GB+', () => {
    expect(classifyVramProfile(FLUX_VRAM_MIN_MB)).toBe('flux_capable');
  });

  it('marks sd capable between 6 GB and 12 GB', () => {
    expect(classifyVramProfile(SD_VRAM_MIN_MB)).toBe('sd_capable');
    expect(classifyVramProfile(SD_VRAM_MIN_MB + 1024)).toBe('sd_capable');
  });

  it('marks insufficient below 6 GB', () => {
    expect(classifyVramProfile(SD_VRAM_MIN_MB - 1)).toBe('insufficient');
  });

  it('returns unknown when vram is null', () => {
    expect(classifyVramProfile(null)).toBe('unknown');
  });
});
