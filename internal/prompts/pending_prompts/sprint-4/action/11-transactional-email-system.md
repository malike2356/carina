# Sprint 4 - Prompt a/01: Transactional Email System

**Sprint:** 4 - Foundation
**Prompt number:** a/01
**Name:** Transactional email: service, templates, triggers, DNS
**Primary agent:** Claude Code (backend) + Cursor (templates)
**Estimated hours:** 8-10 h
**Depends on:** Nothing. Can build independently then wire triggers into existing routes.

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move to `internal/prompts/archived_prompts/pending_prompts/sprint-4/a/`.

---

## Read First

1. `backends/servers/core.carinaai.uk/src/aiva/aiva-api.ts` - where Aiva creation, escalation, and trial provisioning happen; email triggers wire in here
2. `backends/servers/core.carinaai.uk/src/billing/aiva-billing.ts` - payment events that need email notifications
3. `backends/servers/core.carinaai.uk/src/billing/webhooks/aiva-webhook-handler.ts` - Stripe webhook events; email triggers wire in here
4. `backends/servers/core.carinaai.uk/package.json` - check if any email library already present

---

## Step 1: Email service setup (Resend)

Use Resend (`resend.com`) as the email delivery service.

```bash
cd backends/servers/core.carinaai.uk
npm install resend @react-email/components @react-email/render
```

Add to `.env.example`:
```env
RESEND_API_KEY=             # from resend.com dashboard
EMAIL_FROM=noreply@carinaai.uk
EMAIL_FROM_NAME=Carina by VERLOX
RESEND_PREVIEW_MODE=false   # set to true in development to log emails instead of sending
```

Create `src/email/email-service.ts`:

```typescript
import { Resend } from 'resend';
import { render } from '@react-email/render';
import React from 'react';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailOptions {
  to: string;
  subject: string;
  template: React.ReactElement;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  if (process.env.RESEND_PREVIEW_MODE === 'true' || process.env.NODE_ENV === 'development') {
    const text = await render(opts.template, { plainText: true });
    console.log(`[EMAIL DEV] To: ${opts.to} | Subject: ${opts.subject}\n${text}`);
    return;
  }

  try {
    await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
      to: opts.to,
      subject: opts.subject,
      react: opts.template,
      reply_to: opts.replyTo,
      tags: opts.tags,
    });
  } catch (err) {
    // Non-fatal: log but do not throw. Email failure must never crash the request.
    console.error('[EMAIL] Send failed:', opts.to, opts.subject, err);
  }
}
```

---

## Step 2: DNS records for deliverability

Add to `infrastructure/VPS-SETUP.md` under an "Email DNS" section:

```
Records to add at your DNS provider for carinaai.uk:

SPF (TXT record):
  Host: @
  Value: v=spf1 include:_spf.resend.com ~all

DKIM (TXT record) - get exact value from Resend dashboard after adding domain:
  Host: resend._domainkey
  Value: [from Resend dashboard]

DMARC (TXT record):
  Host: _dmarc
  Value: v=DMARC1; p=quarantine; rua=mailto:lordsesame@gmail.com; ruf=mailto:lordsesame@gmail.com; sp=reject; adkim=s; aspf=s;

After adding records, verify in Resend dashboard: Domains -> carinaai.uk -> Verify DNS.
Verification can take up to 48 hours.
```

---

## Step 3: Shared email layout component

Create `src/email/components/Layout.tsx`:

