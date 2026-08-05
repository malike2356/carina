# Prompt 02: Subagents / delegation

Status: PENDING  
Series: Carina-Keprix parity inbound  
Severity: HIGH  
Depends on: 00  
Writing style: plain ASCII only (no em/en dashes, no emoji).

## Why this exists

Keprix `delegate_tool` is production; Carina has no subagent runtime.

## Goal

Ship a guarded delegation primitive: spawn child run with tool allowlist, budget, handoff summary back to parent.

## Baseline

Keprix delegate_tool patterns; Carina agent loop.

## Must-haves

1. API + service for delegate.
2. Guardrails: max depth, tool ACL, timeout.
3. Tests for success + budget stop.
4. Honest "not unbounded" docs.

## Acceptance

- [ ] Parent receives child summary without sharing full privileged toolset.
