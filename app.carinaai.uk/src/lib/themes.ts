export interface ThemeTokens {
  '--bg-base': string;
  '--bg-surface': string;
  '--bg-elevated': string;
  '--bg-overlay': string;
  '--border-subtle': string;
  '--border-focus': string;
  '--border-muted': string;
  '--text-primary': string;
  '--text-secondary': string;
  '--text-muted': string;
  '--accent': string;
  '--accent-dim': string;
  '--accent-hover': string;
  '--danger': string;
  '--danger-dim': string;
  '--bubble-user': string;
  '--bubble-assistant': string;
  '--code-bg': string;
  '--code-text': string;
}

export interface ThemeDefinition {
  label: string;
  description: string;
  tokens: ThemeTokens;
}

export const DEFAULT_THEME = 'dark';

export const THEMES: Record<string, ThemeDefinition> = {
  dark: {
    label: 'Dark',
    description: 'Deep charcoal backgrounds with Carina green accents. Default.',
    tokens: {
      '--bg-base': '#0f1117',
      '--bg-surface': '#161921',
      '--bg-elevated': '#1e2130',
      '--bg-overlay': '#252838',
      '--border-subtle': '#2a2d3e',
      '--border-focus': '#22c55e',
      '--border-muted': '#1e2130',
      '--text-primary': '#f0f2f5',
      '--text-secondary': '#8b92a5',
      '--text-muted': '#4a5068',
      '--accent': '#22c55e',
      '--accent-dim': '#166534',
      '--accent-hover': '#16a34a',
      '--danger': '#ef4444',
      '--danger-dim': '#7f1d1d',
      '--bubble-user': '#1e3a2f',
      '--bubble-assistant': '#1a1d2e',
      '--code-bg': '#0d1117',
      '--code-text': '#e6edf3',
    },
  },
  light: {
    label: 'Light',
    description: 'Clean white surface with green accents. Good for bright environments.',
    tokens: {
      '--bg-base': '#f8f9fa',
      '--bg-surface': '#ffffff',
      '--bg-elevated': '#f1f3f5',
      '--bg-overlay': '#e9ecef',
      '--border-subtle': '#dee2e6',
      '--border-focus': '#16a34a',
      '--border-muted': '#f1f3f5',
      '--text-primary': '#1a1d2e',
      '--text-secondary': '#495057',
      '--text-muted': '#6c757d',
      '--accent': '#16a34a',
      '--accent-dim': '#dcfce7',
      '--accent-hover': '#15803d',
      '--danger': '#dc2626',
      '--danger-dim': '#fee2e2',
      '--bubble-user': '#dcfce7',
      '--bubble-assistant': '#f1f3f5',
      '--code-bg': '#0d1117',
      '--code-text': '#e6edf3',
    },
  },
  midnight: {
    label: 'Midnight',
    description: 'Pure black base with electric blue accents. Maximum contrast for late nights.',
    tokens: {
      '--bg-base': '#000000',
      '--bg-surface': '#0a0a0f',
      '--bg-elevated': '#111118',
      '--bg-overlay': '#181820',
      '--border-subtle': '#1e1e2a',
      '--border-focus': '#3b82f6',
      '--border-muted': '#111118',
      '--text-primary': '#ffffff',
      '--text-secondary': '#94a3b8',
      '--text-muted': '#475569',
      '--accent': '#3b82f6',
      '--accent-dim': '#1e3a5f',
      '--accent-hover': '#2563eb',
      '--danger': '#ef4444',
      '--danger-dim': '#7f1d1d',
      '--bubble-user': '#1e2a4f',
      '--bubble-assistant': '#0f1118',
      '--code-bg': '#000000',
      '--code-text': '#f1f5f9',
    },
  },
  forest: {
    label: 'Forest',
    description: 'Warm dark greens with amber accents. Calm and focused.',
    tokens: {
      '--bg-base': '#0d1411',
      '--bg-surface': '#121a16',
      '--bg-elevated': '#182219',
      '--bg-overlay': '#1e2a1f',
      '--border-subtle': '#253326',
      '--border-focus': '#f59e0b',
      '--border-muted': '#182219',
      '--text-primary': '#e8f5e9',
      '--text-secondary': '#81c784',
      '--text-muted': '#4caf50',
      '--accent': '#f59e0b',
      '--accent-dim': '#451a03',
      '--accent-hover': '#d97706',
      '--danger': '#ef4444',
      '--danger-dim': '#7f1d1d',
      '--bubble-user': '#1a2e1e',
      '--bubble-assistant': '#131a14',
      '--code-bg': '#0a100c',
      '--code-text': '#d4edda',
    },
  },
};

export const THEME_TOKEN_MAP = Object.fromEntries(
  Object.entries(THEMES).map(([name, definition]) => [name, definition.tokens]),
) as Record<string, ThemeTokens>;

export function isThemeName(value: unknown): value is keyof typeof THEMES {
  return typeof value === 'string' && value in THEMES;
}