```tsx
import { Html, Head, Body, Container, Section, Text, Link, Hr, Img } from '@react-email/components';
import React from 'react';

interface LayoutProps {
  preview: string;
  children: React.ReactNode;
  showUnsubscribe?: boolean;
  unsubscribeUrl?: string;
}

export function Layout({ preview, children, showUnsubscribe = true, unsubscribeUrl }: LayoutProps) {
  return (
    <Html>
      <Head />
      {/* @ts-expect-error - react-email preview element */}
      <preview>{preview}</preview>
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden' }}>
          {/* Header */}
          <Section style={{ backgroundColor: '#0a0a0a', padding: '24px 32px' }}>
            <Text style={{ color: '#ffffff', fontSize: '18px', fontWeight: '700', margin: 0 }}>
              VERLOX
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: '12px', margin: '4px 0 0' }}>
              Powered by Carina
            </Text>
          </Section>

          {/* Content */}
          <Section style={{ padding: '32px' }}>
            {children}
          </Section>

          {/* Footer */}
          <Section style={{ padding: '24px 32px', backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
            <Text style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>
              VERLOX Ltd. Registered in England and Wales.
            </Text>
            {showUnsubscribe && unsubscribeUrl && (
              <Text style={{ color: '#6b7280', fontSize: '12px', margin: '8px 0 0' }}>
                <Link href={unsubscribeUrl} style={{ color: '#6b7280' }}>
                  Unsubscribe from these emails
                </Link>
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

---

## Step 4: Email templates

Create one file per template in `src/email/templates/`.

**`welcome.tsx`** - sent after registration:
```tsx
// Props: { firstName: string; loginUrl: string }
// Subject: "Welcome to VERLOX - your account is ready"
// Content: greeting, "Your account is active", CTA "Go to your workspace"
```

**`aiva-created.tsx`** - sent after first Aiva is created:
```tsx
// Props: { firstName: string; workerName: string; role: string; portalUrl: string }
// Subject: "Meet [workerName], your new Aiva"
// Content: "Your Aiva [workerName] is now configured and ready.", role description, CTA "View your Aiva"
```

**`trial-expiring.tsx`** - sent at 3, 2, 1 day remaining:
```tsx
// Props: { firstName: string; daysRemaining: number; workerName: string; upgradeUrl: string; trialEndsAt: string }
// Subject: "[N] day[s] left on your Aiva trial"
// Content varies by daysRemaining:
//   3: amber tone, gentle nudge
//   2: amber, more direct
//   1: urgent tone, "tomorrow your Aiva pauses"
// CTA: "Choose a plan"
```

**`trial-expired.tsx`** - sent when trial ends:
```tsx
// Props: { firstName: string; workerName: string; upgradeUrl: string }
// Subject: "Your Aiva trial has ended"
// Content: "Your Aiva [workerName] has been paused. Choose a plan to reactivate it."
// CTA: "Choose a plan" (danger button style)
```

**`payment-success.tsx`** - sent after successful subscription payment:
```tsx
// Props: { firstName: string; planName: string; amount: string; nextBillingDate: string; invoiceUrl: string }
// Subject: "Payment confirmed - Aiva [planName]"
// Content: receipt summary, plan name, amount, next billing date
// CTA: "Download invoice"
```

**`payment-failed.tsx`** - sent when payment fails:
```tsx
// Props: { firstName: string; amount: string; gracePeriodEndsAt: string; updateUrl: string }
// Subject: "Action needed: payment failed"
// Content: "We could not collect [amount]. Your Aiva will continue until [date]."
// CTA: "Update payment method" (links to Stripe portal session)
```

**`grace-period-warning.tsx`** - sent 1 day before grace period ends:
```tsx
// Props: { firstName: string; workerName: string; gracePeriodEndsAt: string; updateUrl: string }
// Subject: "Your Aiva pauses tomorrow - update payment now"
// Content: urgent, red accent, explicit date/time
// CTA: "Update payment method now"
```

**`subscription-suspended.tsx`** - sent when subscription is suspended:
```tsx
// Props: { firstName: string; workerName: string; reactivateUrl: string }
// Subject: "Your Aiva has been paused"
// Content: "Your Aiva [workerName] is paused due to an unresolved payment issue."
// CTA: "Reactivate your Aiva"
```

**`subscription-reactivated.tsx`** - sent after successful payment recovery:
```tsx
// Props: { firstName: string; workerName: string; portalUrl: string }
// Subject: "Your Aiva is running again"
// Content: "Payment resolved. [workerName] is active and ready."
// CTA: "View your Aiva"
```

**`escalation-resolved.tsx`** - sent to workspace owner after VA resolves an escalation:
```tsx
// Props: { firstName: string; workerName: string; escalationReason: string; resolutionNote: string; portalUrl: string }
// Subject: "A conversation was handled by your VA team"
// Content: "[workerName] escalated a conversation. Your VA team resolved it."
//   Reason: [reason], Resolution: [note]
// CTA: "View conversation"
```

**`password-reset.tsx`** - password reset link:
```tsx
// Props: { resetUrl: string; expiresInMinutes: number }
// Subject: "Reset your password"
// Content: "Click below to reset your password. This link expires in [N] minutes."
// CTA: "Reset password"
// Note: if no password reset flow exists in the auth system, build a simple one:
//   - POST /api/auth/forgot-password { email } -> generates a time-limited token (uuid, 15 min TTL)
//     stored in a password_reset_tokens table, sends this email
//   - GET /reset-password?token=[token] page: shows new password form
//   - POST /api/auth/reset-password { token, newPassword } -> validates token, updates hash, invalidates token
```

**`automation-failed.tsx`** - sent to workspace owner when an automation fails 3 times consecutively:
```tsx
// Props: { firstName: string; workerName: string; automationName: string; scheduleLabel: string; errorMessage: string; portalUrl: string }
// Subject: "Automation failed: [automationName]"
// Content: "The scheduled automation '[name]' for [workerName] failed."
// CTA: "View automation settings"
```

Each template must use the `Layout` component from Step 3.
Each template must have inline styles only (email clients do not support stylesheets).
No external images except those hosted on a reliable CDN.
No tracking pixels in v1.
Every template that is not a transactional necessity (e.g. trial expiry, payment) must have an unsubscribe link pointing to `${APP_URL}/unsubscribe?token=[unsubscribe_token]`.

---

## Step 5: Unsubscribe token system

Add to `users` table:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_unsubscribe_token UUID DEFAULT gen_random_uuid();
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_marketing_opt_out BOOLEAN NOT NULL DEFAULT false;
```

