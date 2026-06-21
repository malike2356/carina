# Prompt 02 - OpenClaw Voice, Canvas, and Companion Surfaces

## Objective

Adopt the OpenClaw features that make the assistant feel present on the user’s devices: voice input and output, live canvas or visual workspace behavior, and companion app surfaces where Carina is currently only a web or CLI experience.

Reuse rule: keep the feature intent, but rewrite all surface text, button labels, and helper copy so it sounds like Carina rather than OpenClaw.

---

## Read First

- `instructions/prompts/researched_gap/3-agents-to-adopt/openclaw/README.md`
- `core.carinaai.uk/apps/cloud/`
- `core.carinaai.uk/src/tui/`
- `carinaMobile/`
- any existing canvas, voice, or media surface code in Carina

---

## What to Check

1. Voice wake or push-to-talk behavior.
2. Speech-to-text and text-to-speech flow, including fallback behavior.
3. Live canvas or visual workspace features that help the assistant act instead of just chat.
4. Mobile or desktop companion surfaces that improve daily use.
5. Whether Carina already has an equivalent, and if so whether it is surfaced well enough.

---

## Deliverable

Fill only the gaps that matter:

- make voice a visible, usable part of the product
- make the visual workspace feel like a first-class surface if Carina lacks that today
- wire any companion app behavior that improves presence, not novelty

---

## Acceptance Criteria

- Voice can be used without hunting through hidden settings.
- Any visual workspace feature is reachable from a normal Carina flow.
- Companion app work is integrated with the existing account and workspace model.
