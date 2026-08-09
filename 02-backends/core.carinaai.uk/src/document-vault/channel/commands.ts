/**
 * /vault channel commands and natural-language helpers (prompt 713).
 */

import { DocumentVaultService, VaultError } from '../service.js';
import { getOrCreateLocalVaultService } from '../runtime.js';
import {
  bindChannelIdentity,
  ensureWorkerChannelBinding,
  resolveChannelBinding,
  revokeChannelBinding,
  type ChannelVaultContext,
} from './binding.js';
import { type ChannelAttachment } from './contract.js';
import { planExportDelivery } from './export-delivery.js';
import { importChannelAttachment } from './import-pipeline.js';

export const VAULT_SLASH_USAGE =
  'Usage: /vault status | list | search <q> | mkdir <name> | create <name> [text] | '
  + 'rename <id> <name> | move <id> [parent] | update <id> <text> | export <id> [format] | '
  + 'sync | import [--parent id] | bind | revoke | help';

export type VaultCommandResult = {
  ok: boolean;
  message: string;
  data?: Record<string, unknown>;
  /** When set, channel adapter should send this as a document attachment. */
  attach?: {
    filename: string;
    mime: string;
    contentBase64: string;
  };
};

export function parseVaultNl(text: string): { sub: string; args?: string[] } | null {
  const raw = (text || '').trim();
  const lower = raw.toLowerCase();
  if (lower === 'list vault' || lower === 'show vault' || lower === 'vault list') {
    return { sub: 'list' };
  }
  if (lower.startsWith('search vault ') || lower.startsWith('find in vault ')) {
    const q = raw.split(/\s+/).slice(2).join(' ').trim();
    return q ? { sub: 'search', args: [q] } : null;
  }
  if (lower.startsWith('save to vault') || lower.startsWith('import to vault')) {
    return { sub: 'import' };
  }
  if (lower.startsWith('summarize vault') || lower === 'summarize vault') {
    return { sub: 'summarize' };
  }
  return null;
}

export function looksLikeVaultImportCaption(text: string): boolean {
  const lower = String(text || '').trim().toLowerCase();
  if (!lower) return false;
  if (lower.startsWith('/vault')) return lower.includes('import') || lower === '/vault';
  return (
    lower.includes('save this to vault')
    || lower.includes('save to vault')
    || lower.includes('import to vault')
    || lower.includes('/vault import')
  );
}

function compactLine(item: Record<string, unknown>): string {
  return `- ${item.name} (${item.kind}) id=${item.id} rev=${item.currentRevision ?? '?'}`;
}

