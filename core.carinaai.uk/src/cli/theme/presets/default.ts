/** Odysseus-inspired dark palette for terminal and web surfaces. */
export const carinaDarkTheme = {
  bgPrimary: '#0d1117',
  bgSecondary: '#161b22',
  bgTertiary: '#21262d',
  borderPrimary: '#30363d',
  textPrimary: '#e6edf3',
  textSecondary: '#8b949e',
  textTertiary: '#6e7681',
  accentBlue: '#58a6ff',
  accentGreen: '#3fb950',
  accentRed: '#f85149',
  accentOrange: '#d29922',
  accentPurple: '#a371f7',
} as const;

export type CarinaThemePreset = typeof carinaDarkTheme;
