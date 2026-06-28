# Sprint 7 - Simplified Customer Onboarding Wizard (app.carinaai.uk)

**Status: COMPLETED 2026-06-25**

**What was built:**
- `OnboardingClientSimple.tsx`: 3-step wizard (role pick with 250ms auto-advance, name, channel + hire)
- `onboarding/page.tsx`: imports `OnboardingClientSimple` instead of `OnboardingClient`
- `(onboarding)/layout.tsx`: passthrough layout so the simple wizard owns its own header and step counter
- POST `/api/aiva/workers` maps prompt fields to core API (`templateId`, `roleDescription`, `channelBindings`)
- PATCH `/api/workspace/onboarding-complete` on success before redirect to `/dashboard`

## Context and what already exists

The customer app at `03-frontends/client-apps/app.carinaai.uk/` already has a 6-step
onboarding wizard at:

```
src/app/(onboarding)/onboarding/OnboardingClient.tsx  (742 lines)
```

The 6 steps are: business name and sector, role template picker, Aiva name, channel
selection, a "hiring" spinner, and a celebration screen.

The existing wizard works but has too many steps and asks questions that block progress
(business name, sector) before the user has any reason to care. The goal is to replace
this with a 3-step flow that gets a non-techy customer from the onboarding page to their
first Aiva in under 2 minutes.

## What to build

Create a new component at:

```
src/app/(onboarding)/onboarding/OnboardingClientSimple.tsx
```

Replace the import in the onboarding page with `OnboardingClientSimple`. The old
`OnboardingClient.tsx` can remain for now; do not delete it.

The new wizard has three steps. Use a local `step` state (1, 2, 3). No routing between
steps; everything renders in one page with a simple step counter at the top.

---

### Step 1: What does your Aiva do?

Heading: "What will your Aiva help with?"

Sub-heading: "Pick the one that fits best. You can adjust this later."

Show 6 role cards in a 2x3 grid (or 3x2 on mobile). Each card is a large tap target
(minimum 80px tall) with an icon, a label, and a one-line description. Use the same role
templates from the existing wizard:

| Template ID | Label | Description |
|---|---|---|
| `customer-support` | Customer Support | Answers enquiries around the clock |
| `outreach-coordinator` | Outreach | Qualifies leads and books calls |
| `property-manager` | Property | Handles tenant and landlord queries |
| `financial-analyst` | Finance | Answers accounts and finance queries |
| `content-assistant` | Content | Drafts copy and handles requests |
| `calendar-manager` | Operations | Tracks tasks and coordinates teams |

Import the same lucide-react icons already used in `OnboardingClient.tsx`:
`Headphones`, `Send`, `Building2`, `TrendingUp`, `PenLine`, `Settings2`.

Selecting a card:
- Highlights it (amber border, amber background tint)
- Auto-advances to step 2 after 250ms (no "Next" button needed)

---

### Step 2: Give your Aiva a name

Heading: "What should we call them?"

Pre-fill the name input with a sensible default based on the role chosen in step 1:

| Template | Default name |
|---|---|
| customer-support | Aria |
| outreach-coordinator | Alex |
| property-manager | Mia |
| financial-analyst | Sam |
| content-assistant | Leo |
| calendar-manager | Dana |

The user can clear and retype. Name validation: non-empty, 2-50 characters.

One button: "Continue" - advances to step 3.

No "Back" button. If users need to go back, they can refresh; this flow prioritises
forward momentum over navigation flexibility.

---

### Step 3: How will customers reach your Aiva?

Heading: "How will customers contact them?"

Sub-heading: "Pick one to start. You can connect more channels after setup."

Four channel options as large cards (same tap-target pattern as step 1):

| Channel ID | Label | Note |
|---|---|---|
| `web` | Web chat | We add a chat widget to your website |
| `whatsapp` | WhatsApp | Connect your WhatsApp Business number |
| `email` | Email | Use your existing business inbox |
| `slack` | Slack | Deploy inside your Slack workspace |

For channels that need an identifier (WhatsApp, email, Slack), show a text input
immediately below the selected card:

- WhatsApp: label "Your WhatsApp Business number", placeholder "+44 7700 900000", type `tel`
- Email: label "Your business email address", placeholder "support@yourcompany.com", type `email`
- Slack: label "Your Slack workspace URL", placeholder "yourcompany.slack.com", type `text`
- Web: no input needed

Button: "Hire your Aiva" (primary CTA). Disabled while submitting.

---

### Submission

On "Hire your Aiva":

1. Set a `submitting` flag, disable the button, change label to "Setting up..."
2. POST to `/api/aiva/workers` with:
   ```json
   {
     "name": "<step 2 name>",
     "roleTemplate": "<step 1 template id>",
     "channels": [
       {
         "type": "<channel id>",
         "identifier": "<identifier or null>"
       }
     ]
   }
   ```
3. On success: redirect to `/dashboard` (or `/` if dashboard does not exist as a named route).
4. On error: show the API error message inline below the "Hire" button. Do not crash. Do not
   redirect. Let the user try again.

---

### Step counter

At the top of the wizard, show a minimal step indicator:

```
Step 1 of 3  |  Step 2 of 3  |  Step 3 of 3
```

A simple set of three dots or a "Step N of 3" text line is enough. No animated progress
bars. Match the existing app.carinaai.uk Tailwind theme.

---

## Styling constraints

- Match the existing theme in `app.carinaai.uk`. Use whatever color tokens and class
  patterns you see in `OnboardingClient.tsx`. Do not introduce new dependencies.
- Amber or cyan accent for selected states, matching what the existing wizard uses.
- No emojis anywhere. No em dashes.
- All copy follows Carina voice: direct, calm, no exclamation marks.

---

## Copy constraints (REUSE-RULES.md applies)

- No competitor product names in any user-visible string
- "Aiva" is capitalised in user-facing copy
- The word "hire" is intentional: "Hire your Aiva" is the brand CTA. Keep it.
- Do not add disclaimers or legal copy; that belongs on the signup step, not here

---

## What NOT to build

- Do not rebuild business name or sector fields. They are removed intentionally.
- Do not add a celebration/confetti screen. The redirect to dashboard is the reward.
- Do not add a spinner screen between step 3 and submission. Show state inline on the button.
- Do not add email validation beyond type="email". The API validates properly.

---

## Done when

- 3-step flow renders at the onboarding route
- Step 1 auto-advances on role selection after 250ms
- Step 2 pre-fills the name from the chosen role
- Step 3 shows identifier input only for channels that need one
- Submit calls `POST /api/aiva/workers` with the right shape
- On success, user is redirected to `/dashboard`
- On error, error is shown inline and user can retry
- TypeScript compiles: `pnpm build` passes with no errors
- No import of `OnboardingClient.tsx` remains in the onboarding page (old file stays, just
  unused)

## Post-build (MANDATORY)

See `POST-BUILD-CHECKLIST.md` in this directory. Move this file to
`02-archived_prompts/archives_from_pending_prompts/` when done.
