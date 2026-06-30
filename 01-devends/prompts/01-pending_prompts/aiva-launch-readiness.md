# Carina Aiva - Launch Readiness Prompt

## Purpose

Aiva is the most built product in the Verlox ecosystem. The backend exists, Scout
is integrated, multi-tenant architecture is running. But "code exists" and "product
is ready for a paying customer" are different things.

This prompt defines the exact state Aiva must reach before the first paid customer
is onboarded. It is a readiness gate, not a build prompt. Work through each section.
When all acceptance criteria are met, Aiva is ready.

**Pricing reference:** `pricing-strategy.md` (Starter £149/mo, Growth £349/mo,
extra seat £49/mo, Scout Govern bundled). Run `scripts/stripe-setup-aiva.ts` in
test mode before Section 2.

---

## Section 1: Legal (No Technical Work Required)

These must be done BEFORE any customer sees Aiva.

- [ ] LEGAL_PLACEHOLDER_CHECKLIST.md is fully complete. All `[TO BE INSERTED]` values
      filled across all three Aiva legal documents.
- [ ] Verlox Ltd company number appears in Terms of Service and Privacy Policy.
- [ ] Registered address appears in all three documents.
- [ ] Email provider sub-processor is named in Privacy Policy and DPA.
- [ ] Effective dates are set (the date the documents go live on the website).
- [ ] A UK solicitor has reviewed the DPA (Article 28 obligations are significant).
- [ ] Legal documents are published at `carinaai.uk/legal/terms`, `carinaai.uk/legal/privacy`,
      `carinaai.uk/legal/dpa`.
- [ ] Legal acceptance gate (see `legal-acceptance-gate.md` pending prompt) is live.
      No user can use the product without accepting Terms and Privacy Policy.

---

## Section 2: Billing (Must Work Before Accepting Money)

- [ ] Stripe account is active for Verlox Ltd.
- [ ] Stripe products created via `tsx scripts/stripe-setup-aiva.ts` (Starter, Growth, seat add-on).
- [ ] Price IDs copied to core `.env` (`STRIPE_PRICE_AIVA_*`).
- [ ] AI Employee seat product configured (`STRIPE_PRICE_AIVA_SEAT_MONTHLY`).
- [ ] Stripe webhook live at `https://core.carinaai.uk/api/billing/stripe/webhook`
      (test with `stripe listen --forward-to localhost:PORT/api/billing/stripe/webhook`).
- [ ] Checkout flow tested end-to-end with a test card: Starter subscription, upgrade to
      Growth, add a seat, cancel subscription.
- [ ] Customer portal configured (customers can update card, view invoices, cancel).
- [ ] UK VAT (20%) configured for digital services.
- [ ] Receipt/invoice emails configured and landing in inbox (not spam).
- [ ] On successful checkout: workspace is provisioned, AI Employee quota is set, and
      Scout Govern is automatically linked.

---

## Section 3: Scout Bundling (Required Before AI Employees Go Live)

- [ ] Scout Govern workspace is automatically provisioned for every paid Aiva account.
- [ ] Scout API key is stored in Aiva's credential vault per workspace (not plaintext).
- [ ] Scout heartbeat runs every 60 seconds per workspace when enabled.
- [ ] Scout governance settings panel is visible in Aiva workspace sidebar.
- [ ] Kill switch from Scout console suspends AI Employee and queues (not drops) its
      pending triggers within 60 seconds.
- [ ] Scout event queue drains successfully when Scout is temporarily unavailable,
      with events delivered once Scout reconnects.

---

## Section 4: AI Employees (MVP Version, Not Full Spec)

For launch, one AI Employee type must work reliably before others are built.

**MVP Employee type: Email Handler**

An Email Handler monitors an IMAP mailbox, categorises incoming emails, and drafts
responses for human approval before sending.

- [ ] Admin can create an Email Handler employee with: name, persona, IMAP mailbox,
      approval configuration.
