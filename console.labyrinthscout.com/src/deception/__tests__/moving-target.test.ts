import { describe, it, expect, beforeEach, vi } from 'vitest';

const queryMock = vi.fn().mockResolvedValue({ rows: [] });

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

const { MovingTarget } = await import('../moving-target.js');

describe('MovingTarget', () => {
  let mt: MovingTarget;

  beforeEach(() => {
    mt = new MovingTarget();
  });

  it('generates a 4-char alphanumeric marker on construction', () => {
    const marker = mt.getCurrentMarker();
    expect(marker.value).toMatch(/^[A-Z0-9]{4}$/);
    expect(marker.rotatedAt).toBeInstanceOf(Date);
  });

  it('rotates to a new marker value', async () => {
    const old = mt.getCurrentMarker();
    const next = await mt.rotateMarker();
    expect(next.value).not.toBe(old.value);
    expect(next.value).toMatch(/^[A-Z0-9]{4}$/);
    expect(next.rotatedAt.getTime()).toBeGreaterThanOrEqual(old.rotatedAt.getTime());
  });

  it('retains exactly the last 5 previous markers', async () => {
    const markers: string[] = [];
    for (let i = 0; i < 10; i++) {
      const m = await mt.rotateMarker();
      markers.push(m.value);
    }

    const previous = mt.getPreviousMarkers();
    expect(previous).toHaveLength(5);
    // The 5 most recent retired markers should be in the list
    expect(previous.map((m) => m.value)).toEqual(markers.slice(4, 9).reverse());
  });

  it('tool-name mapping round-trips', () => {
    const publicName = mt.getCurrentToolName('web-search');
    expect(publicName).toMatch(/^tool_[A-Z0-9]{12}$/);

    const resolved = mt.resolveRealToolName(publicName);
    expect(resolved).toBe('web-search');
  });

  it('returns the same public name for the same real name', () => {
    const a = mt.getCurrentToolName('http-request');
    const b = mt.getCurrentToolName('http-request');
    expect(a).toBe(b);
  });

  it('returns undefined for unknown public tool name', () => {
    expect(mt.resolveRealToolName('tool_NONEXISTENT')).toBeUndefined();
  });

  it('newly constructed instance has no previous markers', () => {
    expect(mt.getPreviousMarkers()).toHaveLength(0);
  });
});
