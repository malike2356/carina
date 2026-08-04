import { open, save, type DialogFilter } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

export type { DialogFilter as FileFilter };

export async function pickFile(options?: { multiple?: boolean; filters?: DialogFilter[] }): Promise<string | string[] | null> {
  try {
    const result = await open({
      multiple: options?.multiple ?? false,
      filters: options?.filters,
    });
    if (result) return result;
  } catch {
    // Fall through to browser picker.
  }

  return await new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = options?.multiple ?? false;
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      resolve(files.map((file) => file.name));
    };
    input.click();
    window.setTimeout(() => resolve(null), 500);
  });
}

export async function pickSaveLocation(defaultName: string): Promise<string | null> {
  try {
    return await save({ defaultPath: defaultName });
  } catch {
    return null;
  }
}

export async function readFileText(path: string): Promise<string> {
  return readTextFile(path);
}

export async function writeFileText(path: string, content: string): Promise<void> {
  await writeTextFile(path, content);
}

export async function saveTextWithDialog(defaultName: string, content: string, mimeType = 'text/plain'): Promise<boolean> {
  const path = await pickSaveLocation(defaultName);
  if (path) {
    await writeFileText(path, content);
    return true;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = defaultName;
  anchor.click();
  URL.revokeObjectURL(url);
  return false;
}
