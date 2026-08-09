import { isUnsupportedExtension, loadFormatCapabilityMatrix } from './format-capabilities.js';

export type SniffResult = {
  extension: string;
  mimeType: string;
  formatId: string | null;
  spoofed: boolean;
  blocked: boolean;
  reason?: string;
};

function extFromName(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  return base.slice(idx + 1).toLowerCase();
}

function hasZipSignature(bytes: Buffer): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function sniffMagic(bytes: Buffer): { mimeType: string; extension: string } | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('utf8') === '%PDF-') {
    return { mimeType: 'application/pdf', extension: 'pdf' };
  }
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString('ascii') === 'GIF87a') {
    return { mimeType: 'image/gif', extension: 'gif' };
  }
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString('ascii') === 'GIF89a') {
    return { mimeType: 'image/gif', extension: 'gif' };
  }
  if (bytes.length >= 12
    && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  if (hasZipSignature(bytes)) {
    // OOXML and ODF are zip containers; distinguish later by claimed ext.
    return { mimeType: 'application/zip', extension: 'zip' };
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1') {
    // Legacy OLE CFB (xls/doc); never execute macros.
    return { mimeType: 'application/x-ole-storage', extension: 'ole' };
  }
  return null;
}

function looksLikeText(bytes: Buffer): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 2048));
  let odd = 0;
  for (const b of sample) {
    if (b === 0) return false;
    if (b < 7 || (b > 13 && b < 32)) odd += 1;
  }
  return odd / Math.max(sample.length, 1) < 0.05;
}

/** Lightweight zip bomb / nested archive heuristic (no full inflate). */
export function detectZipBomb(bytes: Buffer): string | null {
  if (!hasZipSignature(bytes)) return null;
  if (bytes.byteLength > 40 * 1024 * 1024) {
    return 'Archive exceeds 40MB compressed size limit';
  }
  // Count local file headers (PK\x03\x04) and reject nested zips by member name.
  let members = 0;
  let offset = 0;
  while (offset + 30 < bytes.length && members < 20_000) {
    if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b
      && bytes[offset + 2] === 0x03 && bytes[offset + 3] === 0x04) {
      const nameLen = bytes.readUInt16LE(offset + 26);
      const extraLen = bytes.readUInt16LE(offset + 28);
      const compSize = bytes.readUInt32LE(offset + 18);
      const uncompSize = bytes.readUInt32LE(offset + 22);
      const nameStart = offset + 30;
      const nameEnd = nameStart + nameLen;
      if (nameEnd > bytes.length) break;
      const name = bytes.subarray(nameStart, nameEnd).toString('utf8').toLowerCase();
      if (name.endsWith('.zip') || name.endsWith('.7z') || name.endsWith('.rar')) {
        return 'Nested archive members are blocked';
      }
      if (uncompSize > 0 && compSize > 0 && uncompSize / Math.max(compSize, 1) > 200) {
        return 'Archive compression ratio exceeds safe limit';
      }
      if (uncompSize > 200 * 1024 * 1024) {
        return 'Archive member uncompressed size exceeds 200MB';
      }
      members += 1;
      offset = nameEnd + extraLen + compSize;
      continue;
    }
    offset += 1;
  }
  if (members > 5_000) return 'Archive member count exceeds safe limit';
  return null;
}

