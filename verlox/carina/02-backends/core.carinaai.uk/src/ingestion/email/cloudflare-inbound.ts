import {
  processMailgunInbound,
  type ProcessMailgunResult,
} from './mailgun-inbound.js';

type HeaderValue = string | string[] | undefined;

export type CloudflareInboundFields = {
  recipient: string;
  sender: string;
  from: string;
  subject: string;
  bodyPlain: string;
  bodyHtml: string;
  messageId: string;
  attachmentCount: number;
};

function field(body: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return '';
}

function nestedField(body: Record<string, unknown>, objectKey: string, ...keys: string[]): string {
  const value = body[objectKey];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  return field(value as Record<string, unknown>, ...keys);
}

function decodeMimePart(value: string, transferEncoding: string): string {
  const encoding = transferEncoding.trim().toLowerCase();
  if (encoding === 'base64') {
    try {
      return Buffer.from(value.replace(/\s+/g, ''), 'base64').toString('utf8').trim();
    } catch {
      return value.trim();
    }
  }
  if (encoding === 'quoted-printable') {
    return value
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-F]{2})/gi, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)))
      .trim();
  }
  return value.trim();
}

function mimeHeader(headers: string, name: string): string {
  const unfolded = headers.replace(/\r?\n[ \t]+/g, ' ');
  const match = unfolded.match(new RegExp(`^${name}:\\s*(.+)$`, 'im'));
  return match?.[1]?.trim() ?? '';
}

/** Extract the readable text part when a Cloudflare Worker forwards raw RFC 822 source. */
export function extractReadableMimeBody(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n');
  const separator = normalized.indexOf('\n\n');
  if (separator < 0) return value.trim();

  const headers = normalized.slice(0, separator);
  const content = normalized.slice(separator + 2);
  const contentType = mimeHeader(headers, 'content-type');
  const looksLikeMessage = /^(received|return-path|arc-seal|from|mime-version):/im.test(headers);
  if (!looksLikeMessage) return value.trim();

  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  const boundaryValue = boundary?.[1] ?? boundary?.[2];
  if (boundaryValue) {
    const parts = content.split(`--${boundaryValue}`);
    for (const part of parts) {
      const partSeparator = part.indexOf('\n\n');
      if (partSeparator < 0) continue;
      const partHeaders = part.slice(0, partSeparator);
      if (!/^content-type:\s*text\/plain\b/im.test(partHeaders)) continue;
      const partBody = part.slice(partSeparator + 2).replace(/\n--\s*$/, '');
      return decodeMimePart(partBody, mimeHeader(partHeaders, 'content-transfer-encoding'));
    }
  }

  if (!contentType || /^text\/plain\b/i.test(contentType)) {
    return decodeMimePart(content, mimeHeader(headers, 'content-transfer-encoding'));
  }
  return value.trim();
}

export function parseCloudflareInboundPayload(
  body: Record<string, unknown>,
): CloudflareInboundFields {
  const attachmentCountRaw = field(body, 'attachmentCount', 'attachment_count');
  const attachmentCount = Number.parseInt(attachmentCountRaw || '0', 10);
  return {
    recipient:
      field(body, 'recipient', 'to')
      || nestedField(body, 'message', 'to', 'recipient'),
    sender:
      field(body, 'sender', 'mailFrom')
      || nestedField(body, 'message', 'from', 'sender'),
    from:
      field(body, 'from', 'headerFrom')
      || nestedField(body, 'headers', 'from', 'From'),
    subject:
      field(body, 'subject')
      || nestedField(body, 'headers', 'subject', 'Subject'),
    bodyPlain: extractReadableMimeBody(field(body, 'bodyPlain', 'text', 'plain', 'body')),
    bodyHtml: field(body, 'bodyHtml', 'html'),
    messageId:
      field(body, 'messageId', 'message_id')
      || nestedField(body, 'headers', 'message-id', 'Message-ID', 'Message-Id'),
    attachmentCount: Number.isFinite(attachmentCount) ? attachmentCount : 0,
  };
}

export function cloudflareInboundSecret(): string {
  return process.env.CLOUDFLARE_EMAIL_WORKER_SECRET?.trim()
    || process.env.AIVA_CLOUDFLARE_EMAIL_SECRET?.trim()
    || '';
}

export function isCloudflareInboundSecretRequired(): boolean {
  if (process.env.CLOUDFLARE_EMAIL_REQUIRE_SECRET === 'false') return false;
  if (cloudflareInboundSecret()) return true;
  return process.env.NODE_ENV === 'production';
}

function header(headers: Record<string, HeaderValue>, key: string): string {
  const value = headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()];
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export function verifyCloudflareInboundSecret(
  headers: Record<string, HeaderValue>,
  expectedSecret = cloudflareInboundSecret(),
): boolean {
  if (!expectedSecret) return false;
  const auth = header(headers, 'authorization');
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const provided =
    header(headers, 'x-aiva-email-secret')
    || header(headers, 'x-cloudflare-email-secret')
    || bearer;
  return provided === expectedSecret;
}

export async function processCloudflareInbound(
  body: Record<string, unknown>,
  headers: Record<string, HeaderValue> = {},
): Promise<ProcessMailgunResult> {
  if (isCloudflareInboundSecretRequired() && !verifyCloudflareInboundSecret(headers)) {
    return { status: 'unauthorized' };
  }

  const fields = parseCloudflareInboundPayload(body);
  return processMailgunInbound(
    {
      recipient: fields.recipient,
      sender: fields.sender || fields.from,
      from: fields.from || fields.sender,
      subject: fields.subject,
      'body-plain': fields.bodyPlain,
      'body-html': fields.bodyHtml,
      'Message-Id': fields.messageId,
      'attachment-count': String(fields.attachmentCount),
      timestamp: String(Math.floor(Date.now() / 1000)),
      token: 'cloudflare-worker',
      signature: 'cloudflare-worker',
    },
    {
      skipSignature: true,
      source: 'hosted-cloudflare',
      messageIdPrefix: 'cloudflare',
    },
  );
}
