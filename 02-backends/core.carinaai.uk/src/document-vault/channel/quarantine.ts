/**
 * Quarantine inbound channel attachments before vault import (prompt 713/714).
 */

import { assertSafeUploadBytes } from '../format-safety.js';
import { VaultError } from '../errors.js';
import { scanBytesForMalware } from '../security/malware.js';
import { channelMaxAttachBytes } from './contract.js';

export async function quarantineAttachment(
  data: Buffer,
  input: {
    filename?: string;
    declaredMime?: string;
    platform?: string;
    maxBytes?: number;
  } = {},
): Promise<{ ok: true; validation: ReturnType<typeof assertSafeUploadBytes>; scan: { clean: boolean; engine?: string } }> {
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

  const scan = await scanBytesForMalware(data, { filename: input.filename });
  if (!scan.clean) {
    throw new VaultError(scan.detail || 'malware detected', 'malware_detected');
  }
  return { ok: true, validation, scan: { clean: true, engine: scan.engine } };
}
