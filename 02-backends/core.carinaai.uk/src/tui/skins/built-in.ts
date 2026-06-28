import type { CarinaThemeSkin } from './skin-schema.js';

export const DEFAULT_SKIN: CarinaThemeSkin = {
  name: 'default',
  label: 'Default (Carina Blue)',
  accent: 'cyan',
  dimColor: 'grey',
  successColor: 'green',
  errorColor: 'red',
  warningColor: 'yellow',
  bannerGradient: null,
  bannerColor: 'cyan',
  spinner: { frames: ['|', '/', '-', '\\'], color: 'cyan' },
  responsePrefix: 'Carina',
  toolPrefix: '[tool]',
  statusBar: 'full',
};

export const SENTINEL_SKIN: CarinaThemeSkin = {
  name: 'sentinel',
  label: 'Sentinel (Alert Red)',
  accent: 'red',
  dimColor: 'grey',
  successColor: 'green',
  errorColor: 'redBright',
  warningColor: 'yellowBright',
  bannerGradient: null,
  bannerColor: 'red',
  spinner: { frames: ['>', '>>', '>>>', '>>'], color: 'red' },
  responsePrefix: 'Sentinel',
  toolPrefix: '[!]',
  statusBar: 'full',
};

export const VOID_SKIN: CarinaThemeSkin = {
  name: 'void',
  label: 'Void (No Color)',
  accent: 'white',
  dimColor: 'white',
  successColor: 'white',
  errorColor: 'white',
  warningColor: 'white',
  bannerGradient: null,
  bannerColor: 'white',
  spinner: { frames: ['.', '..', '...', '....', '...', '..'], color: 'white' },
  responsePrefix: 'C',
  toolPrefix: '[t]',
  statusBar: 'minimal',
};

export const STONE_SKIN: CarinaThemeSkin = {
  name: 'stone',
  label: 'Stone (Muted Grey)',
  accent: 'blueBright',
  dimColor: 'grey',
  successColor: 'greenBright',
  errorColor: 'redBright',
  warningColor: 'yellowBright',
  bannerGradient: 'atlas',
  bannerColor: 'blueBright',
  spinner: { frames: ['◐', '◓', '◑', '◒'], color: 'blueBright' },
  responsePrefix: 'Carina',
  toolPrefix: '[>]',
  statusBar: 'full',
};

export const BUILT_IN_SKINS: Record<string, CarinaThemeSkin> = {
  default: DEFAULT_SKIN,
  sentinel: SENTINEL_SKIN,
  void: VOID_SKIN,
  stone: STONE_SKIN,
};

export const SKIN_ALIASES: Record<string, string> = {
  ares: 'sentinel',
  mono: 'void',
  slate: 'stone',
};
