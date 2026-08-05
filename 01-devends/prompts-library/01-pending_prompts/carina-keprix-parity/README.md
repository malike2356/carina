# Carina / Aiva: adopt Keprix strengths (parity inbound)

**Updated:** 2026-08-04  
**Status:** PENDING (programme)  
**Source gap doc:** `/opt/lampp/htdocs/verlox/archive/keprix-carina-parity-gap-2026-07-30.md`  
**Sister programme (Keprix inbound):** `keprix/1st-plan/1st-prompt/pending-prompts/keprix-carina-parity/`

## Problem

Keprix leads on TUI/Command Center, MCP client, subagents/delegation, full voice, multi-backend memory, browser tools, and upgrade lifecycle. Carina/Aiva should adopt behavioural patterns without nesting repos or inventing a second runtime. Aiva remains a product surface on Carina (soft separation).

## Canonical Carina paths only

- `/opt/lampp/htdocs/verlox/carina/02-backends/`
- `/opt/lampp/htdocs/verlox/carina/03-frontends/`
- `/opt/lampp/htdocs/verlox/carina/scripts/`

Never create `carina/verlox/`.

## Build order

| # | File | Severity | Status |
|---|---|---|---|
| 00 | `00-overview-and-guardrails.md` | - | PENDING |
| 01 | `01-mcp-client.md` | HIGH | PENDING |
| 02 | `02-subagents-delegation.md` | HIGH | PENDING |
| 03 | `03-tui-or-keprix-client.md` | HIGH | PENDING |
| 04 | `04-voice-multi-provider-phone.md` | MEDIUM | PENDING |
| 05 | `05-vector-memory-backend.md` | MEDIUM | PENDING |
| 06 | `06-browser-tools.md` | MEDIUM | PENDING |
| 07 | `07-self-knowledge-introspection.md` | LOW | PENDING |
| 08 | `08-upgrade-lifecycle.md` | LOW | PENDING |
| 09 | `09-tests-cutover-archive.md` | - | PENDING |

Working gap map:

- `10-gap-closure-list.md`

## Writing / security

Plain ASCII only. Secrets in `/opt/lampp/htdocs/verlox/.access/`. Archive via POST-BUILD-CHECKLIST when done.
