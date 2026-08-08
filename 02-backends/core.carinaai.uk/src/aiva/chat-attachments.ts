/** Save Aiva chat uploads to a workspace-scoped disk path for analysis and CRM import tools. */

import { mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CARINA_DATA_DIR } from '../config/paths.js';
import {
  AIVA_CHAT_ATTACHMENT_EXTENSIONS,
  AIVA_CHAT_ATTACHMENT_MAX_BYTES,
} from './chat-attachment-limits.js';

const ALLOWED_EXTENSIONS = new Set<string>(AIVA_CHAT_ATTACHMENT_EXTENSIONS);

export type ChatAttachmentSaved = {
  absolutePath: string;
  filename: string;
  bytes: number;
  extension: string;
};

function sanitizeFilename(name: string): string {
  const base = basename(String(name || 'upload').trim() || 'upload')
    .replace(/[^\w.\-()+ ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120);
  return base || 'upload';
}

export function isAllowedChatAttachmentFilename(filename: string): boolean {
  return ALLOWED_EXTENSIONS.has(extname(filename).toLowerCase());
}

export function chatAttachmentMaxMb(): number {
  return Math.floor(AIVA_CHAT_ATTACHMENT_MAX_BYTES / (1024 * 1024));
}

export async function saveAivaChatAttachment(input: {
  workspaceId: string;
  workerId: string;
  filename: string;
  dataBase64: string;
}): Promise<ChatAttachmentSaved> {
  const filename = sanitizeFilename(input.filename);
  const extension = extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(
      `Unsupported file type "${extension || '(none)'}". Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
    );
  }

  const raw = String(input.dataBase64 ?? '').replace(/^data:[^;]+;base64,/, '').trim();
  if (!raw) throw new Error('File data is required');
  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length) throw new Error('File data is empty');
  if (buffer.length > AIVA_CHAT_ATTACHMENT_MAX_BYTES) {
    throw new Error(`File must be ${chatAttachmentMaxMb()}MB or smaller`);
  }

  const dir = join(
    CARINA_DATA_DIR,
    'aiva-uploads',
    input.workspaceId,
    input.workerId,
  );
  await mkdir(dir, { recursive: true });
  const stamped = `${Date.now()}-${randomUUID().slice(0, 8)}-${filename}`;
  const absolutePath = join(dir, stamped);
  await writeFile(absolutePath, buffer);

  return {
    absolutePath,
    filename,
    bytes: buffer.length,
    extension,
  };
}

export function buildAttachmentPromptBlock(
  attachments: Array<{ absolutePath: string; filename: string }>,
): string {
  if (!attachments.length) return '';
  const lines = [
    'Attached file(s) for this turn (local paths on the Carina host):',
    ...attachments.map(
      (item, index) =>
        `${index + 1}. ${item.filename} -> ${item.absolutePath}`,
    ),
    '',
    'Use Keprix/Core tools as needed:',
    '- SPSS (.sav): sav_read / stats_* tools.',
    '- CSV/TSV/XLSX lead sheets: parse then outreach-discovery-ingest-leads or outreach-leads-import; confirm with the owner before bulk import.',
    '- PDF/images: summarise with available document/vision tools; do not invent leads from unreadable scans.',
    'Do not ask the user for a file path you already have. Soft Wall still applies to any outbound contact derived from the file.',
  ];
  return lines.join('\n');
}
