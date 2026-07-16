import { timingSafeEqual } from 'node:crypto';

export type ScoutPairingAccessInput = {
  plan: string;
  email: string;
  userId: string;
  workspaceId: string;
  scoutPairingAllowed: boolean;
};

export type ScoutPairingAccess = {
  allowed: boolean;
  viaBypass: boolean;
};

export function canPairScout(input: ScoutPairingAccessInput): ScoutPairingAccess {
  if (input.plan === 'team') return { allowed: true, viaBypass: false };
  if (input.scoutPairingAllowed) return { allowed: true, viaBypass: true };
  return { allowed: false, viaBypass: false };
}

export function assertOpsToken(candidate: string): void {
  const expected = process.env.CARINA_OPS_TOKEN?.trim();
  const supplied = candidate.trim();
  if (!expected || !supplied) throw new Error('Invalid ops token');

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (
    expectedBuffer.length !== suppliedBuffer.length
    || !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    throw new Error('Invalid ops token');
  }
}
