# Sprint 4 - Prompt 04: Onboarding and First Launch (app.carinaai.uk)

**Sprint:** 4 - AI Employee
**Prompt number:** 04 of 04
**Name:** Aiva onboarding wizard and first launch experience
**Primary agent:** Cursor
**Estimated hours:** 8-12 h
**Depends on:** Prompt 03 (Aiva brain API must be deployed so the wizard can call POST /api/aiva/workers)

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `internal/prompts/archived_prompts/pending_prompts/sprint-4/ai-employee/`.

Full checklist: `internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

---

## Read First

Before writing a single line, read these files in full:

1. `frontends/client-apps/app.carinaai.uk/src/app/(auth)/register/` - the existing register page; understand its form, submit handler, and post-registration redirect
2. `frontends/client-apps/app.carinaai.uk/src/app/(auth)/login/` - the existing login page
3. `frontends/client-apps/app.carinaai.uk/src/lib/auth.ts` - the auth helpers used by the existing pages
4. `frontends/client-apps/app.carinaai.uk/src/lib/session.ts` - how sessions are created and read
5. `frontends/client-apps/app.carinaai.uk/src/middleware.ts` - the existing middleware; you will extend it
6. `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/billing/page.tsx` - workspace page pattern
7. `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/aiva/page.tsx` - the hire page built in prompt 02 (read it before implementing the wizard so they are consistent)
8. `frontends/client-apps/app.carinaai.uk/src/app/api/aiva/workers/route.ts` - the proxy route for creating workers
9. `frontends/client-apps/app.carinaai.uk/src/components/billing/PlanCard.tsx` - card component pattern

---

## Context

The landing page at `carinaai.uk/aiva/` drives new users to `https://app.carinaai.uk/aiva`. A
brand-new user arriving there has never seen the portal. They need to register, configure their
first Aiva, and receive its first message - all inside a single guided flow that delivers on the
"3 minutes from description to ready" promise from the landing page.

The existing `(auth)/register` and `(auth)/login` pages handle credential creation. This prompt
DOES NOT replace them. It hooks into the post-registration redirect and inserts an onboarding
wizard between registration and the workspace.

After the wizard, the user lands on the Aiva detail page (`/aiva/workers/[id]`) with their first
Aiva running and a trial subscription provisioned. The workspace is fully functional from that
point.

The trial gives every new account:
- 15 days free
- 1 Aiva slot
- All features except white-labelling

There is no payment required during the trial. The upgrade prompt appears 3 days before expiry.

---

## Step 1: Trial provisioning on registration

Modify the post-registration server action or API route to provision a trial subscription
immediately after account creation.

After the user account and workspace are created (existing flow), call:

```
POST /api/aiva/subscription/trial
Body: { workspaceId }
```

This is a new Next.js API route (Step 2 below). It calls the core backend to insert an
`aiva_subscriptions` row with `plan_tier: 'trial'` and `trial_ends_at: NOW() + 15 days`.

Do NOT block the registration flow on this call. If it fails, log the error and continue.
The trial can be provisioned on the next request if the row is missing.

---

## Step 2: Trial subscription API route

Create: `src/app/api/aiva/subscription/trial/route.ts`

```typescript
// POST - provision a 15-day trial for a workspace
//        Requires authenticated session (use requireWorkspace from @/lib/session)
//        If aiva_subscriptions row already exists for this workspace, return 200 without
//        creating a duplicate
//        Proxies to CARINA_CORE_URL/api/aiva/subscription/trial
//        Returns { trialEndsAt: string; slotLimit: number }
```

Create: `src/app/api/aiva/subscription/status/route.ts`

```typescript
// GET - return the current Aiva subscription status for the workspace
//       Response: {
//         planTier: 'trial' | 'starter' | 'team' | 'business' | 'suspended',
//         status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled',
//         trialEndsAt: string | null,
//         trialDaysRemaining: number | null,
//         slotLimit: number,
//         aivasUsed: number,
//         canHireMore: boolean,
//       }
```

