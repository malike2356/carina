import { describe, expect, it } from 'vitest';
import './index.js';
import { debugHelpersTool } from './debug-helpers.js';

describe('debug-helpers', () => {
  it('lists registered tools', async () => {
    const result = await debugHelpersTool.execute({ action: 'tools' }) as Record<string, unknown>;
    expect(Number(result.count)).toBeGreaterThan(10);
    expect(Array.isArray(result.tools)).toBe(true);
  });

  it('returns safe env summary', async () => {
    const result = await debugHelpersTool.execute({ action: 'env' }) as Record<string, unknown>;
    expect(result.node_version).toBeTruthy();
    expect(result.platform).toBeTruthy();
  });

  it('lists background processes', async () => {
    const result = await debugHelpersTool.execute({ action: 'processes' }) as Record<string, unknown>;
    expect(Array.isArray(result.processes)).toBe(true);
  });
});
