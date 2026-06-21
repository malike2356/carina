# Gap 26 - Documentation: Channel Guides (Missing 14+ Channels)

**Gap:** 26
**Sprint:** 2
**Type:** Documentation
**Source:** OpenClaw docs (25+ individual channel setup pages)
**Target dir:** `marketing/docs/docs.carinaai.uk/docs/user/gateways/`

**Goal:** Write the missing channel documentation pages. Carina has 18 channel
  adapters but only 4 documented (CLI, Telegram, WhatsApp, Web). The remaining
  14 channels need setup pages: Discord, Slack, Signal, iMessage, Matrix,
  Google Chat, Microsoft Teams, IRC, Mattermost, LINE, WeChat, Feishu, Zalo,
  and SMS.

**Primary agent:** Claude Code (docs writing -- source code for reference only)
**Estimated hours:** 4-5 h total (14 pages, ~15 min each)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Build Order

```
01-mainstream-channels.md    Discord, Slack, Signal, iMessage, Matrix
02-business-channels.md      Google Chat, Microsoft Teams, Mattermost
03-regional-channels.md      LINE, WeChat, Feishu, Zalo
04-developer-channels.md     IRC, SMS
```

Each prompt produces 3-5 pages. Total: 14 new doc pages.

---

## Page Template

Every channel page follows this structure:

```markdown
# <Channel Name> Gateway

## Prerequisites
- A <channel> account
- <specific requirements: bot token, app registration, QR code, etc>

## Setup

### Step 1: Create a <channel> application
(Platform-specific instructions)

### Step 2: Add the channel to Carina
carina channel add <channel-name>
(Paste credentials when prompted)

### Step 3: Verify
carina channel status <channel-name>

## Configuration

### Environment variables
| Variable | Required | Description |
|----------|----------|-------------|
| CARINA_<CHANNEL>_TOKEN | yes | Bot token |

### Advanced options
carina channel config <channel-name> --pairing-mode qr
carina channel config <channel-name> --access-group family

## Message format support
| Format | Supported |
|--------|-----------|
| Text | yes |
| Images | <yes/no> |
| Voice notes | <yes/no> |
| Reactions | <yes/no> |
| Threads | <yes/no> |

## Troubleshooting
- Common errors and their fixes
- Verify with: carina channel test <channel-name>

## Security notes
- Channels are isolated per session
- Credentials stored encrypted at ~/.carina/credentials.enc
- (channel-specific security notes)
```

---

## Carina voice for channel docs
- Use Carina terminology: "gateway" not "bridge", "channel" not "connector"
- Security note on every page: how credentials are stored, session isolation
- No competitor mentions (no "like OpenClaw does", no "similar to Hermes")
- Setup steps: always show the `carina channel add` command
- Cross-link to onboarding and configuration pages

---

## Sidebar update

Add all new channel pages under the "Gateways" category in `sidebars.ts`.
Group them in a logical order: mainstream first, then business, then regional.

---

## Done When
- [ ] 14 new channel pages written
- [ ] Each page follows the template above
- [ ] Sidebar updated with all new pages
- [ ] `pnpm build` passes in the Docusaurus project
