import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateInfo = {
  version: string;
  body?: string | null;
};

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  try {
    const update = await check();
    if (!update) return null;
    return {
      version: update.version,
      body: update.body,
    };
  } catch {
    return null;
  }
}

export async function installUpdateAndRelaunch(): Promise<void> {
  const update = await check();
  if (!update) return;
  await update.downloadAndInstall();
  await relaunch();
}
