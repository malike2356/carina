import { randomBytes, randomUUID } from 'node:crypto';
import { getCredentialPoolManager } from '../../credentials/pool-manager.js';
import { appendEnvValue } from '../../cli/config/loader.js';
import { reloadSecrets } from '../../ops/secrets-reload.js';
import type { SecretRotationPolicy } from './types.js';

export type PooledCredential = {
  id: string;
  provider: string;
  value: string;
  active: boolean;
  createdAt: number;
};

export class RotationCredentialPool {
  async add(provider: string, value: string): Promise<PooledCredential> {
    const mgr = getCredentialPoolManager();
    mgr.addKey(provider, value);
    return {
      id: randomUUID(),
      provider,
      value,
      active: false,
      createdAt: Date.now(),
    };
  }

  async activate(provider: string, credential: PooledCredential): Promise<void> {
    const mgr = getCredentialPoolManager();
    mgr.addKey(provider, credential.value);
    mgr.rotate(provider);
    const policy = await import('./policies.js').then((m) => m.getPolicy(provider));
    if (policy.envKey && process.env[policy.envKey] !== credential.value) {
      await appendEnvValue(policy.envKey, credential.value);
      await reloadSecrets({ overwrite: true, notifyGateway: false });
    }
    credential.active = true;
  }

  async revoke(provider: string, credentialId: string, partialValue?: string): Promise<boolean> {
    if (!partialValue) return false;
    const mgr = getCredentialPoolManager();
    return mgr.retireKey(provider, partialValue);
  }
}

export function generateCredentialValue(policy: SecretRotationPolicy): string {
  if (policy.secretType === 'session_token' || policy.secretType === 'jwt') {
    return randomBytes(32).toString('base64url');
  }
  if (policy.secretType === 'encryption_key') {
    return randomBytes(32).toString('hex');
  }
  return `carina_rot_${randomBytes(24).toString('hex')}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const rotationCredentialPool = new RotationCredentialPool();
