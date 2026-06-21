# Gap 20 - Prompt 04: Device Trust -- Challenge Nonce Signing v3 & Attestation

**Gap:** 20 Node System & Device Architecture
**Prompt number:** 04 of 04
**Name:** Challenge nonce signing v3, device attestation hardening
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** 01-node-protocol.md, `infrastructure/device-pairing.ts`

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `infrastructure/device-pairing.ts` -- current pairing (SHA-256 tokens)
2. `infrastructure/device-scopes.ts` -- device scope parsing
3. OpenClaw `src/nodes/pairing.ts` (reference) -- challenge nonce v3

---

## Goal

Upgrade Carina's device pairing from simple SHA-256 tokens to challenge-nonce
signing. Every node connection verifies possession of the device key via a
cryptographic challenge rather than just presenting a bearer token.

### Step 1: Challenge Nonce Protocol

On node connect, the gateway issues a random nonce. The node must sign it
with its device private key. The gateway verifies the signature against the
stored device public key.

```typescript
// infrastructure/device-trust.ts
import { randomBytes, createVerify, createPublicKey } from 'node:crypto';

export interface ChallengeNonce {
  nonce: string; // 32 random bytes, hex-encoded
  issuedAt: number; // Date.now()
  expiresAt: number; // issuedAt + 30000 (30s validity)
  deviceId: string;
}

export class DeviceTrust {
  private pendingChallenges: Map<string, ChallengeNonce> = new Map();

  /**
   * Issue a challenge nonce to a connecting device.
   */
  issueChallenge(deviceId: string): ChallengeNonce {
    const nonce = randomBytes(32).toString('hex');
    const now = Date.now();
    const challenge: ChallengeNonce = {
      nonce,
      issuedAt: now,
      expiresAt: now + 30000,
      deviceId,
    };
    this.pendingChallenges.set(deviceId, challenge);

    // Auto-expire after 30s
    setTimeout(() => this.pendingChallenges.delete(deviceId), 30000);

    return challenge;
  }

  /**
   * Verify a signed challenge from a device.
   * The device must sign the nonce with its private key.
   * We verify with the stored public key.
   */
  async verifyChallenge(
    deviceId: string,
    signature: string,      // base64-encoded signature
    nonce: string,
  ): Promise<boolean> {
    // 1. Check challenge exists and hasn't expired
    const challenge = this.pendingChallenges.get(deviceId);
    if (!challenge) return false;
    if (Date.now() > challenge.expiresAt) {
      this.pendingChallenges.delete(deviceId);
      return false;
    }

    // 2. Verify nonce matches the issued one
    if (challenge.nonce !== nonce) return false;

    // 3. Get device public key
    const device = await this.deviceStore.get(deviceId);
    if (!device?.publicKey) return false;

    // 4. Verify signature
    try {
      const verify = createVerify('SHA256');
      verify.update(nonce);
      verify.end();
      const isValid = verify.verify(
        createPublicKey(device.publicKey),
        Buffer.from(signature, 'base64'),
      );

      if (isValid) {
        // Consume challenge (one-time use)
        this.pendingChallenges.delete(deviceId);
      }
      return isValid;
    } catch {
      return false;
    }
  }
}
```

### Step 2: Device Key Generation (Mobile Client)

On first pairing, the mobile app generates an Ed25519 keypair:

```typescript
// On the mobile client (React Native):
import { generateKeyPair } from 'react-native-ed25519';

const { publicKey, privateKey } = await generateKeyPair();

// Store privateKey in secure enclave (iOS Keychain / Android Keystore)
// Send publicKey to gateway during pairing flow
```

The gateway stores `publicKey` in the `devices` table alongside the existing
SHA-256 token hash. Both auth methods coexist during migration.

### Step 3: Connection Flow

```
Client                          Gateway
  |                                |
  |--- ws connect --------------->|
  |                                | 1. Issue challenge nonce
  |<-- {type:"challenge", nonce} -|
  |                                |
  | 2. Sign nonce with privKey     |
  |--- {type:"hello", auth: {     |
  |     token, nonce, signature}}->|
  |                                | 3. Verify signature
  |                                | 4. Verify token
  |<-- {type:"hello_ok", nodeId} -|
  |                                |
  |--- commands ---->  ...        |
```

### Step 4: Replay Protection

Track used nonces to prevent replay attacks:

```typescript
// In DeviceTrust:
private usedNonces: Set<string> = new Set();
private readonly MAX_USED_NONCES = 10000;

verifyChallenge(...): boolean {
  // ... existing checks ...
  if (this.usedNonces.has(nonce)) {
    return false; // nonce already used
  }

  // ... signature verification ...

  // Record nonce as used
  if (this.usedNonces.size >= this.MAX_USED_NONCES) {
    // Evict oldest 1000
    const toEvict = Array.from(this.usedNonces).slice(0, 1000);
    toEvict.forEach(n => this.usedNonces.delete(n));
  }
  this.usedNonces.add(nonce);
}
```

---

## Existing Carina code to integrate with

- `infrastructure/device-pairing.ts` -- extend pairing with key registration
- `infrastructure/node-host/ws-server.ts` -- add challenge flow (prompt 01)
- `infrastructure/device-store.ts` -- store public keys
- `db/migrations/` -- add `public_key` column to `paired_devices`
