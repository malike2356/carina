# Gap 25 - Prompt 02: Onboarding Walkthrough

**Gap:** 25 Documentation: Install, Onboarding & Quickstart
**Prompt number:** 02 of 03
**Name:** Write `docs/user/onboarding.md` -- step-by-step from zero to first message
**Primary agent:** Claude Code (docs writing)
**Estimated hours:** 1 h
**Depends on:** 01-install-page.md (should link to it)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Goal

Write `marketing/docs/docs.carinaai.uk/docs/user/onboarding.md`.

A guided walkthrough that takes a new user from `carina` command to their
first AI conversation. Every step includes the exact command and what to
expect.

### Structure

```markdown
# Onboarding

## Step 1: Install
Follow the [install guide](/docs/user/install). Verify with:
carina --version

## Step 2: Add a model provider
carina provider add

Carina asks which provider you want to use. Currently supported:
- Anthropic (Claude)
- OpenAI
- Google (Gemini)
- any OpenAI-compatible endpoint

Enter your API key when prompted. Carina stores it encrypted at
~/.carina/credentials.enc.

## Step 3: Run the health check
carina doctor

This checks your Node.js version, provider connectivity, and file
permissions. Fix any issues before continuing.

## Step 4: Start the Gateway
carina gateway start

The Gateway is the control plane. It listens on localhost:3333 by default
and manages sessions, channels, tools, and memory.

Verify it is running:
carina gateway status

## Step 5: Connect a channel
Pick your first channel. Telegram is the fastest to set up:

carina channel add telegram

You will need a Telegram bot token from @BotFather. Paste it when
prompted. Other channels (WhatsApp, Discord, Slack) are available.

## Step 6: Send your first message
Open Telegram and send a message to your bot. Carina replies.

Or use the CLI:
carina chat "What can you help me with?"

## Step 7: Set up persistent memory (optional)
Memory backends store what Carina learns about you across sessions:

carina memory setup

## What's next?
- [Configure Carina](/docs/user/configuration)
- [Add more channels](/docs/user/gateways/telegram)
- [Browse skill packs](/docs/user/skill-packs/overview)
- [Self-host on a VPS](/docs/user/self-hosting)
```

### Key rules
- Every step has the exact command
- Show expected output for key commands (e.g., `carina gateway status`)
- Cross-link aggressively to deeper docs
- Mention security: credentials encrypted, Gateway isolated, channels verified
- No emojis, no competitor names, no em/en dashes
- Screenshot placeholders marked with: `<!-- TODO: screenshot -->`

---

## Sidebar update

Add `'user/onboarding'` after `'user/install'` in the "Getting started" category.

---

## Existing Carina files to reference

- `internal/servers/core.carinaai.uk/src/cli/` -- CLI commands
- `internal/servers/core.carinaai.uk/src/platform/platform-knowledge.md` -- runtime knowledge