Create `GET /api/auth/unsubscribe?token=[token]`:
- Finds the user by `email_unsubscribe_token`
- Sets `email_marketing_opt_out = true`
- Returns a simple HTML page: "You have been unsubscribed from non-essential emails."

In `sendEmail`, before sending non-transactional emails, check `email_marketing_opt_out`. If true, skip.
Transactional emails (payment, account security) bypass this check.

---

## Step 6: Password reset flow

If not already implemented in the existing auth system:

Add to DB:
```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON password_reset_tokens(token) WHERE used_at IS NULL;
```

Core backend routes:
- `POST /api/auth/forgot-password` - creates token, sends `password-reset.tsx` email
- `POST /api/auth/reset-password` - validates token (not expired, not used), updates password hash, marks token used

Next.js pages:
- `src/app/(auth)/forgot-password/page.tsx` - email input form
- `src/app/(auth)/reset-password/page.tsx` - new password form (reads `?token=` from URL)

---

## Step 7: Wire triggers

Wire each email send to its event. Do not throw if sendEmail fails.

| Event | File | Where to call |
|-------|------|---------------|
| Registration complete | auth route | after user + workspace created |
| Aiva created (first Aiva only) | aiva-api.ts | after first ai_worker INSERT for workspace |
| Trial expiring 3d | cron job (new) | daily cron, query workspaces with trial_ends_at = NOW() + 3 days |
| Trial expiring 2d | cron job | same cron |
| Trial expiring 1d | cron job | same cron |
| Trial expired | cron job | query workspaces with trial_ends_at < NOW() and status=trialing |
| Payment success | aiva-webhook-handler.ts | invoice.paid event |
| Payment failed | aiva-webhook-handler.ts | invoice.payment_failed event |
| Grace period warning (1d before end) | cron job | query past_due with grace_period_ends_at = NOW() + 1 day |
| Subscription suspended | aiva-billing.ts | inside suspendSubscription() |
| Subscription reactivated | aiva-billing.ts | inside reactivateSubscription() |
| Escalation resolved | admin va queue | after /api/admin/va/queue/:id/resolve |
| Password reset | auth route | POST /api/auth/forgot-password |
| Automation failed x3 | cron-scheduler.ts | after 3 consecutive failures on same automation |

