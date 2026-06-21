const STORAGE_KEY = 'carina_desktop_appearance';
export const DEFAULT_APPEARANCE = {
    theme: 'dark',
    fontSize: 'medium',
    density: 'comfortable',
    codeFont: 'ui-monospace',
    accent: '#6366f1',
    timestamps: 'relative',
};
export function loadAppearance() {
    try {
        return { ...DEFAULT_APPEARANCE, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
    }
    catch {
        return DEFAULT_APPEARANCE;
    }
}
export function saveAppearance(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
export function applyAppearance(settings) {
    const root = document.documentElement;
    const theme = settings.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : settings.theme;
    root.dataset.theme = theme;
    root.dataset.fontSize = settings.fontSize;
    root.dataset.density = settings.density;
    root.dataset.timestamps = settings.timestamps;
    root.style.setProperty('--carina-accent', settings.accent);
    root.style.setProperty('--carina-code-font', settings.codeFont);
}
