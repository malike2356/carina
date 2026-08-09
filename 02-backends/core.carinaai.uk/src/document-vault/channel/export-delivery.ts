/**
 * Channel export delivery: attach in-channel or short-lived authenticated URL (prompt 713).
 */

import { createHash, randomBytes } from 'node:crypto';
import { exportVaultItem } from '../format-ops.js';
import { DocumentVaultService, VaultError } from '../service.js';
import { assertVaultGateAllowed, gateVaultAction, redactAuditPayload } from '../soft-wall.js';
import { getOrCreateLocalVaultService } from '../runtime.js';
import type { ChannelVaultContext } from './binding.js';
import { channelMaxAttachBytes } from './contract.js';

const CLASSIFIED = new Set(['secret', 'restricted', 'confidential']);

export async function planExportDelivery(
  ctx: ChannelVaultContext,
  itemId: string,
  options: {
    format?: string;
    approvalToken?: string | null;
    service?: DocumentVaultService;
    publicBaseUrl?: string | null;
  } = {},
): Promise<Record<string, unknown>> {
  const svc = options.service ?? getOrCreateLocalVaultService();
  const item = svc.getItem(ctx.workspaceId, itemId);
  const classification = String(item.classification || 'internal').toLowerCase();
  const fmt = options.format || 'markdown';

  if (CLASSIFIED.has(classification)) {
    const gate = gateVaultAction({
      kind: 'document_vault.classified_export',
      subject: `Channel export classified item ${itemId}`,
      payload: redactAuditPayload({ itemId, format: fmt, channel: ctx.channel }),
      approvalToken: options.approvalToken,
    });
    if (!gate.allowed) {
      return {
        ok: false,
        blocked: true,
        errorCode: 'approval_required',
        approval: gate,
      };
    }
    assertVaultGateAllowed(gate);
  }

  const exported = await exportVaultItem(svc, {
    workspaceId: ctx.workspaceId,
    itemId,
    targetFormat: fmt,
    actor: { actorId: ctx.actorId },
  });
  const raw = exported.bytes;
  const nbytes = raw.byteLength;
  const limit = channelMaxAttachBytes(ctx.channel);

  if (limit && nbytes <= limit && !CLASSIFIED.has(classification)) {
    return {
      ok: true,
      mode: 'attach',
      itemId,
      byteSize: nbytes,
      mime: exported.mimeType,
      filename: `${item.name}.${exported.extension}`,
      contentBase64: raw.toString('base64'),
      receipt: `Exported item_id=${itemId} (${nbytes} bytes) as channel attachment`,
    };
  }

  const token = randomBytes(24).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expires = new Date(Date.now() + 30 * 60_000).toISOString();
  svc.createDeliveryToken({
    workspaceId: ctx.workspaceId,
    itemId,
    tokenHash,
    expiresAt: expires,
    createdBy: ctx.actorId,
  });
  const base = (
    options.publicBaseUrl
    || process.env.CARINA_PUBLIC_BASE_URL
    || process.env.AIVA_APP_PUBLIC_URL
    || ''
  ).replace(/\/$/, '');
  const url = base
    ? `${base}/api/document-vault/delivery/${token}`
    : `/api/document-vault/delivery/${token}`;
  return {
    ok: true,
    mode: 'url',
    itemId,
    byteSize: nbytes,
    expiresAt: expires,
    downloadUrl: url,
    receipt:
      `Export exceeds channel attach limit or is classified; short-lived URL issued for item_id=${itemId}`,
  };
}

export function consumeDeliveryToken(
  token: string,
  options: { service?: DocumentVaultService } = {},
): { workspaceId: string; itemId: string } {
  const tokenHash = createHash('sha256').update(String(token || '')).digest('hex');
  const svc = options.service ?? getOrCreateLocalVaultService();
  const row = svc.consumeDeliveryToken(tokenHash);
  if (!row) {
    throw new VaultError('delivery token invalid, expired, or already used', 'forbidden');
  }
  return row;
}
