import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.basename(path.dirname(__dirname)) === 'dist'
  ? path.join(__dirname, '..', '..')
  : path.join(__dirname, '..');
const DATA_FILE = path.join(appRoot, 'data', 'channel-notes.json');

export type ChannelNote = {
  channel: string;
  notes: string;
  owner: string;
  priority: 'low' | 'normal' | 'high';
  updatedAt: string;
};

async function ensureFile(): Promise<void> {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, '{}', 'utf-8');
  }
}

export async function loadChannelNotes(): Promise<Record<string, ChannelNote>> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as Record<string, ChannelNote>;
  return parsed && typeof parsed === 'object' ? parsed : {};
}

export async function upsertChannelNote(input: {
  channel: string;
  notes: string;
  owner: string;
  priority: 'low' | 'normal' | 'high';
}): Promise<ChannelNote> {
  const all = await loadChannelNotes();
  const channel = input.channel.trim().toLowerCase();
  const note: ChannelNote = {
    channel,
    notes: input.notes.trim(),
    owner: input.owner.trim(),
    priority: input.priority,
    updatedAt: new Date().toISOString(),
  };
  all[channel] = note;
  await fs.writeFile(DATA_FILE, JSON.stringify(all, null, 2), 'utf-8');
  return note;
}

export async function deleteChannelNote(channel: string): Promise<boolean> {
  const all = await loadChannelNotes();
  const key = channel.trim().toLowerCase();
  if (!all[key]) return false;
  delete all[key];
  await fs.writeFile(DATA_FILE, JSON.stringify(all, null, 2), 'utf-8');
  return true;
}
