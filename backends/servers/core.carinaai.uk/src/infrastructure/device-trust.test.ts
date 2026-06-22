import { createSign, generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { DeviceTrust, resetDeviceTrustForTests } from './device-trust.js';

afterEach(() => {
  resetDeviceTrustForTests();
});

describe('DeviceTrust', () => {
  it('issues and verifies a signed challenge', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const trust = new DeviceTrust(async () => publicKey.export({ type: 'spki', format: 'pem' }) as string);
    const challenge = trust.issueChallenge('dev-1');

    const sign = createSign('SHA256');
    sign.update(challenge.nonce);
    sign.end();
    const signature = sign.sign(privateKey, 'base64');

    await expect(trust.verifyChallenge('dev-1', signature, challenge.nonce)).resolves.toBe(true);
    await expect(trust.verifyChallenge('dev-1', signature, challenge.nonce)).resolves.toBe(false);
  });
});
