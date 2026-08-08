/**
 * Dual-mode status tones for light + dark themes.
 * Never use bare text-amber-100/200 on bg-amber-500/10 (unreadable on Aiva light).
 * Dark variants require `@custom-variant dark` in globals.css (class / data-theme-mode).
 */
export const warnTone = {
  /** Soft amber wash panel (borders included). */
  box: 'border border-amber-500/30 bg-amber-500/10',
  boxSoft: 'border border-amber-500/25 bg-amber-500/10',
  boxStrong: 'border border-amber-500/40 bg-amber-500/15',
  /** Primary copy on an amber wash. amber-950 stays readable if dark: ever misfires. */
  text: 'text-amber-950 dark:text-amber-100',
  textMuted: 'text-amber-900 dark:text-amber-200/90',
  textLabel: 'text-amber-900 dark:text-amber-100/90',
  /** Compact chip / badge on an amber wash. */
  chip: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300',
  chipSoft: 'bg-amber-500/15 text-amber-900 dark:text-amber-300',
  /** Accent icon / standalone warn color (works on base surfaces). */
  accent: 'text-amber-800 dark:text-amber-400',
  link: 'font-medium text-amber-950 underline underline-offset-2 dark:text-amber-50',
  dismiss: 'text-amber-900 hover:bg-amber-500/20 dark:text-amber-200',
} as const;

export const dangerTone = {
  box: 'border border-red-500/30 bg-red-500/10',
  boxSoft: 'border border-red-500/25 bg-red-500/10',
  text: 'text-red-800 dark:text-red-200',
  textMuted: 'text-red-700 dark:text-red-300',
  accent: 'text-red-700 dark:text-red-400',
  chip: 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300',
  chipSoft: 'bg-red-500/15 text-red-800 dark:text-red-300',
} as const;

export const successTone = {
  chipSoft: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  accent: 'text-emerald-700 dark:text-emerald-400',
} as const;

export const infoTone = {
  chipSoft: 'bg-sky-500/15 text-sky-800 dark:text-sky-300',
  accent: 'text-sky-700 dark:text-sky-400',
} as const;
