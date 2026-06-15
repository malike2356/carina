import { describe, expect, it } from 'vitest';
import {
  defaultWindowsInstallHint,
  isWindowsPlatform,
  parseNodeMajor,
  windowsConptySupported,
} from './environment.js';

describe('windows environment helpers', () => {
  it('detects Windows platform', () => {
    expect(isWindowsPlatform('win32')).toBe(true);
    expect(isWindowsPlatform('linux')).toBe(false);
  });

  it('checks ConPTY build threshold', () => {
    expect(windowsConptySupported(17763)).toBe(true);
    expect(windowsConptySupported(10240)).toBe(false);
    expect(windowsConptySupported(null)).toBe(true);
  });

  it('parses node major version', () => {
    expect(parseNodeMajor('v22.14.0')).toBe(22);
    expect(parseNodeMajor('v21.0.0')).toBe(21);
    expect(parseNodeMajor(null)).toBeNull();
  });

  it('includes install and recovery hints', () => {
    expect(defaultWindowsInstallHint()).toContain('install-windows.ps1');
    expect(defaultWindowsInstallHint()).toContain('docs/WINDOWS.md');
  });
});