export async function handleVaultChannelCommand(input: {
  text: string;
  platform: string;
  channelUserId: string;
  workspaceId?: string | null;
  workerId?: string | null;
  role?: string;
  attachment?: ChannelAttachment | null;
  service?: DocumentVaultService;
}): Promise<VaultCommandResult> {
  const svc = input.service ?? getOrCreateLocalVaultService();
  let parts = String(input.text || '').trim().split(/\s+/).filter(Boolean);
  if (parts[0]?.toLowerCase().replace(/^\/+/, '').startsWith('vault')) {
    parts = parts.slice(1);
  }

  if (parts.length === 0) {
    const nl = parseVaultNl(input.text);
    if (nl) parts = [nl.sub, ...(nl.args ?? [])];
    else return { ok: true, message: VAULT_SLASH_USAGE };
  }

  const sub = String(parts[0] || '').toLowerCase().replace(/^\/+/, '');
  const rest = parts.slice(1);

  if (sub === 'help' || sub === '?') {
    return { ok: true, message: VAULT_SLASH_USAGE };
  }

  if (sub === 'bind') {
    const ws = String(rest[0] || input.workspaceId || '').trim();
    if (!ws) return { ok: false, message: 'Usage: /vault bind <workspace_id> (or use a worker bot session)' };
    try {
      const row = bindChannelIdentity({
        workspaceId: ws,
        platform: input.platform,
        channelUserId: input.channelUserId,
        actorId: input.workerId || input.channelUserId,
        service: svc,
      });
      return {
        ok: true,
        message: `Bound ${input.platform}:${input.channelUserId} -> workspace ${row.workspaceId}`,
        data: row,
      };
    } catch (err) {
      return fail(err);
    }
  }

  if (sub === 'revoke') {
    try {
      revokeChannelBinding(input.platform, input.channelUserId, { service: svc });
      return { ok: true, message: 'Channel Document Vault binding revoked.' };
    } catch (err) {
      return fail(err);
    }
  }

  let ctx: ChannelVaultContext;
  try {
    if (input.workspaceId && input.channelUserId) {
      ctx = ensureWorkerChannelBinding({
        workspaceId: input.workspaceId,
        platform: input.platform,
        channelUserId: input.channelUserId,
        actorId: input.workerId || input.channelUserId,
        service: svc,
      });
    } else {
      ctx = resolveChannelBinding(input.platform, input.channelUserId, { service: svc });
    }
  } catch (err) {
    return fail(err, ' Use /vault bind <workspace_id> or message a linked Aiva worker bot.');
  }

  try {
    if (sub === 'status') {
      return {
        ok: true,
        message:
          `Document Vault channel ok. workspace=${ctx.workspaceId} actor=${ctx.actorId} channel=${ctx.channel}`,
        data: { ...ctx },
      };
    }
    if (sub === 'list' || sub === 'summarize') {
      const listed = svc.listItems(ctx.workspaceId, { limit: 20 });
      const lines = listed.items.map((i) => compactLine(i as unknown as Record<string, unknown>));
      return {
        ok: true,
        message: `Vault ${sub} (${listed.total} items):\n${lines.join('\n') || '(empty)'}`,
      };
    }
    if (sub === 'search') {
      const q = rest.join(' ').trim();
      if (!q) return { ok: false, message: 'Usage: /vault search <query>' };
      const listed = svc.searchItems(ctx.workspaceId, q, { limit: 20 });
      const lines = listed.items.map((i) => compactLine(i as unknown as Record<string, unknown>));
      return {
        ok: true,
        message: `Search \`${q}\` (${listed.total}):\n${lines.join('\n') || '(no matches)'}`,
      };
    }
    if (sub === 'mkdir' || sub === 'folder') {
      const name = rest.join(' ').trim();
      if (!name) return { ok: false, message: 'Usage: /vault mkdir <name>' };
      const item = await svc.createItem(
        { workspaceId: ctx.workspaceId, kind: 'folder', name },
        { actorId: ctx.actorId },
      );
      return { ok: true, message: `Created folder id=${item.id} name=${item.name}` };
    }
    if (sub === 'create' || sub === 'new' || sub === 'write') {
      if (!rest.length) return { ok: false, message: 'Usage: /vault create <name> [content]' };
      const name = rest[0]!;
      const content = rest.slice(1).join(' ');
      const item = await svc.createItem(
        {
          workspaceId: ctx.workspaceId,
          kind: 'markdown',
          name,
          content,
        },
        { actorId: ctx.actorId },
      );
      return { ok: true, message: `Created file id=${item.id} name=${item.name}` };
    }
    if (sub === 'rename') {
      if (rest.length < 2) return { ok: false, message: 'Usage: /vault rename <item_id> <name>' };
      const item = svc.rename(ctx.workspaceId, rest[0]!, rest.slice(1).join(' '), {
        actorId: ctx.actorId,
      });
      return { ok: true, message: `Renamed id=${item.id} name=${item.name}` };
    }
    if (sub === 'move') {
      if (!rest.length) return { ok: false, message: 'Usage: /vault move <item_id> [parent_id]' };
      const parentId = rest[1] ? rest[1] : null;
      const item = svc.move(ctx.workspaceId, rest[0]!, parentId, { actorId: ctx.actorId });
      return { ok: true, message: `Moved id=${item.id} parent=${item.parentId ?? 'root'}` };
    }
    if (sub === 'update') {
      if (rest.length < 2) return { ok: false, message: 'Usage: /vault update <item_id> <content>' };
      const item = await svc.updateContent(ctx.workspaceId, rest[0]!, rest.slice(1).join(' '), {
        actor: { actorId: ctx.actorId },
        mode: 'replace',
      });
      return { ok: true, message: `Updated id=${item.id} rev=${item.currentRevision}` };
    }
    if (sub === 'export') {
      if (!rest.length) return { ok: false, message: 'Usage: /vault export <item_id> [format]' };
      const planned = await planExportDelivery(ctx, rest[0]!, {
        format: rest[1] || 'markdown',
        service: svc,
      });
      if (planned.blocked) {
        return {
          ok: false,
          message: 'Soft Wall required for classified export. Ask the owner to approve, then retry.',
          data: planned,
        };
      }
      if (planned.mode === 'attach' && typeof planned.contentBase64 === 'string') {
        return {
          ok: true,
          message: String(planned.receipt || 'Export ready'),
          data: planned,
          attach: {
            filename: String(planned.filename || 'export.bin'),
            mime: String(planned.mime || 'application/octet-stream'),
            contentBase64: planned.contentBase64,
          },
        };
      }
      return {
        ok: true,
        message: `${planned.receipt}\n${planned.downloadUrl}`,
        data: planned,
      };
    }
    if (sub === 'sync') {
      return {
        ok: true,
        message:
          'Use vault-sync-status / vault-sync-request from Work chat, or open /documents?tab=drive for Google Drive sync status.',
      };
    }
    if (sub === 'import') {
      const att = input.attachment;
      if (!att?.data?.byteLength) {
        return {
          ok: false,
          message: 'No attachment on this message. Send a file with caption /vault import',
        };
      }
      let parent: string | null | undefined;
      for (let i = 0; i < rest.length; i += 1) {
        if ((rest[i] === '--parent' || rest[i] === '-p') && rest[i + 1]) {
          parent = rest[i + 1];
        }
      }
      const receipt = await importChannelAttachment(
        {
          ...att,
          platform: input.platform,
          channelUserId: input.channelUserId,
        },
        { parentId: parent, service: svc },
      );
      return {
        ok: receipt.ok,
        message: receipt.message,
        data: {
          itemId: receipt.itemId,
          jobId: receipt.jobId,
          deduplicated: receipt.deduplicated,
          ...(receipt.data ?? {}),
        },
      };
    }
    return { ok: false, message: `Unknown /vault subcommand: ${sub}\n${VAULT_SLASH_USAGE}` };
  } catch (err) {
    return fail(err);
  }
}

function fail(err: unknown, hint = ''): VaultCommandResult {
  if (err instanceof VaultError) {
    return { ok: false, message: `${err.code}: ${err.message}${hint}` };
  }
  return { ok: false, message: err instanceof Error ? err.message : String(err) };
}
