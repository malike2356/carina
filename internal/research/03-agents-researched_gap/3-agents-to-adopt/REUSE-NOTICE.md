# REUSE NOTICE - Reference-Only Research Material

**Status:** RESEARCH ONLY - Do not copy verbatim into Carina.
**Applies to:** Every file in this directory and all sub-directories.

---

## What This Directory Is

`3-agents-to-adopt/` contains source code, docs, and configuration from three competitor
AI agents used purely as behavioral references:

- `hermes-agent/` - Nous Research's Hermes agent
- `openclaw/` - OpenClaw agent framework
- `odysseus/` - Odysseus self-hosted workspace

These were obtained for research. They are not Carina's codebase.

---

## The Core Rule

**Functionality is fair to adopt. Language is not.**

Carina may implement the same capability as a competitor. Carina must NOT ship the
same words, names, labels, error messages, CLI output, UI copy, or persona.

Every feature adopted must be rebuilt in Carina's own voice, naming conventions,
and presentation style before it reaches production.

---

## What Must Change (Examples)

| Competitor has | Carina must use its own equivalent |
|---|---|
| `hermes kanban init` | `carina task board init` or similar Carina-native command |
| Skin names: ares, mono, slate | Carina's own skin names |
| "KawaiiSpinner" | Remove reference entirely; implement unnamed |
| "HERMES_HOME" environment variable | `CARINA_HOME` |
| "honcho dialectic user modeling" | Carina's own name for the feature |
| "ClawHub" | CarinaHub (already done) |
| OpenClaw error messages verbatim | Rewrite in Carina's tone |
| Hermes skill YAML frontmatter field names | Evaluate; rename any that are user-visible |
| "Porcupine" in user-facing strings | Replace with generic "wake word engine" references |
| Odysseus cookbook terminology | Rename to Carina's equivalent |
| Any competitor brand name in logs, UI, comments | Remove or replace |

---

## What Is Fine to Keep

- Third-party library names (`node-pty`, `better-sqlite3`, `porcupine-react-native`)
  These are external packages, not competitor brands.
- Architecture patterns (FTS5, PTY bridge, kanban dispatch) - implement the pattern,
  not the naming.
- Protocol names (ACP, JSON-RPC, FTS5) - these are industry standards, not competitor IP.
- Internal implementation comments within code (e.g. `// FTS5 keeps this fast`) - fine.
- Research notes inside these files themselves.

---

## Where Competitor Names Are Allowed

Only in these locations:
1. Files inside `3-agents-to-adopt/` (here) - pure research material.
2. Internal strategy documents (MIGRATION-STRATEGY.md, MIGRATION-IMPLEMENTATION.md) -
   for business analysis only, never shipped.
3. Prompt files that explicitly document WHAT we are adopting and WHY - internal use only.
4. Code comments that explain provenance of a pattern (e.g. `// pattern inspired by Hermes cron`)
   with the understanding this comment is removed before the feature goes to production docs.

---

## Enforcement

Every developer, AI agent, Cursor session, Claude Code session, and Codex session working
from these files must treat them as read-only behavioral specs, then implement the equivalent
capability in Carina's own language.

When in doubt: read the source for the behavior, close the file, then write the Carina
version from scratch using what you learned.

---

## Reuse Checklist (run before any PR that adopts a competitor feature)

- [ ] All user-visible strings (labels, menu items, error messages, prompts) are Carina's own words
- [ ] CLI command names follow `carina <verb> <noun>` pattern, not the competitor's CLI shape
- [ ] Environment variable names are `CARINA_*`, not `HERMES_*` / `CLAW_*` / `ODYSSEUS_*`
- [ ] Config file keys use Carina's naming (check config-schema.ts)
- [ ] Log output and console messages use Carina's tone (direct, no jargon, no competitor references)
- [ ] Feature names in docs and UI are Carina's own names
- [ ] No competitor brand name appears in any shipped file (code, config, docs, UI)
