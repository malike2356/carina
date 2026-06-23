# Cross-Agent Skill Consumption; Universal 3-Tier Architecture

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Date:** 2026-06-18  
**Status:** Spec complete. Implementation prompts written.  
**Supersedes:** `CROSS-AGENT-SKILL-CONSUMPTION.md` (2026-06-17); the original adapter-per-agent approach for Hermes, OpenClaw, and Odysseus only.

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## The Shift: From 3 Adapters to Universal Consumption

The original spec (2026-06-17) proposed dedicated adapters for Hermes, OpenClaw, and Odysseus. That approach works for three agents but doesn't scale. Every new agent requires a new adapter. Every agent format change breaks the adapter. At 20 agents, you have 20 adapters to maintain.

**The new architecture replaces adapters with a 3-tier universal system:**

| Tier | What It Does | Coverage |
|---|---|---|
| **Tier 1; MCP Native** | Direct support for Model Context Protocol tools | Every MCP server (hundreds) |
| **Tier 2; Smart Converters** | Format auto-detection + converter pipeline for top 20 agent formats | Cursor, Claude Code, Windsurf, Aider, Continue.dev, Cline, Copilot, CrewAI, LangChain, AutoGPT, Devin, Replit, Pieces, and more |
| **Tier 3; LLM Universal Fallback** | Feed any skill file to an LLM with a conversion prompt | Everything else; novel formats, raw docs, long tail |

Plus two **meta-skills** that make the ecosystem self-sustaining:
- **Skill Format Registry**; community-maintained format definitions, grows faster than converters
- **Cross-Ecosystem Discovery**; index and search skills from every platform's public hubs

---

## Key Principle

**Convert once, run native forever.** Skills are converted from source format → canonical Carina format at install time. They are then stored as native Carina skills. The converter runs once. The skill executes as a first-class Carina citizen every time after.

This is a critical architectural difference from the adapter approach. Adapters run every time a skill executes; adding latency, breaking when source formats change, and requiring maintenance forever. Converters run once at install time. The skill is Carina-native from that point forward.

---

## Prompt Index

| # | File | What It Builds | Agent | Effort |
|---|------|---------------|-------|--------|
| 01 | `01-architecture.md` | Full architectural spec; data flow, format definitions, detection engine, registry schema |; | Reference |
| 02 | `02-tier1-mcp-native-support.md` | MCP client integration: tool discovery, invocation, security sandbox | Claude Code / Cursor | 5 days |
| 03 | `03-tier2-universal-converters.md` | Format auto-detection + 20 converters + unified conversion pipeline | Claude Code / Cursor | 8 days |
| 04 | `04-tier3-llm-fallback.md` | LLM-powered universal ingestion with review UI | Cursor / Codex | 3 days |
| 05 | `05-skill-format-registry.md` | Community format registry; schema, submissions, validation, API | Codex / Claude Code | 4 days |
| 06 | `06-cross-ecosystem-discovery.md` | Cross-hub skill discovery; indexing, search, install from any hub | Cursor / Claude Code | 5 days |

**Total: ~25 days with parallel agents. ~3 weeks calendar time running 2-3 agents simultaneously.**

---

## Build Order

```
Phase 1: Foundation (days 1-5)
  02-tier1-mcp-native-support.md     MCP integration; unlocks hundreds of tools immediately

Phase 2: Conversion Engine (days 6-13, run in parallel with Phase 3)
  03-tier2-universal-converters.md   Format detection + 20 converters

Phase 3: Universal Fallback (days 6-8, run in parallel with Phase 2)
  04-tier3-llm-fallback.md           LLM ingestion for everything else

Phase 4: Ecosystem (days 14-18, run in parallel)
  05-skill-format-registry.md        Community registry
  06-cross-ecosystem-discovery.md    Cross-hub search and indexing
```

---

## What Carina Gains

| Metric | Before (3 Adapters) | After (3-Tier Universal) |
|---|---|---|
| Agent ecosystems covered | 3 | All (MCP + 20 converters + LLM fallback) |
| Tools available at install | ~100 skills from 3 hubs | Hundreds of MCP tools + thousands of skills from 20+ ecosystems |
| New agent support | Build new adapter (1-2 weeks) | Day 1 via LLM fallback. Dedicated converter later if ecosystem grows. |
| Maintenance burden | N adapters to maintain forever | Format registry auto-updates. Converters are stateless. |
| Competitive moat | 3 agents | Every agent ecosystem. Carina is the meta-platform. |

---

## Relationship to Original Spec

`CROSS-AGENT-SKILL-CONSUMPTION.md` (2026-06-17) is retained as historical reference. Its Phase 1-4 build plan for Hermes/OpenClaw/Odysseus adapters is fully subsumed by Tier 2 converters. The original spec's code examples (skill-adapters.ts, code-sandbox.ts, searchAllHubs) provide useful implementation patterns for the converter pipeline.

The original spec asked: "Can Carina consume skills from Hermes, OpenClaw, and Odysseus?"

The new architecture answers: "Carina consumes skills from every AI agent platform that exists or will ever exist."

---

## Key Files

- `01-architecture.md`; Read this first. Full data flow, format specs, detection engine design.
- `02-tier1-mcp-native-support.md`; Highest-leverage build. One integration = hundreds of tools.
- `03-tier2-universal-converters.md`; Largest build. 20 converters, auto-detection, pipeline.
- `04-tier3-llm-fallback.md`; Smallest build. LLM prompt engineering + review UI.
- `05-skill-format-registry.md`; Community infrastructure. Schema, API, submissions.
- `06-cross-ecosystem-discovery.md`; The UX layer. Search everything, install anything.