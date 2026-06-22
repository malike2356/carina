**Status: COMPLETED 2026-06-21**


# Gap 26 - Prompt 02: Business & Regional Channel Docs

**Gap:** 26 Documentation: Channel Guides
**Prompt number:** 02 of 04
**Name:** Write docs for Google Chat, Teams, Mattermost + regional (LINE, WeChat, Feishu, Zalo)
**Primary agent:** Claude Code (docs writing)
**Estimated hours:** 2 h (8 pages)
**Depends on:** Nothing (can run parallel with prompt 01)

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

Write 8 channel pages combining business platforms and regional platforms.

### Business channels

1. **`docs/user/gateways/google-chat.md`**
   - Setup: Google Cloud Console → create project → enable Chat API → service account
   - Config: `CARINA_GOOGLE_CHAT_CREDENTIALS` (JSON key file path)
   - Features: text, cards, spaces, threads
   - Security: Google Workspace domain scoping

2. **`docs/user/gateways/microsoft-teams.md`**
   - Setup: Azure Portal → app registration → bot channel → app password
   - Config: `CARINA_TEAMS_APP_ID`, `CARINA_TEAMS_APP_PASSWORD`
   - Features: text, adaptive cards, teams/channels
   - Security: Azure AD app-only auth, no user delegation

3. **`docs/user/gateways/mattermost.md`**
   - Setup: Mattermost instance → integrations → bot account → access token
   - Config: `CARINA_MATTERMOST_SERVER`, `CARINA_MATTERMOST_TOKEN`
   - Features: text, attachments, channels, threads
   - Security: self-hosted, token scoped to team

### Regional channels

4. **`docs/user/gateways/line.md`**
   - Setup: LINE Developers Console → create channel → channel access token
   - Config: `CARINA_LINE_CHANNEL_TOKEN`, `CARINA_LINE_CHANNEL_SECRET`
   - Features: text, stickers, images, flex messages
   - Security: webhook signature verification, LINE user ID scoping

5. **`docs/user/gateways/wechat.md`**
   - Setup: WeChat Official Account → developer mode → app ID + secret
   - Config: `CARINA_WECHAT_APP_ID`, `CARINA_WECHAT_APP_SECRET`
   - Features: text, template messages, menu integration
   - Security: IP whitelist, message encryption

6. **`docs/user/gateways/feishu.md`**
   - Setup: Feishu Open Platform → create app → bot → app credentials
   - Config: `CARINA_FEISHU_APP_ID`, `CARINA_FEISHU_APP_SECRET`
   - Features: text, cards, interactive messages, group chat
   - Security: tenant access token with auto-refresh

7. **`docs/user/gateways/zalo.md`**
   - Setup: Zalo Developer Portal → create OA → app ID + secret
   - Config: `CARINA_ZALO_APP_ID`, `CARINA_ZALO_APP_SECRET`
   - Features: text, images, template messages
   - Security: Zalo OA verification, webhook event validation

8. **`docs/user/gateways/irc.md`**
   - Setup: IRC server address → optional NickServ registration
   - Config: `CARINA_IRC_SERVER`, `CARINA_IRC_NICK`, `CARINA_IRC_CHANNELS`
   - Features: text only, channel join/part, private messages
   - Security: SASL auth if available, TLS connection

---

## Sidebar update

Add business channels and regional channels as sub-categories under "Gateways".

---

## Existing Carina files to reference

- Channel adapters in `internal/servers/core.carinaai.uk/src/gateway/channels/adapters/`
- Channel routing in `internal/servers/core.carinaai.uk/src/gateway/router.ts`
