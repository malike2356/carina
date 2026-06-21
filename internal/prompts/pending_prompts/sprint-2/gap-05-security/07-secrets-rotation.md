# Security 07; Automated Secrets Rotation


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

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
