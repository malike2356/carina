# Security 07; Automated Secrets Rotation

**Source:** NEW (No agent has this)
**Effort:** 2 weeks

## SPECIFICATION

Automated rotation of API keys, tokens, and credentials. Scheduled rotation with expiry enforcement. Zero-downtime rotation using credential pools. Audit of stale credentials.

### Implementation

```typescript
// security/secrets/rotation-scheduler.ts

interface SecretRotationPolicy {
  secretType: 'api_key' | 'oauth_token' | 'jwt' | 'session_token' | 'encryption_key';
  provider: string;
  maxAge: number; // max age in ms before rotation
  rotationWindow: number; // how long rotation takes (for zero-downtime)
  autoRotate: boolean;
  notifyBefore: number; // notify N ms before expiry
}

class SecretsRotationScheduler {
  async schedule(policy: SecretRotationPolicy): Promise<void> {
    // Register rotation job
    await cron.create(`rotate-${policy.provider}`, {
      schedule: this.computeSchedule(policy),
      handler: () => this.rotate(policy),
    });
  }

  async rotate(policy: SecretRotationPolicy): Promise<void> {
    // 1. Generate new credential
    const newCred = await this.generateCredential(policy);
    
    // 2. Add to credential pool (dual-credential window)
    await credentialPool.add(newCred);
    
    // 3. Wait for propagation
    await sleep(policy.rotationWindow);
    
    // 4. Switch active credential
    await credentialPool.activate(newCred.id);
    
    // 5. Revoke old credential
    await this.revokeCredential(oldCred);
    
    // 6. Audit
    await auditLog.record('secret_rotated', {
      provider: policy.provider,
      oldCredId: oldCred.id,
      newCredId: newCred.id,
      rotatedAt: Date.now(),
    });
  }
}

// CLI: carina security secrets rotate [provider]
// CLI: carina security secrets status; show all secrets and their age
// CLI: carina security secrets audit; find stale credentials
```