- [ ] Email Handler connects to IMAP mailbox and polls for new messages every 5 minutes.
- [ ] On new email: categorise (client query, invoice, spam, urgent). Log category.
- [ ] For client query emails: draft a response using the employee's persona.
- [ ] Draft presented in approval inbox: subject, draft body, recipient.
- [ ] Workspace owner can Approve (send immediately), Reject, or Edit then Approve.
- [ ] On Approve: email sent via SMTP. Task logged. Scout event streamed.
- [ ] On no action within 4-hour timeout: email is flagged but NOT sent automatically.
- [ ] Scout audit trail shows: email received, draft created, approval requested,
      decision made, email sent (or timeout). All timestamped.

Do NOT build: outbound triggering, CRM integration, calendar actions, or multi-step
workflows for launch. The Email Handler MVP must work reliably first.

---

## Section 5: Infrastructure and Reliability

- [ ] Aiva is deployed on the Contabo VPS (`aman`) with TLS on `carinaai.uk`.
- [ ] `GET https://carinaai.uk/api/health` returns 200 within 500ms.
- [ ] Uptime monitoring is configured (UptimeRobot or similar). Alert to phone and
      email within 5 minutes of downtime.
- [ ] Database backups run daily and are stored off-server (Contabo Snapshots or B2).
- [ ] Backup restore has been tested. Estimate: restore takes under 30 minutes.
- [ ] Error monitoring is configured (Sentry or equivalent). Errors reach inbox within
      5 minutes of occurrence.
- [ ] Rate limiting is in place on all public API endpoints.
- [ ] `CARINA_AIVA_ENV=production` is set. Debug endpoints and admin panels are not
      exposed on the production domain.

---

## Section 6: Onboarding Flow

The first 15 minutes of a new customer's experience determines whether they become
a real user or a churn statistic.

- [ ] Registration: email, password, workspace name. Email verification required.
- [ ] Legal acceptance gate: Terms and Privacy Policy displayed and accepted before
      workspace is accessible. Acceptance is logged with timestamp and IP hash.
- [ ] Billing: Stripe Checkout for chosen plan. Redirect to workspace on success.
- [ ] Scout provisioning: runs in the background. Shows "Setting up governance..."
      spinner. Completes within 60 seconds. No blocking of workspace access.
- [ ] Welcome screen: "Create your first AI Employee." One-step creation for Email Handler.
      Offer to import IMAP credentials. Pre-fill a sensible default persona.
- [ ] First approval: within the onboarding flow, show a simulated approval inbox item
      so the customer sees the approval workflow before their first real email arrives.
- [ ] Help: link to docs from every empty state. `carinaai.uk/docs` must have a
      quickstart guide written before launch.
- [ ] Confirmation email: "Your workspace is ready. Here is how to set up your AI Employee."

---

## Section 7: Support Capacity

- [ ] `contact@verlox.uk` is monitored at least once per business day.
- [ ] In-app support link points to a contact form or chat widget.
- [ ] A FAQ covering: "How do I connect my email?", "What does the AI Employee do
      with my emails?", "What is Scout?", "How do I cancel?" is published before launch.
- [ ] Response time commitment is documented (recommend: 1 business day for Starter,
      same day for Growth).

---

## Section 8: First Customer Profile

The first Aiva customer should be carefully chosen, not the first person who signs up.

Ideal first customer:
- A known contact, not a cold lead.
- A small professional services firm (IFA, property management, accountancy).
- Willing to give honest feedback and not churn immediately if something breaks.
- Does not have IT staff who will ask difficult infrastructure questions.
- Volume: at least 20-30 client emails per week (enough to test the workflow meaningfully).

Avoid as first customer:
- Large enterprises with procurement processes and IT security reviews.
- Pure tech companies (they will have opinions about the implementation).
- Anyone who was promised features that are not yet built.

---

## Acceptance Criteria for Aiva Launch Readiness

- Legal documents are live on the website with no placeholder values.
- A test customer can sign up, pay, create an Email Handler employee, receive an
  email, see the draft, approve it, and confirm it was sent - end to end.
- Scout governance shows the full audit trail of that email's journey.
- A kill switch test: suspend the Email Handler from Scout console, confirm it stops
  processing, resume it, confirm it catches up on queued emails.
- Uptime monitoring is active and alerts are tested.
- Backups are configured and a restore test has been run.
- Founder has used the product themselves for at least one real week before
  showing it to any customer.
