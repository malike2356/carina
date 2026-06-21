/** Global shortcut is registered in the Tauri backend (CmdOrCtrl+Shift+C). */
export async function registerGlobalShortcuts(): Promise<void> {
  try {
    const { register } = await import('@tauri-apps/plugin-global-shortcut');
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await register('CommandOrControl+Shift+C', async () => {
      const win = getCurrentWindow();
      const visible = await win.isVisible();
      if (visible) {
        await win.hide();
      } else {
        await win.show();
        await win.setFocus();
      }
    });
  } catch {
    // Native Rust handler already covers desktop builds.
  }
}

export async function unregisterGlobalShortcuts(): Promise<void> {
  try {
    const { unregister } = await import('@tauri-apps/plugin-global-shortcut');
    await unregister('CommandOrControl+Shift+C');
  } catch {
    // No-op outside Tauri.
  }
}
