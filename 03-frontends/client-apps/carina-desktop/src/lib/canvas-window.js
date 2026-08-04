import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
export async function openCanvasWindow(artifact) {
    const label = `canvas-${artifact.id}`;
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
        await existing.setFocus();
        return existing;
    }
    const base = `${window.location.origin}${window.location.pathname}`;
    return new WebviewWindow(label, {
        url: `${base}#/canvas?id=${encodeURIComponent(artifact.id)}`,
        title: artifact.title || 'Canvas',
        width: 900,
        height: 700,
        decorations: true,
        resizable: true,
    });
}
