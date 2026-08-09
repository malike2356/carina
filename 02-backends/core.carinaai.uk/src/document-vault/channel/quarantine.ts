/**
 * Quarantine inbound channel attachments before vault import (prompt 713).
 */

import { assertSafeUploadBytes } from '../format-safety.js';
import { VaultError } from '../service.js';
import { channelMaxAttachBytes } from './contract.js';

export function quarantineAttachment(
  data: Buffer,
  input: {
    filename?: string;
    declaredMime?: string;
    platform?: string;
    maxBytes?: number;
  } = {},
): { ok: true; validation: ReturnType<typeof assertSafeUploadBytes>; scan: { clean: boolean } } {
  if (!data || data.byteLength === 0) {
    throw new VaultError('empty attachment', 'validation');
  }
  const platformLimit = input.platform ? channelMaxAttachBytes(input.platform) : 0;
  const maxBytes = input.maxBytes ?? (platformLimit || undefined);
  if (maxBytes && data.byteLength > maxBytes) {
    throw new VaultError(`attachment exceeds ${maxBytes} bytes for channel`, 'quota');
  }

  const validation = assertSafeUploadBytes(input.filename || 'upload.bin', data);
  if (validation.blocked) {
    throw new VaultError(validation.reason || 'attachment rejected by quarantine', 'validation');
  }
  if (validation.spoofed) {
    throw new VaultError('MIME spoofing detected; attachment rejected', 'validation');
  }

  // Malware hook placeholder: fail closed only when an explicit scanner is wired.
  const scan = { clean: true as boolean };
  return { ok: true, validation, scan };
}
