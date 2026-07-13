---
id: 2026-07-13_carina_aiva_cost_workspace_comms_08_whatsapp_web_pairing
title: WhatsApp Web pairing option for Aiva channel setup
product: aiva
capability: whatsapp-channel
status: completed
source: agent-chat
source_chat: 01-devends/prompts-library/source-chats/2026-07-13_carina-aiva-cost-workspace-comms.md
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-aiva-cost-workspace-comms--08-whatsapp-web-pairing-channel.md
repo_paths:
  - 02-backends/core.carinaai.uk/src/channels
  - 03-frontends/client-apps/app.carinaai.uk
  - 03-frontends/client-apps/carinaMobile
  - 03-frontends/marketing/hireaiva.co.uk
depends_on:
  - 2026-07-13_carina_aiva_cost_workspace_comms_05_aiva_direct_employee_comms
tags:
  - whatsapp
  - channels
  - onboarding
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm test
  - Manual QR pairing QA in local or staging environment
---

# WhatsApp Web Pairing Option for Aiva Channel Setup

## What This Builds

A lower-friction WhatsApp setup path alongside official WhatsApp Business API configuration.

## Target Files

- `02-backends/core.carinaai.uk/src/channels/adapters/`
- `02-backends/core.carinaai.uk/src/channels/`
- `02-backends/core.carinaai.uk/src/api/`
- `03-frontends/client-apps/app.carinaai.uk/`
- `03-frontends/client-apps/carinaMobile/`
- `03-frontends/marketing/hireaiva.co.uk/`

## Implementation Prompt

Add two WhatsApp setup options:

1. Official WhatsApp Business API:
   - Best for production scale, compliance, and business messaging.
   - Keep existing setup if present.
   - Improve guidance and explain requirements plainly.

2. WhatsApp Web pairing:
   - Easier for early users and smaller teams.
   - QR or pairing-code based setup.
   - Use Baileys or whatsapp-web.js only after license and maintenance review.
   - Store session credentials securely per tenant.
   - Add reconnect, logout, health, and re-pair flows.
   - Add clear operational warnings: unofficial automation can break when WhatsApp changes; no spam; user remains responsible for account compliance.

Backend requirements:

- Adapter interface supports both `whatsapp_business_api` and `whatsapp_web`.
- Pairing session API.
- QR or pairing-code event stream.
- Secure credential storage.
- Health check.
- Disconnect and revoke.
- Message inbound and outbound tests.
- Rate limits and anti-spam controls.

Frontend requirements:

- Channel setup wizard with two clear cards:
  - "WhatsApp Web, easiest setup"
  - "WhatsApp Business API, best for scale"
- Step-by-step QR or pairing-code flow.
- Troubleshooting state for expired QR, disconnected phone, rate limit, and re-pair.
- Mobile-friendly setup instructions.

## Acceptance Criteria

- Users can choose WhatsApp Web setup without needing Facebook Business API first.
- Official Business API remains available.
- Pairing state is clear and recoverable.
- Session secrets are not logged.
- Anti-spam and tenant isolation exist.
- Documentation explains risks plainly.

## Validation

```bash
cd 02-backends/core.carinaai.uk
pnpm check
pnpm test
rg -n "whatsapp_web|whatsapp_business_api|Baileys|whatsapp-web" src 03-frontends
```

Run manual QR pairing QA in local or staging, then record:

- Pair started.
- QR or code shown.
- Pair success.
- Message received.
- Message sent.
- Reconnect works.
- Logout revokes session.

## Post-build

Archive this prompt after backend, frontend, docs, and manual channel QA are complete.
