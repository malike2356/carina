/** Metadata for Gmail (or other) email attachments stored on email_messages. */
export type EmailAttachmentMeta = {
  /** Gmail attachment id, or `inline:` prefix when bytes were embedded in the message payload. */
  id: string;
  filename: string;
  mimeType: string;
  size: number;
};

function headerValue(
  headers: Array<{ name?: string; value?: string }> | undefined,
  name: string,
): string {
  if (!Array.isArray(headers)) return '';
  const want = name.toLowerCase();
  for (const item of headers) {
    if (String(item?.name ?? '').trim().toLowerCase() === want) {
      return String(item?.value ?? '').trim();
    }
  }
  return '';
}

function isMultipart(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('multipart/');
}

function isBodyTextPart(mimeType: string, filename: string, disposition: string): boolean {
  const mime = mimeType.toLowerCase();
  if (disposition.includes('attachment')) return false;
  if (filename) return false;
  return mime === 'text/plain' || mime === 'text/html' || mime === 'text/csv';
}

/**
 * Walk a Gmail message payload and collect real file attachments.
 * Skips multipart containers and plain body parts.
 */
export function extractGmailAttachments(msg: unknown): EmailAttachmentMeta[] {
  if (!msg || typeof msg !== 'object') return [];
  const payload = (msg as { payload?: unknown }).payload;
  const out: EmailAttachmentMeta[] = [];
  const seen = new Set<string>();

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const obj = node as {
      mimeType?: string;
      filename?: string;
      headers?: Array<{ name?: string; value?: string }>;
      body?: { attachmentId?: string; size?: number; data?: string };
      parts?: unknown[];
    };

    const mimeType = String(obj.mimeType ?? 'application/octet-stream').trim() || 'application/octet-stream';
    if (isMultipart(mimeType)) {
      if (Array.isArray(obj.parts)) {
        for (const part of obj.parts) walk(part);
      }
      return;
    }

    const filename = String(obj.filename ?? '').trim();
    const disposition = headerValue(obj.headers, 'content-disposition').toLowerCase();
    const attachmentId = String(obj.body?.attachmentId ?? '').trim();
    const hasInlineData = Boolean(obj.body?.data);

    if (isBodyTextPart(mimeType, filename, disposition)) {
      return;
    }

    const looksAttached =
      Boolean(filename)
      || disposition.includes('attachment')
      || Boolean(attachmentId);

    if (!looksAttached) return;
    if (!attachmentId && !hasInlineData) return;

    const safeName = filename || `attachment-${out.length + 1}`;
    const size = Number(obj.body?.size ?? 0) || 0;
    const id = attachmentId || `inline:${safeName}:${size || String(obj.body?.data ?? '').length}`;
    if (seen.has(id)) return;
    seen.add(id);

    out.push({
      id,
      filename: safeName,
      mimeType,
      size,
    });
  };

  walk(payload);
  return out;
}
