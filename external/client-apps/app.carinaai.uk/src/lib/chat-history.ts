const MAX_HISTORY = 50;
const HIST_KEY = 'carina.chat.inputHistory';

export function pushInputHistory(text: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(HIST_KEY);
    const history: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (history.at(-1) === text) return;
    history.push(text);
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
    window.sessionStorage.setItem(HIST_KEY, JSON.stringify(history));
  } catch {
    // sessionStorage unavailable
  }
}

export function getInputHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(HIST_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
