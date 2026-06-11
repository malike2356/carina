import crypto from 'node:crypto';

export interface SvixHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

export function parseSvixHeaders(
  headers: Record<string, string | string[] | undefined>,
): SvixHeaders | null {
  const id = String(headers['svix-id'] ?? '');
  const timestamp = String(headers['svix-timestamp'] ?? '');
  const signature = String(headers['svix-signature'] ?? '');
  if (!id || !timestamp || !signature) return null;
  return { id, timestamp, signature };
}

export function verifyResendWebhook(
  rawBody: string,
  headers: SvixHeaders,
  secret: string,
  nowMs = Date.now(),
): boolean {
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts)) return false;
  const ageSeconds = Math.abs(nowMs / 1000 - ts);
  if (ageSeconds > 300) return false;

  const key = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(key, 'base64');
  } catch {
    return false;
  }

  const signed = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', keyBytes).update(signed).digest('base64');

  for (const part of headers.signature.split(' ')) {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) continue;
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    } catch {
      /* continue */
    }
  }
  return false;
}
