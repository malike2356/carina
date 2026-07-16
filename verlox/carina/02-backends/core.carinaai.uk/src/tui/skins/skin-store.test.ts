import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SKIN, SENTINEL_SKIN } from './built-in.js';
import {
  getActiveSkin,
  listSkinNames,
  resolveSkin,
  setActiveSkin,
} from './skin-store.js';

describe('skin-store', () => {
  let tmpHome: string;
  let prevHome: string | undefined;

  beforeEach(() => {
    prevHome = process.env.CARINA_HOME;
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-skin-'));
    process.env.CARINA_HOME = tmpHome;
    setActiveSkin('default');
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = prevHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
    setActiveSkin('default');
  });

  it('resolveSkin(default) returns DEFAULT_SKIN', () => {
    expect(resolveSkin('default')).toEqual(DEFAULT_SKIN);
  });

  it('resolveSkin(unknown) returns null', () => {
    expect(resolveSkin('unknown-skin-xyz')).toBeNull();
  });

  it('resolveSkin maps aliases to built-in skins', () => {
    expect(resolveSkin('ares')).toEqual(SENTINEL_SKIN);
    expect(resolveSkin('mono')?.name).toBe('void');
    expect(resolveSkin('slate')?.name).toBe('stone');
  });

  it('custom YAML merges with DEFAULT_SKIN', () => {
    const skinsDir = path.join(tmpHome, 'skins');
    fs.mkdirSync(skinsDir, { recursive: true });
    fs.writeFileSync(path.join(skinsDir, 'verlox.yaml'), [
      'label: Verlox Brand',
      'accent: magenta',
      'responsePrefix: Verlox AI',
      'spinner:',
      '  frames: ["V", "E", "R"]',
      '  color: magenta',
    ].join('\n'));

    const skin = resolveSkin('verlox');
    expect(skin).not.toBeNull();
    expect(skin?.name).toBe('verlox');
    expect(skin?.label).toBe('Verlox Brand');
    expect(skin?.accent).toBe('magenta');
    expect(skin?.responsePrefix).toBe('Verlox AI');
    expect(skin?.bannerGradient).toBe(DEFAULT_SKIN.bannerGradient);
    expect(skin?.spinner.frames).toEqual(['V', 'E', 'R']);
    expect(skin?.spinner.color).toBe('magenta');
  });

  it('custom skins appear in listSkinNames', () => {
    const skinsDir = path.join(tmpHome, 'skins');
    fs.mkdirSync(skinsDir, { recursive: true });
    fs.writeFileSync(path.join(skinsDir, 'custom.yaml'), 'accent: blue\n');

    expect(listSkinNames()).toContain('custom');
    expect(listSkinNames()).toContain('default');
  });

  it('setActiveSkin updates getActiveSkin', () => {
    setActiveSkin('void');
    expect(getActiveSkin().name).toBe('void');
    expect(getActiveSkin().statusBar).toBe('full');
  });
});
