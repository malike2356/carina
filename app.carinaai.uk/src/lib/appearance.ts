export interface AppearanceSettings {
  fontSize: 'xs' | 'sm' | 'base' | 'lg';
  messageDensity: 'compact' | 'comfortable' | 'spacious';
  sidebarCollapsed: boolean;
  showTimestamps: boolean;
  showTokenCounts: boolean;
  showModelBadge: boolean;
  showTypingDots: boolean;
  codeWordWrap: boolean;
  animationsEnabled: boolean;
}

export const APPEARANCE_DEFAULTS: AppearanceSettings = {
  fontSize: 'sm',
  messageDensity: 'comfortable',
  sidebarCollapsed: false,
  showTimestamps: false,
  showTokenCounts: true,
  showModelBadge: true,
  showTypingDots: true,
  codeWordWrap: false,
  animationsEnabled: true,
};

const FONT_SIZES: Record<AppearanceSettings['fontSize'], string> = {
  xs: '11px',
  sm: '12px',
  base: '14px',
  lg: '16px',
};

const DENSITY_GAPS: Record<AppearanceSettings['messageDensity'], string> = {
  compact: '8px',
  comfortable: '16px',
  spacious: '28px',
};

export function normalizeAppearance(value: unknown): AppearanceSettings {
  const source = typeof value === 'object' && value !== null ? (value as Partial<AppearanceSettings>) : {};
  return {
    fontSize: ['xs', 'sm', 'base', 'lg'].includes(source.fontSize ?? '')
      ? (source.fontSize as AppearanceSettings['fontSize'])
      : APPEARANCE_DEFAULTS.fontSize,
    messageDensity: ['compact', 'comfortable', 'spacious'].includes(source.messageDensity ?? '')
      ? (source.messageDensity as AppearanceSettings['messageDensity'])
      : APPEARANCE_DEFAULTS.messageDensity,
    sidebarCollapsed: typeof source.sidebarCollapsed === 'boolean'
      ? source.sidebarCollapsed
      : APPEARANCE_DEFAULTS.sidebarCollapsed,
    showTimestamps: typeof source.showTimestamps === 'boolean'
      ? source.showTimestamps
      : APPEARANCE_DEFAULTS.showTimestamps,
    showTokenCounts: typeof source.showTokenCounts === 'boolean'
      ? source.showTokenCounts
      : APPEARANCE_DEFAULTS.showTokenCounts,
    showModelBadge: typeof source.showModelBadge === 'boolean'
      ? source.showModelBadge
      : APPEARANCE_DEFAULTS.showModelBadge,
    showTypingDots: typeof source.showTypingDots === 'boolean'
      ? source.showTypingDots
      : APPEARANCE_DEFAULTS.showTypingDots,
    codeWordWrap: typeof source.codeWordWrap === 'boolean'
      ? source.codeWordWrap
      : APPEARANCE_DEFAULTS.codeWordWrap,
    animationsEnabled: typeof source.animationsEnabled === 'boolean'
      ? source.animationsEnabled
      : APPEARANCE_DEFAULTS.animationsEnabled,
  };
}

export function appearanceToCSS(appearance: AppearanceSettings): Record<string, string> {
  return {
    '--chat-font-size': FONT_SIZES[appearance.fontSize],
    '--message-gap': DENSITY_GAPS[appearance.messageDensity],
  };
}
