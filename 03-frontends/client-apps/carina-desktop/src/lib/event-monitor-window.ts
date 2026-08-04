import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export async function openEventMonitorWindow(): Promise<WebviewWindow> {
  const label = 'carina-events';
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.setFocus();
    return existing;
  }

  const base = `${window.location.origin}${window.location.pathname}`;
  return new WebviewWindow(label, {
    url: `${base}#/events`,
    title: 'Carina Events',
    width: 720,
    height: 640,
    decorations: true,
    resizable: true,
  });
}
