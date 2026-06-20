# Gap 10 - Prompt 04: Subscriptions and Newsletter -- Dual Trigger

> **REUSE RULE:** See `REUSE-RULES.md` in this directory. Implement the behavior described below in Carina's own voice.

**Gap:** 10 Incident Blog
**Prompt number:** 04 of 05
**Name:** Subscriptions and Newsletter
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** Prompt 01 (database + tools)

---

## Read First

Before writing a single line, read:

1. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/api/` -- existing API structure
2. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/tools/email.ts` -- email-send tool
3. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/blog/store.ts` -- subscribe/unsubscribe functions
4. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/blog/types.ts` -- BlogSubscriber

---

## Context

The newsletter can be sent from either interface:
- **Admin UI:** Operator clicks "Send Newsletter" button
- **Carina conversation:** Operator says "Send the newsletter"

Both call the same `sendIncidentNewsletter()` function. Both report the same result format. Both respect the same guard: only published, unsent incidents are included. Both confirm before sending.

Subscriptions are managed through Carina's API. The subscribe form on the incidents page POSTs to Carina. Confirmation and unsubscribe are Carina API endpoints.

---

## Step 1: Carina API Endpoints for Subscriptions

Create `src/api/incident-blog-subscribe.ts`:

```typescript
// POST /api/incident-blog/subscribe
// Public. No auth required.
// CORS: allow labyrinthscout.com
// Body: { email: string }
//
// Flow:
// 1. Validate email format
// 2. Check existing: confirmed -> "Already subscribed."
//                    unsubscribed -> re-subscribe (clear unsubscribed_at)
//                    pending confirmation -> "Check your email."
// 3. Create subscriber record with confirmed=false, random confirm_token (UUID)
// 4. Send confirmation email via Resend
// 5. Return: { subscribed: true, email, message: "Check your email to confirm." }

// GET /api/incident-blog/confirm?token=xxx
// Public. No auth required.
//
// Flow:
// 1. Look up subscriber by confirm_token
// 2. Set confirmed=true, clear confirm_token
// 3. Redirect to: https://labyrinthscout.com/incidents/?subscribed=true
// 4. If token not found: redirect to incidents page with ?error=invalid-token

// GET /api/incident-blog/unsubscribe?email=xxx
// Public. No auth required.
//
// Flow:
// 1. Look up subscriber by email
// 2. Set unsubscribed_at=NOW()
// 3. Redirect to: https://labyrinthscout.com/incidents/?unsubscribed=true
```

GET endpoints for confirm/unsubscribe because email clients prefetch links. POST endpoints trigger false unsubscribes in Apple Mail and Gmail.

Mount these routes in the Carina API router. Ensure CORS allows `labyrinthscout.com`.

---

## Step 2: Confirmation Email

Sent via Carina's Resend integration (same as `src/tools/email.ts`):

```
From: Scout Incident Report <hello@carinaai.uk>
Subject: Confirm your subscription -- Scout Incident Report

Hello,

You subscribed to the weekly Scout Incident Report at labyrinthscout.com/incidents.

Every Sunday, you will receive documented AI agent incidents -- sourced, verified, and with Scout fixes showing how each could have been prevented.

Confirm your subscription:
https://app.carinaai.uk/api/incident-blog/confirm?token=YOUR_TOKEN

If you did not subscribe, ignore this email. You will not receive anything.

Scout Incident Report. A VERLOX product.
```

Plain text, not HTML. Better deliverability for confirmation emails.

---

## Step 3: Shared Newsletter Send Function

Create `src/blog/newsletter-send.ts`:

```typescript
import { pool } from '../memory/db.js';
import { listActiveSubscribers, getUnsentNewsletterIncidents, markNewsletterSent } from './store.js';

export async function sendIncidentNewsletter(): Promise<{
  sent: number;
  skipped: number;
  incidentsIncluded: number;
}> {
  const incidents = await getUnsentNewsletterIncidents();
  if (incidents.length === 0) {
    return { sent: 0, skipped: 0, incidentsIncluded: 0 };
  }

  const subscribers = await listActiveSubscribers();
  if (subscribers.length === 0) {
    return { sent: 0, skipped: 0, incidentsIncluded: incidents.length };
  }

  const html = buildNewsletterHtml(incidents);
  const weekLabel = new Date().toISOString().slice(0, 10);
  const count = incidents.length;
  const subject = `Scout Incident Report -- Week of ${weekLabel} -- ${count} new incident${count > 1 ? 's' : ''}`;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) throw new Error('RESEND_API_KEY not set');

  // Dynamic import to avoid bundling Resend in non-email paths
  const { Resend } = await import('resend');
  const resend = new Resend(resendApiKey);
  let sent = 0;
  let skipped = 0;

  for (const sub of subscribers) {
    try {
      await resend.emails.send({
        from: 'Scout Incident Report <hello@carinaai.uk>',
        to: sub.email,
        subject,
        html,
      });
      await pool.query(
        `UPDATE incident_blog_subscribers SET last_sent_at = NOW() WHERE id = $1`,
        [sub.id]
      );
      sent++;
    } catch (err) {
      skipped++;
      console.error(`[carina:blog] Newsletter failed for ${sub.email}:`,
        err instanceof Error ? err.message : String(err));
    }
  }

  // Mark all incidents as newsletter-sent
  for (const incident of incidents) {
    await markNewsletterSent(incident.id);
  }

  return { sent, skipped, incidentsIncluded: incidents.length };
}
```

