# Prompt 02: Automated Secrets Rotation


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

API keys and tokens in `.env` age out or get compromised. Manual rotation requires finding
all usages, updating the key, deploying, and verifying. Carina can automate parts of this
cycle: detecting old keys, generating new ones via provider APIs, updating `.env` atomically,
and verifying the new key works before the old one is revoked.

## What to Build

### 1. Secret rotation registry

Create `src/security/rotation/registry.ts`:
```typescript
export type RotatableSecret = {
  envKey: string; // env var name (e.g., OPENAI_API_KEY)
  provider: string; // human label (e.g., "OpenAI")
  generate?: () => Promise<string>; // how to create a new key (provider-specific)
  validate: (key: string) => Promise<boolean>; // test the new key before activating
  revokeOld?: (oldKey: string) => Promise<void>; // revoke old key (if API supports it)
  maxAgeDays: number; // warn if key is older than this
};

export const ROTATABLE_SECRETS: RotatableSecret[] = [
  {
    envKey: 'RESEND_API_KEY',
    provider: 'Resend',
    validate: async (key) => {
      const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` } });
      return r.ok;
    },
    maxAgeDays: 90,
  },
  // Add entries for each provider as their rotation APIs are available
];
```

### 2. Rotation tool

Create `src/tools/security/rotate-secret.ts`:
```typescript
export const rotateSecretTool = {
  name: 'rotate-secret',
  description: 'Generate and activate a new API key, replacing the current one in .env',
  parameters: {
    envKey: { type: 'string', description: 'The env var to rotate (e.g. RESEND_API_KEY)' },
    dryRun: { type: 'boolean', default: false, description: 'Validate new key but do not apply' },
  },
  async execute({ envKey, dryRun }: { envKey: string; dryRun: boolean }) {
    const secret = ROTATABLE_SECRETS.find(s => s.envKey === envKey);
    if (!secret) throw new Error(`No rotation config for ${envKey}`);

    if (!secret.generate) {
      return { error: `${envKey} requires manual generation - no automated rotation available` };
    }

    const newKey = await secret.generate();
    const valid = await secret.validate(newKey);
    if (!valid) throw new Error('New key validation failed - old key unchanged');

    if (!dryRun) {
      await updateEnvFile(envKey, newKey);
      if (secret.revokeOld) await secret.revokeOld(process.env[envKey] ?? '');
      scout.emit({ type: 'secret-rotated', envKey, timestamp: new Date() });
    }

    return { rotated: !dryRun, envKey, validated: true };
  },
};
```

### 3. Key age monitoring

Create `src/security/rotation/age-monitor.ts`:
```typescript
export async function checkKeyAges(): Promise<AgeReport[]> {
  const report: AgeReport[] = [];
  for (const secret of ROTATABLE_SECRETS) {
    const ageRecord = await db.query(
      'SELECT created_at FROM secret_ages WHERE env_key = $1', [secret.envKey]
    );
    if (!ageRecord.rows[0]) continue;
    const ageDays = daysSince(ageRecord.rows[0].created_at);
    report.push({ envKey: secret.envKey, ageDays, maxAgeDays: secret.maxAgeDays, overdue: ageDays > secret.maxAgeDays });
  }
  return report;
}
```

### 4. Rotation CLI commands

```bash
carina security secrets list         # show all rotatable secrets and their age
carina security secrets rotate OPENAI_API_KEY --dry-run
carina security secrets rotate OPENAI_API_KEY
carina security secrets audit        # report on overdue rotations
```

### 5. Sunday rotation reminder

Add to `src/agents/checks/`:
```typescript
// If any secret is overdue for rotation, surface it in Sunday check-in
const overdue = report.filter(r => r.overdue);
if (overdue.length > 0) {
  return { urgent: true, summary: `${overdue.length} API keys overdue for rotation: ${overdue.map(r => r.envKey).join(', ')}` };
}
```

## Verification Checklist

- [ ] `carina security secrets list` shows all rotatable secrets with age
- [ ] `carina security secrets rotate RESEND_API_KEY --dry-run` validates new key
- [ ] After successful rotation, `.env` contains new key value
- [ ] Scout shows `secret-rotated` event in event log
- [ ] Sunday check-in surfaces overdue rotation warnings

## Files to Create or Modify

- CREATE `src/security/rotation/registry.ts`
- CREATE `src/tools/security/rotate-secret.ts`
- CREATE `src/security/rotation/age-monitor.ts`
- CREATE `src/agents/checks/secrets-rotation-check.ts`
- MODIFY `src/tools/registry.ts` - register rotate-secret tool
- MODIFY `src/cli/scout.ts` - add secrets subcommands
