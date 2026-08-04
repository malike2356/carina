---
sidebar_position: 7
title: Customer handoff
description: Hand a branded Carina workspace to your client with clear support boundaries.
---

# Customer handoff

Handoff is when your client takes day-to-day ownership of their branded workspace. Define what they control and what you retain as operator.

## Before handoff

| Item | Operator action |
| --- | --- |
| Brand | Product name, logo, support email verified on client URL |
| Domain | DNS verified; canonical host set if using custom domain |
| Keys | Client BYOK keys in vault, or documented key rotation plan |
| Packs | Vertical bundles installed and tested with sample prompts |
| Users | Client owner account created; your test accounts removed or demoted |
| Billing | Client knows who invoices them (you vs platform) |

## Handoff checklist (client-facing)

Send your client this list:

1. **Sign in** at your branded URL (not `app.carinaai.uk` if you use a custom domain).
2. **Add API keys** under Settings if they own model spend (BYOK).
3. **Open Skill packs** and confirm the vertical bundle you sold is enabled.
4. **Start chat** with a realistic task from their industry.
5. **Bookmark** your support email from the login footer or brand settings.

## Support boundaries

| Topic | Client contacts | Operator handles |
| --- | --- | --- |
| Forgot password | Your support or app reset flow | Auth config |
| Model errors / quota | Their provider dashboard | Key hints only, not raw keys |
| Wrong brand on login | You | DNS, brand JSON, cache |
| Agent quality / packs | You first | Pack install, prompts |
| Platform outage | You escalate to Carina | VERLOX hosted status |
| Scout security alerts | You or client per contract | Scout console pairing |

## What clients should not expect

- Direct access to `core.carinaai.uk` unless you explicitly grant operator training
- Kernel source changes without a change request to you
- Shared sender email with other tenants on hosted cloud

## Documentation to share

Point clients to your branded docs build or these user guides:

- [Getting started](/docs/user/getting-started) (generic Carina tasks)
- [Carina Cloud](/docs/user/carina-cloud) (browser workspace; Scout is separate if used)
- Your vertical playbook if you ship one

Hide internal runbooks (deploy scripts, ops tokens, docker compose paths).

## After handoff

- Schedule a 30-day check-in for usage and pack fit.
- Review audit log if the client has compliance requirements.
- Keep `OPS_DOCKER_PROJECTS` scoped if you host multiple brands on one VPS.

## Related

- [Branding](/docs/user/white-label/branding)
- [Support and troubleshooting](/docs/user/white-label/support-and-troubleshooting)
