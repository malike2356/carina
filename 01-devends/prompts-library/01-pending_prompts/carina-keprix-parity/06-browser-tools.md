# Prompt 06: Browser tools

Status: PENDING  
Series: Carina-Keprix parity inbound  
Severity: MEDIUM  
Depends on: 00, prefer 02  
Writing style: plain ASCII only (no em/en dashes, no emoji).

## Goal

Add browser automation tools to Carina agent (navigate/snapshot/click/type) with sandbox/egress policy.

## Baseline

Keprix browser tools; do not require desktop CE for CI (mock or headless gated).

## Must-haves

1. Tool registrations + allowlist.
2. CI-safe tests (mocked).
3. Docs security notes.

## Acceptance

- [ ] Mocked navigate+snapshot succeeds in tests.
