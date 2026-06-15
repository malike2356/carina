import { existsSync } from 'fs';
import { homedir, platform } from 'os';
import { describe, expect, it } from 'vitest';
import {
  CARINA_CONFIG_DIR,
  CARINA_TEMP_DIR,
  ensurePlatformDirs,
  tempFile,
} from './platform-paths.js';

describe('platform-paths', () => {
  it('CARINA_TEMP_DIR does not contain hardcoded /tmp on Windows', () => {
    if (platform() === 'win32') {
      expect(CARINA_TEMP_DIR).not.toContain('/tmp');
      expect(CARINA_TEMP_DIR.toLowerCase()).toContain('temp');
    } else {
      expect(CARINA_TEMP_DIR).toContain('carina');
    }
  });

  it('tempFile returns a path inside CARINA_TEMP_DIR', () => {
    const p = tempFile('output.txt');
    expect(p).toContain('carina');
    expect(p).toContain('output.txt');
  });

  it('CARINA_CONFIG_DIR is under the home directory', () => {
    expect(CARINA_CONFIG_DIR.startsWith(homedir())).toBe(true);
  });

  it('ensurePlatformDirs creates CARINA_TEMP_DIR', () => {
    ensurePlatformDirs();
    expect(existsSync(CARINA_TEMP_DIR)).toBe(true);
  });
});
