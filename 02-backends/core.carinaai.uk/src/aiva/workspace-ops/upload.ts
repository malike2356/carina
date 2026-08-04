import { Buffer } from 'node:buffer';
import {
  DOC_CHAR_LIMIT,
  extractDocumentText,
  insertKnowledgeDocument,
  truncateDocumentText,
} from '../../workers/knowledge-base.js';
import { isFolderAllowedInOpsTree } from './browse.js';
import { resolveWorkerDriveToken } from './drive-client.js';
import { getBinding, listFolders } from './store.js';
import { pushDocumentToDrive } from './sync-engine.js';
import { isOpsCategory, type OpsCategory } from './types.js';

export type UploadOpsDocumentInput = {
  workspaceId: string;
  workerId: string;
  filename: string;
  title?: string;
  /** Base64 file bytes (no data: URL prefix). */
  data: string;
  category?: string;
  /** Optional Drive folder id inside the Ops tree (subdirectory). */
  parentFolderId?: string;
  /**
   * When true (default), document is enabled for persona / RAG learning
   * and counts toward the knowledge character budget.
   */
  enableForPersona?: boolean;
};

export type UploadOpsDocumentResult = {
  document: Awaited<ReturnType<typeof insertKnowledgeDocument>>;
  category: OpsCategory;
  parentFolderId: string;
  drivePushed: boolean;
  learnedByAiva: boolean;
};

function decodeBase64(data: string): Buffer {
  const raw = data.includes(',') ? data.split(',')[1]! : data;
  const cleaned = raw.replace(/\s/g, '');
  if (!cleaned) throw new Error('File data is empty');
  return Buffer.from(cleaned, 'base64');
}

/**
 * Upload a PDF/DOCX/TXT into the worker knowledge vault, push a Google Doc into
 * the Ops Drive pack (category folder or subdirectory), and optionally enable
 * persona RAG learning.
 */
export async function uploadOpsDocumentFromFile(
  input: UploadOpsDocumentInput,
): Promise<UploadOpsDocumentResult> {
  const binding = await getBinding(input.workspaceId, input.workerId);
  if (!binding?.rootFolderId) {
    throw new Error('Ops folder pack is not bootstrapped yet. Finish Drive setup first.');
  }

  const folders = await listFolders(binding.id);
  if (folders.length === 0) {
    throw new Error('Ops folder pack has no category folders. Refresh the folder pack.');
  }

  const categoryRaw = String(input.category ?? 'inbox').trim();
  const category: OpsCategory = isOpsCategory(categoryRaw) ? categoryRaw : 'inbox';
  const categoryFolder =
    folders.find((f) => f.category === category) ?? folders.find((f) => f.category === 'inbox');
  if (!categoryFolder) {
    throw new Error(`No Ops Drive folder for category "${category}"`);
  }

  let parentFolderId = input.parentFolderId?.trim() || categoryFolder.folderId;
  if (parentFolderId !== categoryFolder.folderId) {
    const accessToken = await resolveWorkerDriveToken(input.workspaceId, input.workerId);
    const allowed = await isFolderAllowedInOpsTree({
      accessToken,
      folderId: parentFolderId,
      rootFolderId: binding.rootFolderId,
      categoryFolderIds: folders.map((f) => f.folderId),
    });
    if (!allowed) {
      throw new Error('Upload folder is outside the Ops Drive tree');
    }
  }

  const filename = String(input.filename ?? '').trim() || 'document.txt';
  const buffer = decodeBase64(input.data);
  if (buffer.length === 0) throw new Error('Uploaded file is empty');
  if (buffer.length > 12 * 1024 * 1024) {
    throw new Error('File exceeds 12 MB limit');
  }

  const extracted = await extractDocumentText(filename, buffer);
  if (!extracted.trim()) {
    throw new Error('Could not extract text from this file');
  }

  const enableForPersona = input.enableForPersona !== false;
  const title = (input.title?.trim() || filename.replace(/\.[^.]+$/, '') || 'Uploaded document').slice(0, 200);
  const content = truncateDocumentText(
    extracted,
    enableForPersona ? DOC_CHAR_LIMIT : undefined,
  );

  const document = await insertKnowledgeDocument({
    workerId: input.workerId,
    workspaceId: input.workspaceId,
    title,
    content,
    enabled: enableForPersona,
    countTowardLimit: enableForPersona,
    maxChars: enableForPersona ? DOC_CHAR_LIMIT : undefined,
  });

  let drivePushed = false;
  try {
    await pushDocumentToDrive({
      binding,
      folders: folders.map((f) => ({ category: f.category as OpsCategory, folderId: f.folderId })),
      documentId: document.id,
      category,
      parentFolderId,
    });
    drivePushed = true;
  } catch (err) {
    console.warn(
      '[workspace-ops] upload Drive push failed:',
      err instanceof Error ? err.message : String(err),
    );
  }

  return {
    document,
    category,
    parentFolderId,
    drivePushed,
    learnedByAiva: enableForPersona,
  };
}
