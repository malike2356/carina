# Prompt 17 - Setup, Docker, and Onboarding

You are working in the Carina repository.

Goal: adopt the first-run and container patterns from Hermes, OpenClaw, and Odysseus.

Read first:
- `instructions/prompts/researched_gap/agent_research/DEEP-GAPS-REPORT.md`
- `instructions/prompts/researched_gap/agent_research/UI-CLI-GUI-REPORT.md`

Implement:
- a first-run wizard or onboarding flow
- workspace bootstrap files or seed data
- install scripts for the supported platforms
- container support with sane supervision
- GPU-aware Docker setup if the product needs local model support

Make setup boring and reliable. The user should not need to learn the system before the system starts helping.

Acceptance criteria:
- first-run setup is explicit and not brittle
- container startup behaves predictably
- platform install paths are documented and tested

