# Prompt: Usage Limit Email Warnings for Org Owners

## What to build

When a Carina Ops workspace reaches 80%, 90%, or 100% of its monthly token quota, send an email to the org owner. The `warning: boolean` field already exists in `src/hosted/usage-service.ts` (line 23) but nothing sends an email when it is set.

## What already exists (read before writing anything)

- `src/hosted/usage-service.ts` - `getUsageQuota()` returns `{ warning: boolean, ... }`. Read this fully.
- `src/hosted/invite-email.ts` - `ResendInviteEmailSender` class. This is the pattern to follow for all Resend emails. Read it fully.
- `src/billing/usage-meter.ts` - `warning` string message on 80%/90% threshold (lines 71, 92). Read to understand the threshold logic.
- `src/hosted/usage-service.test.ts` - existing tests. Extend rather than replace.

## Design

### 1. Add a threshold checker to usage-service.ts

Add a function `getUsageWarningThreshold(used: number, limit: number): 80 | 90 | 100 | null`:
- Returns `100` when `used >= limit`
- Returns `90` when `used >= limit * 0.9`
- Returns `80` when `used >= limit * 0.8`
- Returns `null` otherwise

### 2. Create src/hosted/usage-warning-email.ts

Model it on `invite-email.ts`. Implement:

```typescript
export interface UsageWarningEmailInput {
  orgName: string;
  ownerEmail: string;
  threshold: 80 | 90 | 100;
  used: number;
  limit: number;
}

export async function sendUsageWarningEmail(input: UsageWarningEmailInput): Promise<void>
```

- Use Resend with `from: config.resend.from` (already in config).
- Subject: `"Carina Ops: your ${input.orgName} workspace has reached ${input.threshold}% of its monthly limit"`
- Body: plain text (no HTML required). State the usage numbers, direct the owner to the billing page at `https://core.carinaai.uk/ops/billing`.
- If `config.resend.apiKey` is not set, log a warning and return without throwing (same graceful-skip pattern as `invite-email.ts`).

### 3. Wire the check into usage tracking

In `src/hosted/usage-service.ts` (or wherever usage is recorded after each request), call `getUsageWarningThreshold` and if the threshold just crossed (was below, now at or above), call `sendUsageWarningEmail`.

"Just crossed" logic: store the last-emailed threshold per org in a `Map<string, number>` (keyed by orgId). Only send if the new threshold is higher than the last-emailed threshold. Reset to `null` at the start of each billing cycle.

### 4. Tests

Create `src/hosted/usage-warning-email.test.ts`:
- `getUsageWarningThreshold` returns correct tier for each boundary (79%, 80%, 89%, 90%, 99%, 100%, over 100%)
- Email is sent when threshold first crossed
- Email is NOT sent again if already at or above that threshold
- Email is NOT sent when Resend API key is absent (no throw, just skipped)

Extend `src/hosted/usage-service.test.ts` with: warning threshold triggers at correct usage levels.

## Run after building

```bash
cd core.carinaai.uk
pnpm vitest run src/hosted/usage-warning-email.test.ts
pnpm test
pnpm build
```
