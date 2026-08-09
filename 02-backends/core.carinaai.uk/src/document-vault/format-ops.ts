import { convertExportContent, convertImportUpload } from './format-convert.js';
import { loadFormatCapabilityMatrix } from './format-capabilities.js';
import { sanitizeVaultFileName } from './kinds.js';
import {
  DocumentVaultService,
  VaultError,
  type ActorContext,
} from './service.js';

export type VaultImportResult = {
  item: Awaited<ReturnType<DocumentVaultService['createItem']>>;
  jobId: string;
  warnings: Array<{ code: string; message: string; fidelity: string }>;
  converterVersion: string;
  originalPreserved: boolean;
};

export type VaultExportResult = {
  bytes: Buffer;
  mimeType: string;
  extension: string;
  warnings: Array<{ code: string; message: string; fidelity: string }>;
  converterVersion: string;
  sourceItemId: string;
  sourceRevision: number;
  artifactItemId?: string;
};

/** Provider-neutral format capability matrix for API/UI. */
export function getDocumentVaultFormatCapabilities() {
  return loadFormatCapabilityMatrix();
}

/**
 * Import an upload into the vault. Original bytes are preserved as a sibling
 * binary item when conversion is lossy/generated; editable content becomes the primary item.
 */
export async function importBytesIntoVault(
  vault: DocumentVaultService,
  input: {
    workspaceId: string;
    parentId?: string | null;
    filename: string;
    bytes: Buffer;
    actor?: ActorContext;
  },
): Promise<VaultImportResult> {
  const actor = input.actor ?? {};
  const job = vault.enqueueJob({
    workspaceId: input.workspaceId,
    kind: 'format.import',
    payload: { filename: input.filename, byteSize: input.bytes.byteLength },
  });
  vault.updateJob(input.workspaceId, job.id, { status: 'running' });

  const converted = await convertImportUpload({
    filename: input.filename,
    bytes: input.bytes,
  });
  if (!converted.ok) {
    vault.updateJob(input.workspaceId, job.id, {
      status: 'failed',
      lastError: converted.error,
    });
    throw new VaultError(converted.error, 'validation');
  }

  const baseName = sanitizeVaultFileName(input.filename.replace(/\.[^.]+$/, '') || 'Upload');
  const item = await vault.createItem(
    {
      workspaceId: input.workspaceId,
      parentId: input.parentId ?? null,
      kind: converted.vaultKind,
      name: `${baseName}.${converted.extension}`,
      content: converted.content,
    },
    actor,
  );

  let originalPreserved = false;
  if (converted.generated || converted.formatId === 'rich_document' || converted.formatId === 'rtf') {
    await vault.createItem(
      {
        workspaceId: input.workspaceId,
        parentId: input.parentId ?? null,
        kind: 'binary_upload',
        name: `${baseName}.original`,
        content: input.bytes,
      },
      actor,
    );
    originalPreserved = true;
  }

  vault.updateJob(input.workspaceId, job.id, { status: 'succeeded' });
  return {
    item,
    jobId: job.id,
    warnings: converted.warnings,
    converterVersion: converted.converterVersion,
    originalPreserved,
  };
}

export async function exportVaultItem(
  vault: DocumentVaultService,
  input: {
    workspaceId: string;
    itemId: string;
    targetFormat: string;
    persistArtifact?: boolean;
    actor?: ActorContext;
  },
): Promise<VaultExportResult> {
  const actor = input.actor ?? {};
  const item = vault.getItem(input.workspaceId, input.itemId);
  if (item.kind === 'folder') {
    throw new VaultError('Cannot export a folder', 'validation');
  }
  const job = vault.enqueueJob({
    workspaceId: input.workspaceId,
    kind: 'format.export',
    payload: { itemId: item.id, targetFormat: input.targetFormat, revision: item.currentRevision },
  });
  vault.updateJob(input.workspaceId, job.id, { status: 'running' });

  const content = await vault.readContent(input.workspaceId, item.id);
  const converted = await convertExportContent({
    vaultKind: item.kind,
    content,
    targetFormat: input.targetFormat,
    title: item.name,
  });
  if (!converted.ok) {
    vault.updateJob(input.workspaceId, job.id, {
      status: 'failed',
      lastError: converted.error,
    });
    throw new VaultError(converted.error, 'validation');
  }

  let artifactItemId: string | undefined;
  if (input.persistArtifact && converted.generated) {
    const artifact = await vault.createItem(
      {
        workspaceId: input.workspaceId,
        parentId: item.parentId,
        kind: converted.vaultKind,
        name: `${item.name.replace(/\.[^.]+$/, '')}.${converted.extension}`,
        content: converted.content,
      },
      actor,
    );
    artifactItemId = artifact.id;
  }

  vault.updateJob(input.workspaceId, job.id, { status: 'succeeded' });
  return {
    bytes: converted.content,
    mimeType: converted.mimeType,
    extension: converted.extension,
    warnings: converted.warnings,
    converterVersion: converted.converterVersion,
    sourceItemId: item.id,
    sourceRevision: item.currentRevision,
    artifactItemId,
  };
}

export async function generatePdfArtifact(
  vault: DocumentVaultService,
  input: {
    workspaceId: string;
    itemId: string;
    actor?: ActorContext;
  },
): Promise<VaultExportResult> {
  return exportVaultItem(vault, {
    workspaceId: input.workspaceId,
    itemId: input.itemId,
    targetFormat: 'pdf',
    persistArtifact: true,
    actor: input.actor,
  });
}
