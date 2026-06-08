# Action: Coding-Agent Delegation Skills (Reinterpreted as Skill Data, Standalone Carina)

## Goal
Add a small set of Carina `Skill` entries that teach the agent how to delegate coding work to external CLI tools (Claude Code, Codex CLI) when they're available on the host - reinterpreting the spec's "port these skills" instruction onto Carina's actual data-driven skill model, and dropping the entries that describe integrations with products that don't exist in this ecosystem.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- **Fundamental mismatch to resolve before writing anything**: the spec describes "SKILL.md" files - markdown documents with YAML frontmatter (`name`, `description`, `category`), numbered steps, "pitfalls," and a `skill_view` loader - which is the format used by a different, CLI-native agent product (note the spec's own vocabulary: "Tool: claude-code (or terminal with PTY mode)", `~/.hermes/`-style paths elsewhere in this batch). **Carina's skills are plain TypeScript data objects**, not markdown files: read `src/skills/packs/property-uk/skills.ts` (the `propertyUkSkills: PackSkillInput[]` array) and the `Skill` interface in `src/types/index.ts` - `{ name, description, trigger: string[], steps: string (prose), toolsUsed: string[] }`. There is no `skill_view`/markdown-loading mechanism (`grep -rln 'SKILL.md\|skill_view\|frontmatter' src/` returns nothing) and building one would be a significant, separate architectural change (see `06-domain-pack-system.md`'s reframing for the related, larger version of this same question). Port the *content* (what the skill teaches the agent to do) into the *existing* data format - do not build a markdown-skill-loader as a side effect of porting six skill descriptions.
- **Of the six skills the spec lists, three describe integrations with products that do not exist for Carina's users and should be dropped, not ported**:
  - `kanban-codex-lane` - assumes a Kanban project-management integration that doesn't exist
  - `openclaw-integration` - "OpenClaw" is another product entirely; there is no protocol, API, or shared infrastructure to integrate with
  - `hermes-agent` - this is explicitly the OTHER product's self-configuration meta-skill (`carina config set` in the spec is a typo/leftover for `hermes config set`); Carina's equivalent meta-skill, if wanted, would teach the agent about `pnpm cli`/`pnpm admin`/the actual CLI surface in `bin/carina.ts` - write that fresh if the user wants it, don't port a skill describing commands that don't exist
  - Flag all three to the user in your completion summary as "intentionally not ported - describe a different product's integrations" rather than silently omitting them.
- The remaining three (`claude-code`, `codex`, `opencode`) describe a genuinely useful, portable idea: **"when the user asks for a substantial coding task, and a coding-agent CLI is installed on the host, delegate to it rather than doing the whole thing turn-by-turn yourself."** This is reinterpretable as Carina skill data that points at `delegate-task`/`shell-exec` (PTY mode, if `01-terminal.md` builds it - these CLIs are interactive TUIs).
- Read `src/skills/packs/property-uk/skills.ts` fully (the six existing entries) to match tone, structure, and the level of step-by-step specificity already established - your new entries should look like siblings of `brr-analysis`/`yield-calculator`, not like a different author wrote them.

## Files to create
- `src/skills/packs/core-engineering/skills.ts` - new pack (or extend an existing generic pack if `06-domain-pack-system.md`'s work has produced one - check before creating a parallel structure) containing the reinterpreted skill entries
- `src/skills/packs/core-engineering/pack.json`

## Files to modify
- `src/skills/index.ts` - register the new pack in `PACK_DIRS` and `loadPackSkills`/`getPackSystemSuffix` (mirror exactly how `property-uk` is wired in - this file is short, read it in full first)

## Step-by-step

1. Confirm whether `06-domain-pack-system.md` has already produced a generic pack-loading mechanism (it's listed later in this same phase's spec set and is explicitly about "extensibility without code changes to Carina Core"). If it has, register through that mechanism instead of hand-extending `PACK_DIRS` - check before duplicating effort.

2. Write three `Skill` entries (as `PackSkillInput` objects, matching `propertyUkSkills`'s shape exactly):
   - `delegate-to-claude-code`: trigger words like `"claude code"`, `"cursor"`, `"write the code"`, `"implement this feature"`; steps describing: check whether `claude` CLI is on the host (`which claude` via `shell-exec`), if present write a clear, self-contained spec for the subtask, delegate via `delegate-task` (or `shell-exec` with `pty: true` if `01-terminal.md` built interactive PTY support - reference whichever actually exists, don't assume), review the diff/output before treating it as done, and what to do if the CLI isn't installed (tell the user, suggest `npm install -g @anthropic-ai/claude-code` or equivalent, do not silently fall back to doing the whole task inline as if delegation never mattered)
   - `delegate-to-codex`: same pattern, `codex` CLI, used as a fallback/comparison per the spec's stated intent ("use when Claude Code is unavailable or for comparison")
   - `delegate-to-opencode`: same pattern, `opencode` CLI, the spec's stated use case ("PR review, smaller focused tasks") - keep the trigger words narrower to match that narrower intended use, so this skill doesn't compete with the other two for the same triggers
   
   Each entry's `toolsUsed` should list the real tool names it depends on (`shell-exec`, `delegate-task` if built) - and each skill's `steps` prose should explicitly tell the agent to verify the CLI is installed before attempting delegation (mirror the "graceful degradation" pattern already established in `land-registry.ts`'s stub response - a skill that assumes a tool is present and fails loudly when it isn't is worse than one that checks first).

3. Write `pack.json` mirroring `property-uk/pack.json`'s shape (`name`, `version`, `description`, `author`, `skillCount: 3`).

4. Wire the pack into `src/skills/index.ts`: add to `PACK_DIRS`, extend `loadPackSkills`'s allowlist check, extend `getPackSystemSuffix` if the pack needs a system-prompt suffix (check whether `property-uk`'s `propertyUkSystemSuffix` is essential to how its skills get found/used, or whether `findRelevantSkills`'s keyword matching alone is sufficient for a pack with no domain-specific vocabulary - a generic engineering pack likely doesn't need a persona-shaping suffix the way a property pack does).

5. No new tests are strictly required (skill entries are data, validated by the existing `skill.test.ts`/hub `validate.test.ts` if those check shape) - but DO run the existing skill-loading test suite to confirm the new pack loads without breaking anything, and add one assertion confirming `loadPackSkills('core-engineering')` returns the expected count.

## Expected behavior
- A user asking "can you implement the login page redesign" gets an agent that checks for `claude`/`codex`/`opencode` CLIs, delegates if one is present (with a clear spec and a review step), and is upfront about doing it inline if none are installed - never silently pretending a CLI ran when it didn't.
- The three irrelevant skills from the spec (`kanban-codex-lane`, `openclaw-integration`, `hermes-agent`) are documented as deliberately excluded, not silently dropped.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/skills/
pnpm test
pnpm build
```
Manual check:
```
In a Carina session: "I need a new settings page built - can you use Claude Code for this?"
# Confirm the agent checks for the CLI, explains what it found, and proceeds appropriately either way
```

## Dependencies
- `06-delegate-task.md` (the skills reference `delegate-task` as their delegation mechanism)
- `01-terminal.md` PTY mode, IF it gets built (these CLIs are interactive TUIs; without PTY support, delegation can only work via the CLIs' non-interactive/scriptable modes - check whether `claude`/`codex`/`opencode` have one before assuming PTY is required)
- None of these CLIs need to be installed for the prompt to be written or the skill data to load; they only need to be present at *use* time, which the skill steps must check for
