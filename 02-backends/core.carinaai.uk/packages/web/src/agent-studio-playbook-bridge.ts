import { createHmac, timingSafeEqual } from 'node:crypto';
import { isKeprixHandoffConfigured, readKeprixConfig } from './keprix-config.js';

export const KEPRIX_STUDIO_AUDIENCE = 'keprix-studio';
export const HANDOFF_TTL_SECONDS = 5 * 60;

export type StudioHandoffClaims = {
  sub: string;
  tenant_id: string;
  carina_user_id: string;
  aud: typeof KEPRIX_STUDIO_AUDIENCE;
  exp: number;
  iat: number;
};

export class StudioHandoffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StudioHandoffError';
  }
}

function encodeSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T;
}

export function signStudioHandoffToken(
  claims: Pick<StudioHandoffClaims, 'sub' | 'tenant_id' | 'carina_user_id'>,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  if (!secret || secret.length < 16) {
    throw new StudioHandoffError('KEPRIX_HANDOFF_SECRET is not configured');
  }
  const header = encodeSegment({ alg: 'HS256', typ: 'JWT' });
  const body = encodeSegment({
    ...claims,
    aud: KEPRIX_STUDIO_AUDIENCE,
    iat: nowSeconds,
    exp: nowSeconds + HANDOFF_TTL_SECONDS,
  } satisfies StudioHandoffClaims);
  const signature = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyStudioHandoffToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): StudioHandoffClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = decodeSegment<StudioHandoffClaims>(body);
    if (payload.aud !== KEPRIX_STUDIO_AUDIENCE) return null;
    if (!payload.sub || !payload.tenant_id || !payload.carina_user_id) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) return null;
    return payload;
  } catch {
    return null;
  }
}

function normalizeStudioPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '/playbooks/studio/new';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    throw new StudioHandoffError('Studio path must be relative');
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export async function getStudioHandoffUrl(
  path: string,
  context: { subject: string; tenantId: string; carinaUserId: string },
): Promise<string> {
  const config = readKeprixConfig();
  if (!isKeprixHandoffConfigured(config)) {
    throw new StudioHandoffError('Keprix studio handoff is not configured');
  }
  const studioPath = normalizeStudioPath(path);
  const token = signStudioHandoffToken(
    {
      sub: context.subject,
      tenant_id: context.tenantId,
      carina_user_id: context.carinaUserId,
    },
    config.handoffSecret,
  );
  const base = config.studioBaseUrl.replace(/\/$/, '');
  const url = new URL(`${base}${studioPath}`);
  url.searchParams.set('handoff', token);
  return url.toString();
}
