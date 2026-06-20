import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
export async function checkForUpdates() {
    try {
        const update = await check();
        if (!update)
            return null;
        return {
            version: update.version,
            body: update.body,
        };
    }
    catch {
        return null;
    }
}
export async function installUpdateAndRelaunch() {
    const update = await check();
    if (!update)
        return;
    await update.downloadAndInstall();
    await relaunch();
}
