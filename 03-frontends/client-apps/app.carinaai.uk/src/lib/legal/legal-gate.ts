import 'server-only';
import { getLegalStatus, toLegalGatePayload, type LegalGatePayload } from './acceptance';

export type { LegalGatePayload } from './acceptance';
export { isLegalExemptApiPath } from './legal-gate-paths';

export async function checkLegalGate(
  userId: string,
  workspaceId: string,
): Promise<LegalGatePayload | null> {
  const status = await getLegalStatus(userId, workspaceId);
  return toLegalGatePayload(status);
}

export function legalGateResponse(payload: LegalGatePayload): Response {
  return Response.json(payload, { status: 403 });
}
