# Sprint 4 - Prompt g/01: Usage Limits Per Tier

**Sprint:** 4 - Foundation
**Prompt number:** g/01
**Name:** Monthly message caps per plan tier, usage tracking, warning emails, hard limit enforcement
**Primary agent:** Claude Code
**Estimated hours:** 5-6 h
**Depends on:** a/01 (email system - warning emails); sprint-5 billing backend (tier information)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-4/g/`.

---

## Read First

1. `backends/servers/core.carinaai.uk/src/aiva/aiva-api.ts` - message processing handler; usage check goes before processing
2. `backends/servers/core.carinaai.uk/src/billing/aiva-billing.ts` - where plan tier is read

---

## Step 1: Usage tracking table

Add to migration `010-channels.sql` (or a new migration `011-usage.sql`):

```sql
CREATE TABLE IF NOT EXISTS aiva_usage (
  workspace_id    UUID        NOT NULL,
  month           TEXT        NOT NULL,   -- 'YYYY-MM' e.g. '2026-06'
  message_count   INTEGER     NOT NULL DEFAULT 0,
  automation_count INTEGER    NOT NULL DEFAULT 0,
  escalation_count INTEGER    NOT NULL DEFAULT 0,
  warning_sent_at TIMESTAMPTZ,            -- NULL until 80% warning email is sent
  limit_reached_at TIMESTAMPTZ,           -- NULL until 100% limit is hit
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, month)
);

CREATE INDEX ON aiva_usage(workspace_id, month DESC);
```

---

## Step 2: Usage limits by tier

Define in `src/billing/aiva-billing.ts`:

```typescript
export const MESSAGE_LIMITS_BY_TIER: Record<string, number> = {
  trial:    200,
  starter:  2000,
  team:     10000,
  business: Infinity,
};

export function messageLimit(planTier: string): number {
  return MESSAGE_LIMITS_BY_TIER[planTier] ?? 200;
}
```

---

## Step 3: Usage increment and check

Create `src/usage/usage-service.ts`:

```typescript
export async function incrementMessageCount(workspaceId: string, db: DatabaseClient): Promise<void> {
  const month = new Date().toISOString().slice(0, 7);  // 'YYYY-MM'
  await db.query(`
    INSERT INTO aiva_usage (workspace_id, month, message_count, updated_at)
    VALUES ($1, $2, 1, NOW())
    ON CONFLICT (workspace_id, month)
    DO UPDATE SET message_count = aiva_usage.message_count + 1, updated_at = NOW()
  `, [workspaceId, month]);
}

export async function getCurrentUsage(workspaceId: string, db: DatabaseClient): Promise<{
  messageCount: number;
  month: string;
  warningSentAt: Date | null;
  limitReachedAt: Date | null;
}> {
  const month = new Date().toISOString().slice(0, 7);
  const result = await db.query(
    'SELECT message_count, warning_sent_at, limit_reached_at FROM aiva_usage WHERE workspace_id=$1 AND month=$2',
    [workspaceId, month]
  );
  return {
    messageCount: result.rows[0]?.message_count ?? 0,
    month,
    warningSentAt: result.rows[0]?.warning_sent_at ?? null,
    limitReachedAt: result.rows[0]?.limit_reached_at ?? null,
  };
}

