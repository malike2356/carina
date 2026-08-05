# Prompt 08: Upgrade lifecycle manager

Status: PENDING  
Series: Carina-Keprix parity inbound  
Severity: LOW  
Depends on: 00  
Writing style: plain ASCII only (no em/en dashes, no emoji).

## Goal

Move beyond hot-patch only: check/plan/dry-run/execute/rollback notes for Carina releases, inspired by Keprix upgrade module.

## Must-haves

1. CLI or ops endpoint for check + dry-run.
2. Documented rollback checklist.
3. Does not auto-run destructive migrate without confirmation.

## Acceptance

- [ ] Dry-run prints plan without applying.