Add these to the core backend in `aiva-api.ts` (part of prompt 03):

```
POST /api/aiva/subscription/trial
  Body: { workspaceId }
  Action: upsert aiva_subscriptions with plan_tier='trial', status='trialing',
          trial_ends_at = NOW() + INTERVAL '15 days', aiva_slot_limit = 1
  Response: { trialEndsAt, slotLimit: 1 }

GET  /api/aiva/subscription/status?workspaceId=
  Response: full subscription status object as above
```

The prompt 03 agent should implement these routes in `aiva-api.ts`. If they are not yet built,
add them to the `aiva-api.ts` file as part of this prompt rather than blocking.

---

## Step 3: Post-registration redirect to onboarding

Modify the register page so that after successful account creation:
1. If the request URL contains `?from=aiva` or if `document.referrer` includes `carinaai.uk`:
   redirect to `/onboarding`
2. Otherwise: redirect to the existing workspace landing (no behaviour change for non-Aiva signups)

Store the `from` parameter through the registration form as a hidden field. The landing page CTA
at `carinaai.uk/aiva/` should link to `https://app.carinaai.uk/register?from=aiva`. Codex agent
(prompt 01) must update that link - add a note to prompt 01's "Done When" that the CTA link
should include `?from=aiva`.

Also update the login page: if a user tries to visit `/onboarding` while not authenticated,
middleware redirects them to `/login?next=/onboarding`. After login, they are redirected back
to `/onboarding` if `onboarding_completed_at` is null on their workspace.

---

## Step 4: Onboarding wizard

Create: `src/app/(onboarding)/onboarding/page.tsx`
Create: `src/app/(onboarding)/layout.tsx`

The onboarding layout is a minimal full-screen layout with no sidebar or nav. Just the VERLOX
wordmark in the top-left, a step indicator bar across the top, and the active step centered.

The wizard has six steps. State is held in React (`useState`). No server saves happen until Step
5 (the hire call). The user can go back to any previous step by clicking the step indicator.

**Step indicator** (top of page, all steps):
Small numbered dots or short labels: "Your business | Your Aiva | Name | Channels | Configuring | Done"
Completed steps show a check; current step is highlighted amber; future steps are muted.

---

### Wizard Step 1: Your business

Heading: "Tell us about your business"
Subtext: "We use this to suggest the right Aiva for you."

Fields:
- `businessName` (text, required) - "Your business name"
- `sector` (select, required) - options:
  - Property management
  - Finance and accounting
  - Legal and compliance
  - Sales and outreach
  - Content and marketing
  - Operations
  - Customer support
  - Other

"Continue" button. Validates that both fields are filled.

---

### Wizard Step 2: Choose your Aiva's role

Heading: "What do you need your Aiva to handle?"
Subtext: "Pick a starting point. You can change this at any time."

