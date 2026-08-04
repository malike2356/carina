import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { render } from 'ink';
import { LauncherTUI } from './LauncherTUI.js';
import { computeResponsiveFrame } from '../../responsive-frame.js';

function createStdout(columns: number, rows: number) {
  const stdout = new EventEmitter() as NodeJS.WriteStream & EventEmitter;
  stdout.columns = columns;
  stdout.rows = rows;
  stdout.isTTY = true;
  stdout.write = (() => true) as NodeJS.WriteStream['write'];
  return stdout;
}

describe('launcher responsive smoke', () => {
  it('renders compact layout without crashing', () => {
    const stdout = createStdout(60, 20);
    const frame = computeResponsiveFrame(60, 20);
    expect(frame.mode).toBe('compact');
    expect(() => {
      const instance = render(
        <LauncherTUI version="0.2.0" onLaunchChat={() => undefined} />,
        { stdout, patchConsole: false },
      );
      instance.unmount();
    }).not.toThrow();
  });

  it('renders wide layout without crashing', () => {
    const stdout = createStdout(132, 32);
    const frame = computeResponsiveFrame(132, 32);
    expect(frame.mode).toBe('wide');
    expect(frame.twoColumn).toBe(true);
    expect(() => {
      const instance = render(
        <LauncherTUI version="0.2.0" onLaunchChat={() => undefined} />,
        { stdout, patchConsole: false },
      );
      instance.unmount();
    }).not.toThrow();
  });
});