**Trial expiry email cron** (new, add to cron setup):

```typescript
// Run daily at 08:00 UTC
cron.schedule('0 8 * * *', async () => {
  // Query workspaces with trial expiring in exactly 3, 2, or 1 day(s) from now
  const expiring = await db.query(`
    SELECT w.id, u.email, u.first_name, s.trial_ends_at,
           DATE_PART('day', s.trial_ends_at - NOW()) AS days_remaining,
           (SELECT name FROM ai_workers WHERE workspace_id = w.id ORDER BY created_at LIMIT 1) AS worker_name
    FROM workspaces w
    JOIN users u ON u.workspace_id = w.id AND u.is_owner = true
    JOIN aiva_subscriptions s ON s.workspace_id = w.id
    WHERE s.status = 'trialing'
      AND DATE_PART('day', s.trial_ends_at - NOW()) IN (1, 2, 3)
  `);
  for (const row of expiring.rows) {
    await sendEmail({
      to: row.email,
      subject: `${row.days_remaining} day${row.days_remaining > 1 ? 's' : ''} left on your Aiva trial`,
      template: <TrialExpiringEmail
        firstName={row.first_name}
        daysRemaining={row.days_remaining}
        workerName={row.worker_name}
        upgradeUrl={`${process.env.APP_URL}/billing/aiva`}
        trialEndsAt={row.trial_ends_at}
      />,
    });
  }
});
```

---

## Step 8: Preview server (development only)

React Email includes a preview server. Add to `package.json` scripts:
```json
"email:preview": "email dev --dir src/email/templates --port 3100"
```

Running `npm run email:preview` opens a local browser preview of all templates with hot reload.
This is only for development; it is not deployed.

---

## Done When

- [ ] `resend` and `@react-email/components` installed in core backend
- [ ] `src/email/email-service.ts` exists; `RESEND_PREVIEW_MODE=true` logs to console instead of sending
- [ ] `src/email/components/Layout.tsx` renders with header, content slot, and footer
- [ ] All 12 templates built with inline styles and correct props
- [ ] Welcome email fires after registration
- [ ] Aiva created email fires after first worker created for a workspace
- [ ] Trial expiry cron fires at 08:00 UTC daily; sends correct template at 3d, 2d, 1d
- [ ] Trial expired email fires when trial_ends_at passes
- [ ] Payment success email fires on `invoice.paid` Stripe event
- [ ] Payment failed email fires on `invoice.payment_failed` Stripe event
- [ ] Grace period warning email fires 1 day before grace_period_ends_at
- [ ] Subscription suspended email fires inside `suspendSubscription()`
- [ ] Subscription reactivated email fires inside `reactivateSubscription()`
- [ ] Escalation resolved email fires after VA marks escalation resolved
- [ ] Password reset: `POST /api/auth/forgot-password` creates token and sends email
- [ ] Password reset: `POST /api/auth/reset-password` validates token and updates password
- [ ] Automation failed email fires after 3 consecutive failures on same automation
- [ ] Unsubscribe token generated for every user; GET /api/auth/unsubscribe sets opt_out flag
- [ ] Non-transactional emails skipped for opted-out users
- [ ] DNS records documented in VPS-SETUP.md
- [ ] `npm run email:preview` starts preview server
- [ ] `sendEmail` never throws; email failure is logged and execution continues
- [ ] No em dashes in any email copy
- [ ] No emojis in any email copy or subject lines
