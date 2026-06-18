# Prompt 04 - Hermes Learning Loop, Memory, and Skills

## Objective

Adopt the Hermes behavior that makes the agent improve over time: learning from runs, writing durable memory, discovering skills, and reusing what it learned across sessions.

Reuse rule: do not transplant Hermes phrasing into Carina memory, learning, or skill surfaces. Rewrite every visible string before merging.

---

## Read First

- `instructions/prompts/researched_gap/3-agents-to-adopt/hermes-agent/README.md`
- `core.carinaai.uk/src/memory/`
- `core.carinaai.uk/src/skills/`
- `core.carinaai.uk/src/sync/`
- `core.carinaai.uk/docs/skill-packs/`

---

## What to Check

1. Whether Carina already has a learning loop, and if it does, whether it is actually user-facing and automatic enough.
2. Whether skill creation, skill improvement, and skill recall are present or only partially wired.
3. Whether memory is searchable and promoted well enough after complex work.
4. Whether the system can explain what it learned without exposing stale context or transcript spam.

---

## Deliverable

Close the missing learning loop pieces:

- persist the useful result of work, not just the chat log
- create or improve skills when the task warrants it
- make learned material discoverable in later sessions

---

## Acceptance Criteria

- A finished task can leave behind a durable skill or memory artifact when appropriate.
- The agent can find prior work without pretending the transcript is the product.
- The learning loop does not duplicate memory logic that already exists in Carina.
