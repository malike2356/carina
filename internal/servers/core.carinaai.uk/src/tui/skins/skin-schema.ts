export interface SpinnerSkin {
  frames: string[];
  color: string;
}

export type StatusBarStyle = 'minimal' | 'full' | 'none';

export interface CarinaThemeSkin {
  name: string;
  label: string;
  accent: string;
  dimColor: string;
  successColor: string;
  errorColor: string;
  warningColor: string;
  bannerGradient: string | null;
  bannerColor: string;
  spinner: SpinnerSkin;
  responsePrefix: string;
  toolPrefix: string;
  statusBar: StatusBarStyle;
}
