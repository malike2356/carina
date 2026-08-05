# 12: Persona playbook and Jakstar instructions

**Status:** PENDING
**Priority:** P0
**Depends on:** 01-09
**Unlocks:** 13

## Goal

Jakstar’s persona / skill pack encodes the outreach playbook so natural language instructions ("start Monday scrape, hit Sunday target, book discovery Zooms") map to the tools and automations built in 02-11.

## Why

Without a playbook, the model improvises or claims success without tools. With it, Telegram instructions stay reliable.

## Reuse first

- Worker `personaPrompt` / skill packs
- Documents vault playbooks
- `mandatory-tools` / process-message guidance patterns
- Spinnable parity store patterns for multi-step jobs

## Requirements

1. Write playbook Document: "Salesgrid outreach playbook" covering ICP, tone, caps, booking, reminders, Kanban stages, when to escalate to Jak.
2. Update Jakstar persona to:
   - Prefer tools over claims
   - Always approval-gate cold email until policy says otherwise
   - Bias interested replies to discovery booking, not price dumps
   - Ask meeting outcomes after calls
3. Few-shot owner utterances:
   - Monday lead find
   - Set weekly target
   - Pause / resume
   - Log meeting won
4. Safety: no fabricated leads, no send without grant, no calendar create outside windows.
5. Keep copy ASCII punctuation rules (no em/en dashes, no emoji).
6. Optional skill pack file in Core if that is how other Aiva verticals ship.

## Acceptance criteria

- [ ] Persona + Document exist on Jakstar workspace.
- [ ] Golden utterance list (10+) each maps to expected tool chain in eval notes (link to 13).
- [ ] Persona never instructs shell-exec or bypass of approvals.

## Deploy

DB/persona update + Documents; Core only if skill pack code ships.
