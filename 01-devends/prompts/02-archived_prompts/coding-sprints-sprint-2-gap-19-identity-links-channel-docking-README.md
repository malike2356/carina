**Status: COMPLETED 2026-06-21**

**What was built:** Identity links DB + resolver, cross-channel shared sessions, channel docking commands, and prompt injection. Archived from pending queue 2026-06-21.

# Gap 19 - Identity Links & Channel Docking

**Gap:** 19
**Sprint:** 2
**Source:** OpenClaw docs (session identity links + channel docking)
**Goal:** Let users link identities across channels so the agent recognises the same
  person on Telegram, WebChat, and Discord as one user with a shared session.
  Add channel docking to move a session's reply route to a different channel.

**Primary agent:** Claude Code
**Estimated hours:** 6-8 h total

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Context

Carina routes messages per channel with separate sessions. If you chat on
Telegram then switch to WebChat, you get a different session with no context.
OpenClaw solves this with identity links and channel docking.

**Identity Links**: Link identities across channels -- the agent recognises
you as the same person and shares session context.

**Channel Docking**: Move a session's reply route to a linked channel.
Start a task on Telegram, continue the reply stream on WebChat.

---

## Build Order

```
01-identity-links.md       Identity link data model, linking, resolution
02-shared-sessions.md      Cross-channel session sharing via identity links
03-channel-docking.md      Move reply route between linked channels
```
