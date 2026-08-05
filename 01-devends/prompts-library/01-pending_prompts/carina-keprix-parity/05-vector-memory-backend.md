# Prompt 05: Vector memory backend

Status: PENDING  
Series: Carina-Keprix parity inbound  
Severity: MEDIUM  
Depends on: 00  
Writing style: plain ASCII only (no em/en dashes, no emoji).

## Goal

Add optional pgvector/SQLite vector memory behind a store interface; keep JSONL ledger working as default.

## Must-haves

1. Interface + one vector backend implementation.
2. Migration/docs for enablement.
3. Tests with ephemeral DB or sqlite.

## Acceptance

- [ ] Retrieve-by-similarity returns seeded fixtures.
