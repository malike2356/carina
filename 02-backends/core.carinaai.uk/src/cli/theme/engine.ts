import { carinaDarkTheme } from './presets/default.js';
import { pickSpinnerFace, type SpinnerFaceSet } from './faces.js';
import { pickVerb, type VerbSet } from './verbs.js';

export type DisplayThemeConfig = {
  theme: 'default' | 'light' | 'scout';
  spinner: SpinnerFaceSet;
  verbs: VerbSet;
  bannerStyle: 'full' | 'compact' | 'minimal';
};

export const DEFAULT_DISPLAY_THEME: DisplayThemeConfig = {
  theme: 'default',
  spinner: 'dots',
  verbs: 'default',
  bannerStyle: 'full',
};

export function resolveThemePalette(_config: DisplayThemeConfig = DEFAULT_DISPLAY_THEME) {
  return carinaDarkTheme;
}

export function spinnerLabel(
  tick: number,
  config: DisplayThemeConfig = DEFAULT_DISPLAY_THEME,
): string {
  const face = pickSpinnerFace(config.spinner, tick);
  const verb = pickVerb(config.verbs, tick);
  return `${face} ${verb}...`;
}
