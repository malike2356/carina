# Prompt 00 - Gap Map and Dedupe Baseline

## Objective

Read the three source agents end to end, compare them against Carina and Scout, and produce a precise adoption map before any code changes. The goal is to identify only the features Carina still lacks or only partially covers.

Do not assume every source feature needs to move. If Carina already has the feature, mark it as covered and move on. If Scout already owns the security or billing boundary, do not reimplement it in Carina.

Reuse rule: keep Carina's wording distinct. Rephrase any copied idea, heading, label, or helper text so it sounds like Carina, not the source project.

---

## Read First

- `instructions/prompts/prompts-archive/agent_research/IMPLEMENTATION-TRACKER.md`
- `instructions/prompts/researched_gap/3-agents-to-adopt/openclaw/README.md`
- `instructions/prompts/researched_gap/3-agents-to-adopt/hermes-agent/README.md`
- `instructions/prompts/researched_gap/3-agents-to-adopt/odysseus/README.md`
- Carina surface code under `core.carinaai.uk/src/`, `core.carinaai.uk/apps/cloud/`, `core.carinaai.uk/docs/`
- Scout surface code under `console.labyrinthscout.com/src/`, `console.labyrinthscout.com/public/`, `console.labyrinthscout.com/docs/`

---

## Task

1. Build a feature matrix for OpenClaw, Hermes, and Odysseus.
2. For each feature, mark one of: `already in Carina`, `already in Scout`, `partial`, `missing`, `not worth adopting`.
3. Group the remaining gaps by surface: CLI, web UI, mobile, gateway, memory, automation, research, security, and onboarding.
4. Write the matrix into a simple markdown note in the same folder as the prompts.
5. Use that matrix to drive the later prompts. Do not start implementation work here.

---

## Acceptance Criteria

- There is a single deduped gap map for the three source agents.
- Every later prompt in this pack points back to a real gap.
- No already-shipped Carina or Scout feature is listed for reimplementation.
