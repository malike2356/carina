# Agent OS QA (prompts 01-09)

Updated: 2026-07-12

## Flag

- `NEXT_PUBLIC_AGENT_OS_GLASS=false` disables `/agent-os` (redirects to `/launcher`).
- Aiva surface: enabled by default.
- Cloud: set `NEXT_PUBLIC_AGENT_OS_GLASS=true`.

## Routes

| Route | Prompt |
| --- | --- |
| `/agent-os` | 01 glass |
| `/agent-os/capabilities` | 02 |
| `/agent-os/usage` | 03 |
| `/agent-os/board` | 04 |
| `/agent-os/memory` | 05 |
| `/agent-os/workflows` | 06 catalog |
| `/agent-os/workflows/hello` | 06 |
| `/agent-os/workflows/content-series` | 07 |
| `/agent-os/workflows/crm-import` | 07 |
| `/agent-os/workflows/video` | 08 |
| `/agent-os/workflows/seo` | 08 |
| `/agent-os/workflows/outreach` | 08 |
| `/agent-os/workflows/onboarding-path` | 09 |

## Staging checks

1. Aiva host 390px: glass full width; next actions tappable (>=44px).
2. Flag off redirects to launcher.
3. Capabilities search + Needs setup filter.
4. Usage empty state Hire CTA; Soft Wall link intact.
5. Board create + move draft/active/paused persists.
6. Memory Galaxy empty CTA; after docs/memories, nodes appear.
7. Hello writes a Documents artifact and sets day-1 progress.
8. CRM clean rejects empty/garbage CSV with actionable error.
9. Video/SEO/outreach produce docs; outreach also creates a draft task.
10. Guardrail strip links Approvals / Billing / Governance.
11. Paste-error tip visible on glass quick links.

## Notes

- Recipes write markdown Documents (deterministic templates) so Soft Wall / keys do not block the first win.
- CRM import cleans and downloads CSV; does not invent HubSpot/Salesforce connectors.
- Board maps to existing scheduled task statuses (draft / active / paused).
