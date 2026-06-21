# Gap 26 - Prompt 01: Mainstream Channel Docs (Discord, Slack, Signal, iMessage, Matrix)

**Gap:** 26 Documentation: Channel Guides
**Prompt number:** 01 of 04
**Name:** Write docs/user/gateways/{discord,slack,signal,imessage,matrix}.md
**Primary agent:** Claude Code (docs writing)
**Estimated hours:** 1.5 h
**Depends on:** Nothing

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `internal/servers/core.carinaai.uk/src/gateway/channels/adapters/` -- channel adapter implementations
2. `internal/servers/core.carinaai.uk/src/gateway/channel-config.ts` -- config schemas
3. Existing channel docs: `marketing/docs/docs.carinaai.uk/docs/user/gateways/telegram.md`

---

## Goal

Write 5 new channel pages. Follow the template from README.md.

### Pages to write:

1. **`docs/user/gateways/discord.md`**
   - Setup: Discord Developer Portal → create application → add bot → get token
   - Config: `CARINA_DISCORD_TOKEN`, guild IDs for slash commands
   - Features: text, embeds, reactions, threads, slash commands
   - Security: bot token scoped to minimum permissions

2. **`docs/user/gateways/slack.md`**
   - Setup: api.slack.com → create app → Socket Mode or HTTP → bot token
   - Config: `CARINA_SLACK_BOT_TOKEN`, `CARINA_SLACK_APP_TOKEN`
   - Features: text, blocks, reactions, threads, slash commands
   - Security: Socket Mode preferred (no public HTTP endpoint needed)

3. **`docs/user/gateways/signal.md`**
   - Setup: signal-cli or signald → register phone number → link device
   - Config: `CARINA_SIGNAL_PHONE`, `CARINA_SIGNAL_DATA_DIR`
   - Features: text, attachments, groups
   - Security: Signal's end-to-end encryption, local message storage

4. **`docs/user/gateways/imessage.md`**
   - Setup: macOS only → Messages.app signed in → accessibility permissions
   - Config: `CARINA_IMESSAGE_ENABLED`, AppleScript bridge
   - Features: text, attachments (via Messages.app)
   - Security: limited to signed-in Apple ID, no remote access needed

5. **`docs/user/gateways/matrix.md`**
   - Setup: matrix.org or self-hosted homeserver → create bot user → access token
   - Config: `CARINA_MATRIX_HOMESERVER`, `CARINA_MATRIX_TOKEN`, `CARINA_MATRIX_USER`
   - Features: text, images, encrypted rooms (with E2EE key sharing)
   - Security: E2EE key stored locally, homeserver isolated per session

### Key rules
- Every page includes the `carina channel add <name>` command
- Show config via both CLI and env vars
- Cross-link to the configuration reference page
- No competitor names, no emojis, no em/en dashes

---

## Sidebar update

Add all 5 pages under the "Gateways" category in `sidebars.ts`.

---

## Existing Carina files to reference

- Source code in `internal/servers/core.carinaai.uk/src/gateway/channels/adapters/`
- Environment config in `internal/servers/core.carinaai.uk/.env.example`
