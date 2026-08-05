# Prompt 03: TUI or Keprix TUI as Carina client

Status: PENDING  
Series: Carina-Keprix parity inbound  
Severity: HIGH  
Depends on: 00  
Writing style: plain ASCII only (no em/en dashes, no emoji).

## Why this exists

Carina CLI is thin; Keprix Textual TUI is a full Command Center.

## Goal

Owner choice in Must: either (A) integrate Keprix TUI as authenticated client against Carina APIs, or (B) grow `carina-cli` toward a minimal Textual port of session/tools/status. Record decision in prompt progress.

## Must-haves

1. Decision section filled by implementing agent after owner preference if unclear (default A if faster).
2. Working local demo path documented.
3. No nested carina/verlox copy of TUI tree; dependency or thin adapter only.

## Acceptance

- [ ] Operator can chat/tool from terminal against a Carina backend.