---

## Step 4: Triggers from Both Sides

**Admin UI trigger:**

The "Send Newsletter" button calls:

```
POST /admin/incident-blog/newsletter/send
```

Route handler:
1. Calls `getUnsentNewsletterIncidents()` to get the count
2. If count is 0: "No new incidents to send."
3. If count > 0: calls `sendIncidentNewsletter()`
4. Returns result + flash message
5. Redirects back to the incident list

Confirmation dialog in the UI (JavaScript): "Send newsletter to N subscribers? X incidents will be included. This emails real people."

**Carina conversation trigger:**

Operator says "Send the newsletter." Carina uses `blog-newsletter-send` tool which:
1. Checks for unsent incidents: "X unsent published incidents. N subscribers. Send?"
2. Operator confirms
3. Carina calls `sendIncidentNewsletter()`
4. Reports: "Sent to 47. 0 skipped. 3 incidents included."

The tool is marked `dangerous: true, requiresConfirmation: true` -- Carina's tool confirmation gate acts as the human-in-the-loop check.

---

## Step 5: Newsletter HTML Template

Create `src/blog/newsletter-template.ts`:

```typescript
import type { BlogIncident } from './types.js';

export function buildNewsletterHtml(incidents: BlogIncident[]): string;
```

Design requirements:
- Dark theme: `background: #06090f`, green accent `#16c97e`, red damage `#e63946`
- Inline CSS (email client compatibility)
- Table-based layout
- Each incident: title linked to `labyrinthscout.com/incidents/#slug`, company, damage in red, 1-2 sentence summary, "Scout fix:" in green
- Footer: unsubscribe link, "A VERLOX product"
- Preheader text: "N new AI agent incidents documented this week"

---

## Step 6: Subscribe Form on Incidents Page

Added by the page generator (prompt 05). Form POSTs to Carina's API:

```html
<form id="subscribe-form">
  <input type="email" name="email" placeholder="your@email.com" required>
  <button type="submit">Subscribe</button>
</form>
<script>
document.getElementById('subscribe-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.email.value;
  const msg = document.getElementById('subscribe-message');
  try {
    const res = await fetch('https://app.carinaai.uk/api/incident-blog/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    msg.textContent = data.message;
    msg.style.color = 'var(--green)';
    e.target.reset();
  } catch (err) {
    msg.textContent = 'Something went wrong. Try again.';
    msg.style.color = 'var(--red)';
  }
});
</script>
```

Also handles `?subscribed=true` and `?unsubscribed=true` URL params (set by confirm/unsubscribe redirects).

---

## Step 7: Carina Tool Extensions

Extend `src/tools/blog.ts` (from prompt 01):

```typescript
// blog-newsletter-send -- already defined in prompt 01
// blog-subscriber-list -- list all subscribers
// blog-subscriber-stats -- count active, confirmed, unsubscribed
```

---

## Pitfalls

1. **Double-send prevention.** The `newsletter_sent` flag is set inside `sendIncidentNewsletter()`. If two triggers fire simultaneously (admin UI button + Carina conversation), only the first one includes the incidents. The second finds zero unsent. Safe.
2. **Newsletter confirmation.** `blog-newsletter-send` is a dangerous tool. Carina's tool confirmation gate handles the human-in-the-loop. The admin UI uses a JavaScript confirmation dialog. Both ensure the operator knows this emails real people.
3. **Unsubscribe must be one-click.** No login. No password. Click link -> unsubscribed. GDPR and CAN-SPAM requirement.
4. **Confirmation email sender.** `hello@carinaai.uk` must be verified in Resend. If domain changes, re-verify.
5. **Batching for large lists.** Resend may rate-limit. For lists over 500, add batching with delays between sends.

---

## Verification

```bash
# Test subscribe endpoint
curl -X POST http://localhost:3000/api/incident-blog/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check DB
psql -d carina -c "SELECT email, confirmed FROM incident_blog_subscribers;"

# Confirm
curl "http://localhost:3000/api/incident-blog/confirm?token=FROM_DB"

# Unsubscribe
curl "http://localhost:3000/api/incident-blog/unsubscribe?email=test@example.com"

# Test newsletter from Carina
carina blog newsletter send

# Test newsletter from admin UI
# Click "Send Newsletter" button

# Verify both produce same result format
```