Six role cards in a 3-column grid (same data as the hire form's template picker in prompt 02).
When a card is selected, it gets a highlighted amber border. The card stores `templateId` and
pre-fills `roleDescription`.

Below the grid, a toggle: "I need something different - describe it myself."
When toggled on: hide the grid, show a `roleDescription` textarea (4 rows).

Pre-select the card that best matches `sector` from Step 1:
- Property management -> Property Manager
- Finance -> Financial Analyst
- Sales -> Outreach Coordinator
- Content -> Content Assistant
- Customer support -> Customer Support
- Everything else -> no pre-selection

"Continue" button.

---

### Wizard Step 3: Name your Aiva

Heading: "What should we call your Aiva?"
Subtext: "This is the name your clients will see. Use a first name that fits your brand."

- `workerName` (text, required) - large input, centered
- Below the input: "Suggested:" followed by 4 clickable name chips that auto-fill the input.
  Names are role-appropriate (e.g., for Property Manager: Alex, Jordan, Sam, Morgan).
  Include a refresh icon that cycles to 4 more suggested names (pre-load 12 total, show 4 at a time).

"Continue" button.

---

### Wizard Step 4: Connect a channel

Heading: "How do your clients reach you?"
Subtext: "Your Aiva will be available on the channels you choose. You can add more later."

Channel cards (same 5 channels as the hire form). Each card has a checkbox and, when checked,
shows a secondary field for the channel identifier:
- WhatsApp: "Your WhatsApp business number" (tel input)
- Email: "Your business email address" (email input)
- Slack: "Your Slack workspace URL" (text input, e.g. mycompany.slack.com)
- Telegram: "Your Telegram bot token" (text input)
- Web chat: no identifier needed; the Aiva is reachable via the workspace chat

At least one channel must be selected. Show an inline error if Continue is clicked with none selected.

Small note below: "You can skip the identifier for now and connect the channel from the Channels
tab after setup. The identifier is only needed to activate the channel."

"Continue" button / "Skip for now" link (skip sets channels to ['web'] with no identifiers).

---

### Wizard Step 5: Configuring your Aiva

No user input. This step fires automatically when Step 4 "Continue" is clicked.

Show a centered full-screen animation:

```
[Large subtle spinner or progress ring, amber]

Configuring your Aiva...

[Step labels appearing one by one, fading in sequentially:]
Building persona...     (0.5s delay)
Loading skills...       (1.0s delay)
Setting up channels...  (1.5s delay)
Almost ready...         (2.0s delay)
```

In the background, call POST `/api/aiva/workers` with:
```json
{
  "roleName": "[workerName] ([role])",
  "roleDescription": "[roleDescription]",
  "templateId": "[templateId or null]",
  "channels": ["[selected channels]"],
  "language": "en-GB"
}
```

The animation runs for a minimum of 2.5 seconds regardless of API response time, so the user
always sees the steps sequence. If the API responds before 2.5s, wait for the timer. If the API
fails, show an error state with a "Try again" button (retries the POST without going back to Step 4).

On success: advance to Step 6 with the returned `worker` object.

---

### Wizard Step 6: Meet your Aiva

Heading: "Meet [workerName]"

Large centered card showing:
- Aiva name and role (large text)
- Channels connected (icon badges)
- A preview of the first message the Aiva will send (fetched from the worker detail or
  generated client-side using the template: "Hi, I am [workerName]. I will handle [role].
  Send me what you need.")

Below the card:

Primary button: "Go to your Aiva" - navigates to `/aiva/workers/[id]`
Secondary link: "Go to your workspace" - navigates to the workspace dashboard

Mark `onboarding_completed_at` on the workspace by calling:
`PATCH /api/workspace/onboarding-complete` (new route, Step 8 below).

Do NOT wait for this call before showing Step 6. Fire it in the background.

---

## Step 5: Middleware - first-launch detection and trial expiry guard

Extend `src/middleware.ts`:

**Onboarding redirect:**
For authenticated requests to any `/(workspace)/` route:
1. Check if the workspace has `onboarding_completed_at = null` (via a lightweight session field
   or a fast DB read; cache this with a short-lived cookie `aiva_onboarding_done=1` after
   completion to avoid a DB read on every request)
2. If onboarding is not complete AND the request is not already going to `/onboarding`:
   redirect to `/onboarding`

**Trial expiry guard:**
For authenticated requests to `/(workspace)/aiva/*`:
1. Check subscription status (via the session or a cached cookie `aiva_plan_status`)
2. If `status === 'suspended'` or (status === 'trialing' AND trial_ends_at < NOW()):
   redirect to `/billing/aiva` with query `?reason=trial_expired`
3. Otherwise pass through

Do not check subscription status on every request - only on `/aiva/*` routes. Cache the status
in a signed cookie with a 1-hour TTL.

---

## Step 6: Trial countdown banner

Create: `src/components/aiva/TrialBanner.tsx`

A dismissible banner rendered at the top of all `/(workspace)/` pages (add to the workspace
layout). The banner is hidden once dismissed (store in `localStorage`; re-appears 3 days
before expiry even if previously dismissed).

Display conditions and styles:
- `trialDaysRemaining >= 4`: do not render the banner
- `trialDaysRemaining === 3`: amber background, "Your Aiva trial ends in 3 days. [Choose a plan]"
- `trialDaysRemaining === 2`: amber background, "2 days left on your trial. [Choose a plan]"
- `trialDaysRemaining === 1`: red/danger background, "Last day of your trial. [Choose a plan now]"
- `trialDaysRemaining === 0`: red background, "Your trial has ended. Your Aiva is paused. [Choose a plan to reactivate]"

"Choose a plan" links to `/billing/aiva`.
"x" dismiss button hides the banner until the threshold changes.

Fetch subscription status via GET `/api/aiva/subscription/status`. Cache in React state for
the session; do not refetch on every render.

---

## Step 7: Welcome banner on /aiva for users past onboarding

After the wizard completes, the user goes to `/aiva/workers/[id]`. If they later visit `/aiva`
(the hire form page) for the first time after completing onboarding:

Show a one-time welcome banner at the top of the `/aiva` page:
"Your first Aiva is running. Hire another one below, or [view your Aiva] to check its activity."

Show it only if `aivasUsed > 0 AND aivasUsed < slotLimit` and it hasn't been dismissed
(localStorage flag `aiva_welcome_dismissed`).

---

## Step 8: New API routes

**`src/app/api/workspace/onboarding-complete/route.ts`**
```typescript
// PATCH - mark onboarding as complete for the current workspace
//         Sets onboarding_completed_at = NOW() in the workspace/user record
//         Uses requireWorkspace from @/lib/session
```

Add the matching core backend endpoint if the workspace record is managed there:
`PATCH /api/workspace/onboarding-complete` sets the column on the workspace row.

If `onboarding_completed_at` does not exist on the workspace table in the DB, add it:
```sql
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
```

---

## Step 9: Environment variable

Add to `frontends/client-apps/app.carinaai.uk/.env.example`:
```env
NEXT_PUBLIC_LANDING_URL=https://carinaai.uk   # used to detect referral source
```

---

## Done When

- [ ] Visiting `app.carinaai.uk/register?from=aiva` creates an account and redirects to `/onboarding`
- [ ] Visiting `app.carinaai.uk/register` (no param) creates an account and redirects to existing workspace landing (no regression)
- [ ] `/onboarding` renders the 6-step wizard with correct step indicator
- [ ] Step 1 captures business name and sector
- [ ] Step 2 shows 6 role cards; correct card pre-selected for the sector chosen in Step 1
- [ ] Step 3 shows suggested names with refresh cycling; name input auto-fills on chip click
- [ ] Step 4 shows 5 channel cards; selecting each reveals the identifier input; "Skip for now" works
- [ ] Step 5 fires POST `/api/aiva/workers`, shows minimum 2.5s animation with sequential labels
- [ ] Step 6 shows the worker name, role, channels, and first message preview; primary CTA navigates to `/aiva/workers/[id]`
- [ ] `onboarding_completed_at` is set via PATCH after Step 6 renders
- [ ] Middleware redirects unauthenticated `/onboarding` visitors to `/login?next=/onboarding`
- [ ] Middleware redirects authenticated workspace visitors with null `onboarding_completed_at` to `/onboarding`
- [ ] Middleware redirects suspended/expired accounts visiting `/aiva/*` to `/billing/aiva?reason=trial_expired`
- [ ] `TrialBanner` renders correctly at 3, 2, 1, and 0 days remaining with correct colors
- [ ] `TrialBanner` is dismissed by clicking x; reappears at threshold change
- [ ] Trial subscription provisioned via POST `/api/aiva/subscription/trial` on registration
- [ ] GET `/api/aiva/subscription/status` returns correct shape including `canHireMore`
- [ ] Welcome banner renders on `/aiva` for users who completed onboarding; dismissed via localStorage
- [ ] No TypeScript errors in new files
- [ ] No em dashes in any copy or JSX strings
- [ ] No emojis
- [ ] Onboarding wizard is usable on a 375px mobile viewport
