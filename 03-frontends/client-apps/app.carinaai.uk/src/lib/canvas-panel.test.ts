import { describe, expect, it } from 'vitest';
import { clampWidth, titleFromContent } from './canvas-panel-utils';

describe('canvas panel helpers', () => {
  it('extracts title from artifact JSON', () => {
    const title = titleFromContent('{"title":"Launch plan","nodes":[]}', 'artifact');
    expect(title).toBe('Launch plan');
  });

  it('falls back to diagram label', () => {
    expect(titleFromContent('not-json', 'diagram')).toBe('Diagram');
  });

  it('clamps width between min and viewport ratio', () => {
    const original = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { innerWidth: 1000 },
    });
    expect(clampWidth(100)).toBe(300);
    expect(clampWidth(900)).toBe(620);
    Object.defineProperty(globalThis, 'window', { configurable: true, value: original });
  });
});
