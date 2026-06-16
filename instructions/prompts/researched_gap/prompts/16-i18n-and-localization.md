# Prompt 16 - i18n and Localization

You are working in the Carina repository.

Goal: add a real localization system inspired by Hermes.

Read first:
- `instructions/prompts/researched_gap/agent_research/DEEP-GAPS-REPORT.md`
- `instructions/prompts/researched_gap/agent_research/UI-CLI-GUI-REPORT.md`

Implement:
- locale files for translated UI strings
- language selection or detection
- a simple fallback path when a locale is missing
- any prompt or UI text that should be translated

Start with the highest-value surfaces first. The point is to make the system language-aware without turning it into a translation project you cannot sustain.

Acceptance criteria:
- at least one non-English locale works end to end
- missing translations fall back cleanly
- locale loading is deterministic and testable

