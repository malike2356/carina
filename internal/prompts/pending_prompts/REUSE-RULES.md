# REUSE RULES - Carina Voice and Identity

**Mandatory for:** Every developer, AI agent (Claude Code, Cursor, Codex), IDE session,
and engineer implementing any prompt in this directory.

---

## The Principle

These upgrade prompts describe what to BUILD and HOW. Many features are adapted from
Hermes (Nous Research), OpenClaw, and Odysseus. The behaviors we adopt. The language we do not.

Carina has its own voice, persona, and product identity. Anything a user sees, reads, or
interacts with must feel like it came from Carina, not from a competitor.

---

## Hard Rule

Before any code is committed, every implementation must pass this test:

> If you removed all Carina branding and replaced it with a competitor name,
> would the words, labels, and UI copy still sound like that competitor?
> If yes: rewrite it.

---

## The Four Areas That Must Be Carina's Own

### 1. User-Facing Strings

All text a user reads: error messages, status lines, confirmation prompts, help text,
onboarding messages, notification copy, log output, CLI command descriptions.

WRONG (verbatim from Hermes):
```
"Skills in cooldown for 60s"
"Hermes is thinking..."
"Delegate this task?"
```

CORRECT (Carina's own):
```
"Skill paused briefly while Carina checks it"
"Carina is working on this..."
"Hand this to a worker agent?"
```

---

### 2. Feature Names and Labels

Names of features, panels, modes, and capabilities that users see in UI or docs.

| Adopted from | Competitor calls it | Carina calls it |
|---|---|---|
| Hermes | Skin engine / skins | Themes / appearance |
| Hermes | Ares / mono / slate (skin names) | Carina's own theme names (see below) |
| Hermes | Kanban (user-visible label) | Task Board |
| Hermes | Skill Curator | Skill Manager (or Curator - evaluate) |
| Hermes | Auxiliary model config | Task model config / specialist models |
| Hermes | "Honcho dialectic user modeling" | Carina Intelligence / User Profile |
| OpenClaw | ClawHub | CarinaHub (done) |
| OpenClaw | Doctor --fix | `carina doctor` (keep command, rewrite all output) |
| OpenClaw | Live Canvas | Artifact Canvas / Canvas |
| Odysseus | Cookbook | Playbooks (or evaluate a Carina name) |
| Odysseus | Deep Research | Research mode |

---

### 3. CLI Command Names and Flags

Commands must follow `carina <verb> <noun>` and use Carina's own flag names.

WRONG:
```bash
hermes kanban init
hermes skin ares
```

CORRECT:
```bash
carina task board init
carina theme set sentinel
```

Environment variables: always `CARINA_*`. Never `HERMES_*` / `CLAW_*` / `ODYSSEUS_*`.
Config file paths: always `~/.carina/`. Never references to competitor home directories.

---

### 4. Log Output and Developer-Facing Messages

Console.log, debug output, warning messages in Node.js code must use Carina's prefix
and Carina's language.

WRONG:
```typescript
console.log('[hermes-cache] Prompt frozen');
console.warn('[claw] Unknown sender blocked');
```

CORRECT:
```typescript
console.log('[carina:cache] System prompt frozen for session');
console.warn('[carina:channel] Unknown sender held for pairing approval');
```

---

## Carina's Official Theme Names (for gap-09/04)

The skin/theme engine uses these Carina-native names. Not Hermes's names.

| Theme | Personality | Replaces Hermes skin |
|---|---|---|
| `default` | Carina Blue (cyan) | default |
| `sentinel` | Alert Red (bold) | ares |
| `void` | No color (accessible) | mono |
| `stone` | Muted grey | slate |
| Custom via YAML | Operator-defined | (same mechanism) |

---

## Carina's Voice (Quick Reference)

- **Direct:** No waffle, no filler phrases. "Done." not "Operation completed successfully."
- **Calm:** No exclamation marks. "Carina is ready." not "Carina is ready!"
- **Honest:** State what actually happened. "Skill paused (0 uses in 30 days)" not "Skill optimized."
- **No jargon leakage:** Never use competitor product names in shipped text.
- **British-leaning neutral:** Carina targets UK property market users. Not US startup casual.

---

## Gap-06 File Name Note

Files in `gap-06-webui/` are named `01-hermes-pty-bridge.md`, `03-openclaw-i18n.md` etc.
These names are for INTERNAL REFERENCE ONLY - they describe the behavioral source.
The implemented features in Carina must not retain "hermes" or "openclaw" in:
- File names in the shipped codebase
- Class or function names visible in logs
- Config key names
- Any string the user sees

---

## Where Competitor Names ARE Allowed

1. Internal research files in `3-agents-to-adopt/` (never shipped)
2. These prompt files (internal planning material)
3. Code comments explaining behavioral provenance: `// session freezing pattern, see gap-09/01`
4. Business/strategy documents (MIGRATION-STRATEGY.md, MIGRATION-IMPLEMENTATION.md)
5. Git commit messages referencing the implementation source

They must NEVER appear in:
- Shipped source code strings (user-visible)
- Documentation published to docs.carinaai.uk
- UI copy in app.carinaai.uk, carina-desktop, carinaMobile
- Error messages, log output, CLI help text
- Notifications, emails, channel messages sent by Carina

---

## Quick Checklist Before Committing

- [ ] No `hermes` / `openclaw` / `odysseus` in any user-visible string
- [ ] Theme names use sentinel / void / stone (not ares / mono / slate)
- [ ] CLI output says "Carina" not the competitor
- [ ] Log prefixes are `[carina:module]` not `[hermes:...]`
- [ ] Feature labeled with Carina's own name in any UI or docs
- [ ] Environment variables are `CARINA_*`
- [ ] Config paths are `~/.carina/`
- [ ] Error messages are written in Carina's calm, direct voice
