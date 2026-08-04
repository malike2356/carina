import { describe, expect, it, vi } from 'vitest';
import { disableMouseReporting, withSelectionFriendlyUnmount, type SelectionFriendlyStream } from './terminal-selection.js';

function createStream(isTTY = true): SelectionFriendlyStream & { writes: string[] } {
  const writes: string[] = [];
  return {
    isTTY,
    writes,
    write(chunk: string) {
      writes.push(chunk);
      return true;
    },
  };
}

describe('terminal selection helpers', () => {
  it('disables xterm mouse reporting for TTY streams', () => {
    const stream = createStream();

    disableMouseReporting(stream);

    expect(stream.writes).toHaveLength(1);
    expect(stream.writes[0]).toContain('\x1b[?1000l');
    expect(stream.writes[0]).toContain('\x1b[?1006l');
  });

  it('does not write control sequences to non-TTY streams', () => {
    const stream = createStream(false);

    disableMouseReporting(stream);

    expect(stream.writes).toEqual([]);
  });

  it('wraps unmount with mouse-reporting cleanup before and after', () => {
    const calls: string[] = [];
    const unmount = vi.fn(() => calls.push('unmount'));
    const stream = createStream();
    const originalStdout = process.stdout;

    Object.defineProperty(process, 'stdout', {
      configurable: true,
      value: {
        isTTY: true,
        write(chunk: string) {
          calls.push(chunk);
          stream.write(chunk);
          return true;
        },
      },
    });

    try {
      withSelectionFriendlyUnmount(unmount)();
    } finally {
      Object.defineProperty(process, 'stdout', {
        configurable: true,
        value: originalStdout,
      });
    }

    expect(unmount).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(3);
    expect(calls[0]).toContain('\x1b[?1000l');
    expect(calls[1]).toBe('unmount');
    expect(calls[2]).toContain('\x1b[?1006l');
  });
});
