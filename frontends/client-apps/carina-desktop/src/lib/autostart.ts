import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';

export async function getAutostartEnabled(): Promise<boolean> {
  try {
    return await isEnabled();
  } catch {
    return localStorage.getItem('carina_desktop_autostart') === '1';
  }
}

export async function setAutostartEnabled(next: boolean): Promise<void> {
  try {
    if (next) {
      await enable();
    } else {
      await disable();
    }
  } catch {
    localStorage.setItem('carina_desktop_autostart', next ? '1' : '0');
  }
}