/** Reject nested archives and executable payloads up front. */
export function assertSafeUploadBytes(filename: string, bytes: Buffer): SniffResult {
  const matrix = loadFormatCapabilityMatrix();
  if (bytes.byteLength > matrix.limits.maxUploadBytes) {
    return {
      extension: extFromName(filename),
      mimeType: 'application/octet-stream',
      formatId: null,
      spoofed: false,
      blocked: true,
      reason: `Upload exceeds ${matrix.limits.maxUploadBytes} bytes`,
    };
  }

  const claimedExt = extFromName(filename);
  const unsupported = isUnsupportedExtension(claimedExt);
  if (unsupported.blocked) {
    return {
      extension: claimedExt,
      mimeType: 'application/octet-stream',
      formatId: null,
      spoofed: false,
      blocked: true,
      reason: unsupported.reason,
    };
  }

  if (hasZipSignature(bytes)) {
    // Archive bomb defense: reject oversized zip containers and nested zip members.
    const bomb = detectZipBomb(bytes);
    if (bomb) {
      return {
        extension: claimedExt || 'zip',
        mimeType: 'application/zip',
        formatId: null,
        spoofed: false,
        blocked: true,
        reason: bomb,
      };
    }
  }

  const magic = sniffMagic(bytes);
  let extension = claimedExt;
  let mimeType = 'application/octet-stream';
  let spoofed = false;

  if (magic) {
    mimeType = magic.mimeType;
    if (magic.extension === 'zip') {
      // Allow only known office containers by claimed extension.
      const office = new Set(['docx', 'xlsx', 'pptx', 'odt', 'ods']);
      if (!office.has(claimedExt)) {
        return {
          extension: claimedExt || 'zip',
          mimeType: 'application/zip',
          formatId: null,
          spoofed: Boolean(claimedExt && claimedExt !== 'zip'),
          blocked: true,
          reason: 'Zip/archive uploads are blocked unless they are a known office document type',
        };
      }
      extension = claimedExt;
      mimeType =
        claimedExt === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : claimedExt === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : claimedExt === 'pptx'
              ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
              : claimedExt === 'ods'
                ? 'application/vnd.oasis.opendocument.spreadsheet'
                : 'application/vnd.oasis.opendocument.text';
    } else if (magic.extension === 'ole') {
      if (claimedExt === 'xls' || claimedExt === 'doc') {
        extension = claimedExt;
      } else {
        return {
          extension: claimedExt || 'ole',
          mimeType: magic.mimeType,
          formatId: null,
          spoofed: true,
          blocked: true,
          reason: 'Legacy OLE compound files are only accepted as .xls/.doc with macros never executed',
        };
      }
    } else if (claimedExt && claimedExt !== magic.extension
      && !(claimedExt === 'jpeg' && magic.extension === 'jpg')
      && !(claimedExt === 'jpg' && magic.extension === 'jpeg')) {
      // e.g. .txt that is actually PDF
      spoofed = true;
      extension = magic.extension;
      mimeType = magic.mimeType;
    } else {
      extension = magic.extension;
      mimeType = magic.mimeType;
    }
  } else if (looksLikeText(bytes)) {
    mimeType = claimedExt === 'html' || claimedExt === 'htm'
      ? 'text/html'
      : claimedExt === 'json'
        ? 'application/json'
        : claimedExt === 'csv'
          ? 'text/csv'
          : claimedExt === 'md' || claimedExt === 'markdown'
            ? 'text/markdown'
            : 'text/plain';
    extension = claimedExt || 'txt';
  } else if (claimedExt) {
    return {
      extension: claimedExt,
      mimeType: 'application/octet-stream',
      formatId: null,
      spoofed: false,
      blocked: true,
      reason: `Unrecognized binary content for extension .${claimedExt}`,
    };
  }

  // PDF claimed but not PDF magic
  if ((claimedExt === 'pdf' || extension === 'pdf') && !(magic && magic.extension === 'pdf')) {
    return {
      extension: claimedExt,
      mimeType: 'application/octet-stream',
      formatId: null,
      spoofed: true,
      blocked: true,
      reason: 'Claimed PDF does not match PDF magic bytes',
    };
  }

  const cap = matrix.formats.find(
    (f) => f.extensions.includes(extension) || f.mimeTypes.includes(mimeType),
  );

  if (!cap) {
    return {
      extension,
      mimeType,
      formatId: null,
      spoofed,
      blocked: true,
      reason: `No Document Vault format capability for .${extension || 'unknown'}`,
    };
  }

  if (!cap.import) {
    return {
      extension,
      mimeType,
      formatId: cap.id,
      spoofed,
      blocked: true,
      reason: `Import not supported for ${cap.id}`,
    };
  }

  return {
    extension,
    mimeType,
    formatId: cap.id,
    spoofed,
    blocked: false,
  };
}

export function sanitizeHtmlFragment(input: string): string {
  // Deterministic, dependency-light sanitizer: strip scripts/styles/events.
  let out = input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
  out = out.replace(/<\/?(iframe|object|embed|link|meta)[^>]*>/gi, '');
  return out;
}

export function stripRtfToText(input: string): string {
  return input
    .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
