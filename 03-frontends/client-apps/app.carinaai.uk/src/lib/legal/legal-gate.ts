import { getLegalStatus, toLegalGatePayload, type LegalGatePayload } from './acceptance';

export async function checkLegalGate(
  userId: string,
  workspaceId: string,
): Promise<LegalGatePayload | null> {
  const status = await getLegalStatus(userId, workspaceId);
  return toLegalGatePayload(status);
}

const LEGAL_EXEMPT_API_PREFIXES = [
  '/api/legal/current',
  '/api/legal/status',
  '/api/legal/accept',
  '/api/auth/',
  '/api/health',
  '/api/webhooks/',
];

export function isLegalExemptApiPath(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) return true;
  return LEGAL_EXEMPT_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function legalGateResponse(payload: LegalGatePayload): Response {
  return Response.json(payload, { status: 403 });
}
