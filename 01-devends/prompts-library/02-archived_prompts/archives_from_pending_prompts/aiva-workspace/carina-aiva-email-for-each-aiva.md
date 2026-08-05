
**Status: COMPLETED 2026-07-26**

**What was built:**
- Hosted email aliases (`aiva_hosted_email_addresses`), auto-provision on worker create
- Cloudflare/Mailgun inbound webhooks + admin proxy route
- `HostedEmailAddressPanel` UI (copy/test)
- Settings loader fix for platform empty `workspace_id` secrets
- Ops docs for Cloudflare and Mailgun inbound

Use this as the implementation prompt.

  # Prompt: Implement frictionless automated email addresses for every Aiva

  You are working in `/opt/lampp/htdocs/verlox`. Follow all `AGENTS.md` instructions. Never use em dashes, en dashes, or emojis. Run `python3 scripts/fix-writing-style.py` before final handoff.

  ## Goal

  Implement a fully automated hosted inbound email system for Aiva so every new AI employee automatically receives a working email address without manual mailbox creation.

  The user experience must be non-technical:

  - When a user hires an Aiva, the Aiva automatically gets an email address.
  - The address should look like `workername-abc123@inbox.hireaiva.co.uk`.
  - The user should not need to understand MX, IMAP, SMTP, OAuth, DNS, forwarding, webhooks, app passwords, or Mailgun.
  - The Aiva detail page should show the address with copy and test controls.
  - Emails sent to that address should land in the workspace Email area and trigger the correct Aiva worker.
  - Gmail, Outlook, and IMAP remain optional advanced connections, not the default flow.

  Use Mailgun inbound routing as the first provider. Do not create one mailbox per Aiva. Use a catch-all inbound route for the domain and map recipient addresses inside our app. This must scale to thousands or millions of Aivas.

  ## Product decision

  Default email setup:

  `{worker-slug}-{short-id}@inbox.hireaiva.co.uk`

  Examples:

  - `ama-9f2a1b@inbox.hireaiva.co.uk`
  - `support-18c42d@inbox.hireaiva.co.uk`
  - `selorm-a21f99@inbox.hireaiva.co.uk`

  This is not a real mailbox per worker. It is an alias-style inbound address handled by Mailgun catch-all route and our database mapping.

  Advanced email setup remains:

  - Connect Gmail
  - Connect Outlook
  - Connect IMAP
  - Bring your own domain forwarding, support-assisted later

  ## Required implementation

  ### 1. Add hosted Aiva email address storage

  In the core backend, add a table for hosted Aiva email addresses.

  Suggested table:

  ```sql
  aiva_hosted_email_addresses
  - id uuid primary key
  - workspace_id uuid not null
  - worker_id uuid not null
  - address text not null unique
  - local_part text not null unique
  - domain text not null
  - provider text not null default 'mailgun'
  - status text not null default 'active'
  - created_at timestamptz not null default now()
  - updated_at timestamptz not null default now()

  Rules:

  - workspace_id and worker_id must scope ownership.
  - address must be globally unique.
  - local_part must be globally unique for the domain.
  - Do not store Mailgun private API keys in this table.
  - Existing workers should be backfillable.

  ### 2. Generate an address automatically for every new Aiva

  Find the worker creation flow in core Aiva provisioning.

  When a worker is created, automatically call a helper like:

  ensureHostedEmailAddressForWorker({
    workspaceId,
    workerId,
    workerName,
  });

  Rules:

  - Generate a human-readable slug from the worker name.
  - Use a short deterministic or random suffix to avoid collisions.
  - Default domain should come from env/config:
    AIVA_HOSTED_EMAIL_DOMAIN=inbox.hireaiva.co.uk

  - Fallback domain for local dev:
    mail.carinaai.uk or localhost.invalid, whichever matches local conventions.

  - If an address already exists for a worker, return it instead of creating another.
  - Retry on collision.
  - Do not require Mailgun API calls per worker. Catch-all routing should handle inbound delivery.

  ### 3. Add lookup by inbound recipient

  Create a function like:

  findHostedEmailAddressByRecipient(toAddress: string)

  It should:

  - Normalize case.
  - Handle display-name formats if needed.
  - Match exact address.
  - Return workspaceId, workerId, address, status.
  - Reject inactive or disabled addresses.

  ### 4. Add Mailgun inbound webhook endpoint

  Implement a backend endpoint for Mailgun inbound route.

  Preferred core route:

  POST /api/aiva/email/inbound/mailgun

  Also support app proxy route if required by the app architecture.

  Mailgun sends form-encoded multipart or urlencoded payloads. Parse at least:

  - recipient
  - sender
  - from
  - subject
  - body-plain
  - body-html
  - Message-Id
  - timestamp
  - token
  - signature
  - attachments if already supported by current parser, otherwise store metadata only for now

  Security:

  - Verify Mailgun webhook signature using MAILGUN_WEBHOOK_SIGNING_KEY.
  - Reject invalid signatures in production.
  - Log sanitized metadata only.
  - Never log message body when it may contain sensitive data.
  - Return 401 on invalid signature.
  - Return 404 or 202 for unknown recipient, depending on existing webhook convention. Prefer 202 with logged ignored event to avoid retries for spam to random addresses.
  - Rate-limit if existing middleware exists.

  Processing:

  1. Parse inbound payload.
  2. Extract recipient.
  3. Map recipient to hosted Aiva address.
  4. Insert inbound message into the workspace email store.
  5. Trigger the worker email ingestion path so the Aiva can triage or draft a response.
  6. Respect sender allowlist rules if configured.
  7. If blocked by sender policy, store as ignored/spam or log safely according to existing patterns.
  8. If accepted, make it visible in Email/Inbox.

  ### 5. Reuse existing email processing where possible

  Search the codebase for:

  - workspace-email-api
  - emailMessages
  - aivaEmailRouter
  - email approval
  - processAivaMessage
  - email-draft-handler
  - imap-connector
  - EmailApprovalInbox

  Do not create a parallel inbox if an existing email table and approval flow exists. Integrate with it.

  The hosted inbound email should behave like any other inbound email source.

  ### 6. Add API endpoint for UI to fetch the Aiva hosted address

  Add endpoint:

  GET /api/aiva/workers/:id/email-address

  Response:

  {
    "address": "ama-9f2a1b@inbox.hireaiva.co.uk",
    "status": "active",
    "provider": "mailgun"
  }

  Add endpoint:

  POST /api/aiva/workers/:id/email-address/test

  It should create or send a safe test event. If actual outbound test email is not available locally, create a simulated inbound record in non-production only.

  ### 7. Add frontend UI

  In the Aiva worker detail page, add a simple Email Address panel.

  The panel must show:

  - The hosted address
  - Copy button
  - Status badge
  - Send test email button
  - Plain non-technical copy

  Suggested UI copy:

  Email address
  Send tasks, customer messages, PDFs, and instructions to this address.

  ama-9f2a1b@inbox.hireaiva.co.uk

  Buttons:

  - Copy
  - Send test

  Advanced section:

  Use my existing mailbox
  Connect Gmail, Outlook, or IMAP if you want Aiva to read and reply from an existing business mailbox.

  Important:

  - Do not make the user configure Mailgun.
  - Do not show webhook URLs by default.
  - Do not show MX/DNS instructions in the normal Aiva worker flow.
  - Technical setup can live in admin or docs only.

  ### 8. Admin and ops configuration

  Add env vars to .env.example only, with no secrets:

  AIVA_HOSTED_EMAIL_ENABLED=true
  AIVA_HOSTED_EMAIL_DOMAIN=inbox.hireaiva.co.uk
  AIVA_HOSTED_EMAIL_PROVIDER=mailgun
  MAILGUN_WEBHOOK_SIGNING_KEY=

  Add ops/admin status if there is an existing health/config screen:

  - Hosted email enabled
  - Domain configured
  - Mailgun signing key present
  - Last inbound webhook received
  - Unknown recipient count if easy

  Do not paste real keys.

  ### 9. Mailgun setup docs for operator only

  Add a short operator doc explaining the one-time Mailgun setup.

  Required Mailgun setup:

  1. Add domain: inbox.hireaiva.co.uk
  2. Configure DNS records Mailgun provides:
      - MX
      - SPF
      - DKIM
      - tracking CNAME if needed

  3. Create a catch-all inbound route:
      - Match recipient: .*@inbox.hireaiva.co.uk
      - Action: forward webhook to:
        https://admin.hireaiva.co.uk/api/aiva/email/inbound/mailgun
        or the correct production core/app endpoint after inspecting routing.

  4. Set MAILGUN_WEBHOOK_SIGNING_KEY in production.
  5. Send a test email to a generated Aiva address.

  The docs must explain that this scales because Mailgun catches all recipients and the app maps addresses in the database. We do not create individual Mailgun mailboxes per Aiva.

  ### 10. Backfill command

  Add a CLI/admin script or API-safe function to backfill hosted addresses for existing Aivas.

  Example command:

  pnpm carina aiva:email-addresses:backfill

  or use the repo’s existing CLI pattern.

  It should:

  - Find all active workers without hosted email addresses.
  - Generate addresses.
  - Print counts only.
  - Avoid printing user message content or secrets.
  - Be idempotent.

  ### 11. Tests

  Add tests for:

  - Address generation slug and collision retry.
  - Existing worker returns same address.
  - Lookup by recipient is case-insensitive.
  - Mailgun signature verification accepts valid signatures.
  - Mailgun signature verification rejects invalid signatures.
  - Unknown recipient does not crash.
  - Inbound accepted email is stored with correct workspaceId and workerId.
  - Worker creation automatically provisions hosted email.
  - UI/API endpoint returns hosted address.
  - Backfill is idempotent.

  Run:

  pnpm exec vitest run
  pnpm exec tsc --noEmit
  python3 scripts/fix-writing-style.py

  If full tests are too slow, run the targeted tests first, then run full Vitest before handoff.

  ## Acceptance criteria

  This is done only when:

  - A newly created Aiva automatically has a hosted email address.
  - No manual Mailgun mailbox creation is needed per Aiva.
  - Sending email to the address maps to the correct worker.
  - Non-technical users only see an email address and a copy button.
  - Existing Gmail, Outlook, and IMAP setup remains available under advanced connection.
  - Mailgun webhook signature is verified.
  - Full test suite passes.
  - TypeScript passes.
  - Writing style scan passes.
  - No secrets are printed or committed.

  ## Important implementation notes

  - Do not create real Mailgun routes per Aiva. Use one catch-all route.
  - Do not create a mailbox per Aiva.
  - Do not require users to set DNS.
  - Do not expose Mailgun, webhook, token, IMAP, SMTP, MX, or DNS language in the default user flow.
  - Keep the product language simple: “Your Aiva has an email address.”
  - Treat hosted email as the default channel.
  - Treat Gmail/Outlook/IMAP as optional advanced mailbox integrations.


  Mailgun is suitable for this because you can use one inbound catch-all route for the whole subdomain. That means one-time domain setup, then every new Aiva can get an address automatically from your database. You do not manually create a million mailboxes.

 

