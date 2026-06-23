# Prompt 06 - Hermes Messaging Gateway and Provider Choice

## Objective

Adopt the Hermes model of talking to the agent from real messaging surfaces and choosing providers and models without friction. Only fill the gaps that Carina and Scout do not already cover.

Reuse rule: align the behavior, then rename the language. Provider menus, status text, and error copy must read as Carina copy.

---

## Read First

- `instructions/prompts/researched_gap/3-agents-to-adopt/hermes-agent/README.md`
- `core.carinaai.uk/src/gateway/`
- `core.carinaai.uk/src/brain/`
- `core.carinaai.uk/src/cli/commands/`
- `core.carinaai.uk/docs/providers-streaming-matrix.md`

---

## What to Check

1. Messaging gateway coverage across the channels Carina actually supports.
2. Model and provider selection UX in CLI and workspace.
3. Whether the provider experience is guided enough for a person who wants to switch models fast.
4. Whether any Hermes portal or unified tool gateway concept is actually worth copying, or already redundant in Carina.

---

## Deliverable

Add the missing parts that make provider and gateway usage feel deliberate:

- clean channel entry points
- clearer model selection and fallback behavior
- messaging continuity across surfaces if Carina lacks it today

---

## Acceptance Criteria

- A user can reach the agent from a supported messenger without a confusing setup trail.
- Provider choice is obvious and reversible.
- No duplicate provider registry or gateway stack is introduced.