export async function checkAndEnforceLimit(
  workspaceId: string,
  planTier: string,
  db: DatabaseClient,
  emailTo: string,
  workerName: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const usage = await getCurrentUsage(workspaceId, db);
  const limit = messageLimit(planTier);

  if (limit === Infinity) return { allowed: true };

  // At or over limit
  if (usage.messageCount >= limit) {
    // Mark limit reached (once per month)
    if (!usage.limitReachedAt) {
      await db.query(
        'UPDATE aiva_usage SET limit_reached_at=NOW() WHERE workspace_id=$1 AND month=$2',
        [workspaceId, usage.month]
      );
      // Send limit reached email
      await sendEmail({
        to: emailTo,
        subject: 'Your Aiva has reached its monthly message limit',
        template: <UsageLimitReachedEmail
          workerName={workerName}
          limit={limit}
          upgradeUrl={`${process.env.APP_URL}/billing/aiva`}
        />,
      });
    }
    return {
      allowed: false,
      reason: `Monthly message limit reached (${limit} messages on ${planTier} plan).`,
    };
  }

  // Approaching limit (80%)
  const warningThreshold = Math.floor(limit * 0.8);
  if (usage.messageCount >= warningThreshold && !usage.warningSentAt) {
    await db.query(
      'UPDATE aiva_usage SET warning_sent_at=NOW() WHERE workspace_id=$1 AND month=$2',
      [workspaceId, usage.month]
    );
    await sendEmail({
      to: emailTo,
      subject: `Your Aiva is at ${Math.round((usage.messageCount / limit) * 100)}% of its monthly limit`,
      template: <UsageWarningEmail
        workerName={workerName}
        messageCount={usage.messageCount}
        limit={limit}
        upgradeUrl={`${process.env.APP_URL}/billing/aiva`}
      />,
    });
  }

  return { allowed: true };
}
```

---

## Step 4: Two new email templates

Add to `src/email/templates/`:

**`usage-warning.tsx`:**
```tsx
// Props: { workerName, messageCount, limit, upgradeUrl }
// Subject: handled by caller
// Content: "[workerName] has used [count] of [limit] messages this month ([N]% used).
//           Upgrade your plan to increase your limit."
// CTA: "Upgrade plan"
```

**`usage-limit-reached.tsx`:**
```tsx
// Props: { workerName, limit, upgradeUrl }
// Subject: "Your Aiva has reached its monthly message limit"
// Content: "[workerName] has reached the [limit]-message limit for this month.
//           Your Aiva will respond: 'I have reached my message limit for the month.
//           Please contact [workspace name] directly or wait until next month.'
//           Upgrade your plan to continue without interruption."
// CTA: "Upgrade plan now"
```

---

## Step 5: Wire into message processing

In `aiva-api.ts`, in the message processing handler (where the Aiva brain is called), add before the brain runs:

```typescript
// Fetch workspace owner email for notifications
const ownerResult = await db.query(
  'SELECT u.email, w.name AS workspace_name FROM workspaces w JOIN users u ON u.workspace_id=w.id AND u.is_owner=true WHERE w.id=$1',
  [workspaceId]
);
const ownerEmail = ownerResult.rows[0]?.email;

const check = await checkAndEnforceLimit(
  workspaceId,
  subscription.plan_tier,
  db,
  ownerEmail,
  worker.name,
);

if (!check.allowed) {
  // Send a polite limit message back to the client via the channel
  const limitResponse = `I have reached my message limit for this month. Please contact the team directly or check back next month.`;
  // Return this as the Aiva response without calling the brain
  return { response: limitResponse, limitReached: true };
}

// ... proceed with Aiva brain
```

After a message is successfully processed by the brain:
```typescript
await incrementMessageCount(workspaceId, db);
```

---

## Step 6: Usage display in workspace

**On the billing page** (`/billing/aiva`): add a usage bar between the current plan banner and the plan cards.

```
[Messages this month]
[Progress bar: 1,240 / 2,000]    62% used
[Resets on: 1 Jul 2026]
```

Fetch from `GET /api/aiva/billing/status` (add to the response):
```typescript
// Add to the status response:
usage: {
  messageCount: number,
  messageLimit: number,
  usagePercent: number,
  resetsAt: string,  // first day of next month
}
```

**On each Aiva detail page**: show a compact usage badge in the header:
```
1,240 / 2,000 messages
```

Color: green < 60%, amber 60-85%, red > 85%.

**In the admin customer list** (sprint-6 prompt 01): add a "Usage" column showing `messageCount / limit (N%)`.

---

## Done When

- [ ] `aiva_usage` table created with workspace_id, month, message_count, escalation_count, warning_sent_at, limit_reached_at
- [ ] `MESSAGE_LIMITS_BY_TIER` defined: trial=200, starter=2000, team=10000, business=Infinity
- [ ] `incrementMessageCount()` uses INSERT ... ON CONFLICT DO UPDATE (atomic, no race condition)
- [ ] `checkAndEnforceLimit()` called before Aiva brain processes any message
- [ ] At 80% of limit: usage-warning email sent once per workspace per month
- [ ] At 100% of limit: Aiva returns limit message to client; owner receives limit-reached email
- [ ] Both email templates built with correct props and CTA
- [ ] Business tier (Infinity limit): usage check skipped entirely
- [ ] Usage progress bar on billing page with correct color thresholds
- [ ] `resetsAt` date shown on billing page
- [ ] Usage badge on Aiva detail page header
- [ ] Usage column in admin customer list
- [ ] `GET /api/aiva/billing/status` includes usage object in response
- [ ] No em dashes in any email copy or UI copy
