/**
 * Canonical channel attachment import pipeline (prompt 713).
 */

import { importBytesIntoVault } from '../format-ops.js';
import { DocumentVaultService, VaultError } from '../service.js';
import { getOrCreateLocalVaultService } from '../runtime.js';
import { resolveChannelBinding } from './binding.js';
import {
  type ChannelAttachment,
  type ChannelReceipt,
  channelSupportsFiles,
} from './contract.js';
import { quarantineAttachment } from './quarantine.js';

function store(svc?: DocumentVaultService): DocumentVaultService {
  return svc ?? getOrCreateLocalVaultService();
}

function destinationAmbiguous(svc: DocumentVaultService, workspaceId: string): boolean {
  const listed = svc.listItems(workspaceId, { parentId: null, limit: 20 });
  const folders = listed.items.filter((row) => row.kind === 'folder');
  return folders.length > 1;
}

export async function importChannelAttachment(
  attachment: ChannelAttachment,
  options: {
    claimedWorkspaceId?: string | null;
    parentId?: string | null;
    service?: DocumentVaultService;
  } = {},
): Promise<ChannelReceipt> {
  const platform = String(attachment.platform || '').trim().toLowerCase();
  if (!channelSupportsFiles(platform)) {
    throw new VaultError(`${platform} does not support file vault import`, 'unsupported_channel');
  }

  const ctx = resolveChannelBinding(platform, attachment.channelUserId, {
    claimedWorkspaceId: options.claimedWorkspaceId,
    service: options.service,
  });

  const eventId = String(attachment.eventId || '').trim();
  if (!eventId) {
    throw new VaultError('event_id required for idempotent channel import', 'validation');
  }

  const svc = store(options.service);
  const prior = svc.getChannelEvent(ctx.workspaceId, platform, eventId, 'import');
  if (prior) {
    return {
      ok: true,
      message: `Already imported (deduplicated). item_id=${prior.resultItemId}`,
      itemId: prior.resultItemId as string | null,
      deduplicated: true,
      data: (prior.result as Record<string, unknown>) || {},
    };
  }

  const dest = options.parentId !== undefined ? options.parentId : attachment.parentId;
  if (dest == null && destinationAmbiguous(svc, ctx.workspaceId)) {
    throw new VaultError(
      'destination folder is ambiguous; pass parentId or /vault import --parent <id>',
      'destination_required',
    );
  }

  const quarantine = await quarantineAttachment(attachment.data, {
    filename: attachment.filename,
    declaredMime: attachment.declaredMime,
    platform,
  });

  const imported = await importBytesIntoVault(svc, {
    workspaceId: ctx.workspaceId,
    filename: attachment.filename || 'upload.bin',
    bytes: attachment.data,
    parentId: dest ?? null,
    actor: { actorId: ctx.actorId },
  });

  const itemId = imported.item.id;
  svc.recordChannelEvent({
    workspaceId: ctx.workspaceId,
    platform,
    eventId,
    action: 'import',
    resultItemId: itemId,
    result: {
      filename: attachment.filename,
      quarantine: {
        spoofed: quarantine.validation.spoofed,
        mimeType: quarantine.validation.mimeType,
      },
      jobId: imported.jobId,
      itemId,
      path: imported.item.name,
    },
  });

  return {
    ok: true,
    message: `Imported into Document Vault. item_id=${itemId} path=${imported.item.name}`,
    itemId,
    jobId: imported.jobId,
    data: {
      item: imported.item,
      workspaceId: ctx.workspaceId,
      warnings: imported.warnings,
    },
  };
}
