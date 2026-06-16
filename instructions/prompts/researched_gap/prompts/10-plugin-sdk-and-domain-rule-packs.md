# Prompt 10 - Plugin SDK and Domain Rule Packs

You are working in the Carina repository.

Goal: add the formal extension surface and rule-pack model seen in OpenClaw and Odysseus.

Read first:
- `instructions/prompts/researched_gap/agent_research/CROSS-AGENT-ARCHITECTURE.md`
- `instructions/prompts/researched_gap/agent_research/AGENT-SYSTEM-PROMPTS.md`
- the current plugin, extension, or adapter code

Implement:
- a narrow-waist plugin or extension SDK
- typed contracts for plugins
- discovery and registration
- domain rule packs that load only when relevant tools are enabled
- a boundary that keeps core logic isolated from plugin code

This is about making extensions first-class without turning the core into a junk drawer.

Acceptance criteria:
- third-party extensions have a defined contract
- tool-specific guidance is injected only when relevant
- plugin code does not need to import the core freely
- there are tests for extension loading or rule-pack selection

