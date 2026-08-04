import { createPublicKey, createVerify, randomBytes } from 'node:crypto';

export interface ChallengeNonce {
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  deviceId: string;
}

export type PublicKeyLookup = (deviceId: string) => Promise<string | null | undefined>;

export class DeviceTrust {
  private pendingChallenges = new Map<string, ChallengeNonce>();
  private usedNonces = new Set<string>();
  private readonly maxUsedNonces = 10_000;

  constructor(private readonly getPublicKey: PublicKeyLookup) {}

  issueChallenge(deviceId: string, ttlMs = 30_000): ChallengeNonce {
    const nonce = randomBytes(32).toString('hex');
    const now = Date.now();
    const challenge: ChallengeNonce = {
      nonce,
      issuedAt: now,
      expiresAt: now + ttlMs,
      deviceId,
    };
    this.pendingChallenges.set(deviceId, challenge);
    setTimeout(() => this.pendingChallenges.delete(deviceId), ttlMs);
    return challenge;
  }

  async verifyChallenge(
    deviceId: string,
    signature: string,
    nonce: string,
  ): Promise<boolean> {
    if (this.usedNonces.has(nonce)) return false;

    const challenge = this.pendingChallenges.get(deviceId);
    if (!challenge) return false;
    if (Date.now() > challenge.expiresAt) {
      this.pendingChallenges.delete(deviceId);
      return false;
    }
    if (challenge.nonce !== nonce) return false;

    const publicKeyPem = await this.getPublicKey(deviceId);
    if (!publicKeyPem) return false;

    try {
      const verify = createVerify('SHA256');
      verify.update(nonce);
      verify.end();
      const isValid = verify.verify(
        createPublicKey(publicKeyPem),
        Buffer.from(signature, 'base64'),
      );
      if (!isValid) return false;

      this.pendingChallenges.delete(deviceId);
      this.rememberNonce(nonce);
      return true;
    } catch {
      return false;
    }
  }

  private rememberNonce(nonce: string): void {
    if (this.usedNonces.size >= this.maxUsedNonces) {
      const toEvict = Array.from(this.usedNonces).slice(0, 1000);
      for (const entry of toEvict) this.usedNonces.delete(entry);
    }
    this.usedNonces.add(nonce);
  }

  clearForTests(): void {
    this.pendingChallenges.clear();
    this.usedNonces.clear();
  }
}

let trust: DeviceTrust | null = null;
let publicKeyLookup: PublicKeyLookup = async () => null;

export function initDeviceTrust(getPublicKey: PublicKeyLookup): void {
  publicKeyLookup = getPublicKey;
  trust = new DeviceTrust(publicKeyLookup);
}

export function getDeviceTrust(): DeviceTrust {
  trust ??= new DeviceTrust(publicKeyLookup);
  return trust;
}

export function resetDeviceTrustForTests(): void {
  trust?.clearForTests();
  trust = null;
}
