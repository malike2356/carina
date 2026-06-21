# Carina Tool Inventory

**Date:** 2026-06-15  
**Codebase:** `core.carinaai.uk`  
**Machine-readable catalog:** `src/tools/tool-surface-catalog.ts`  
**Risk audit:** `carina tools audit` or `src/tools/tool-inventory.ts`

## Summary

| Metric | Count | Notes |
|---|---:|---|
| Registered agent tools (base startup) | **72** | `registry.list()` without Playwright browser pack |
| Toolset map (unique names) | **80** | `TOOLSET_MAP` across 17 toolsets |
| Catalogued tools (with metadata) | **86** | Includes optional browser/pack entries |
| Playwright browser tools (optional) | **+12** | Registered when Playwright is available |
| Pack-specific tools | **+1** | `domain_lookup` when a vertical pack is active |
| Platform integrate tool | **+1** | `platform-integrate` when `CARINA_PLATFORM_TOOLS=true` |

**Reference comparison (Hermes):** 27 core agent primitives plus integration splits; public docs cite **99+** tools including gaming and channel-specific variants. Carina matches or exceeds Hermes on all non-gaming core primitives and adds workspace, ops, kanban granular, and Scout-gated high-risk tools.

**Carina advantage areas:** workspace surfaces (`notes-manage`, `documents-manage`, `images-gallery`), ops (`secrets-audit`), granular integrations (Home Assistant, Feishu, Spotify, kanban), MCP client, computer-use, mixture-of-agents, checkpoint manager, domain packs.

## Runtime surfaces

| Surface | How tools are exposed |
|---|---|
| **Agent loop** | `ToolRegistry` via `src/tools/index.ts`; filtered per platform toolsets |
| **CLI** | `carina chat`, `carina tools list`, entrance snapshot tool count |
| **Web gateway** | Same registry; platform preset `web` includes workspace toolset |
| **MCP server** | `src/mcp/server/tool-catalog.ts`; read-safe subset unless dangerous allowed |
| **Cron jobs** | `cronjob` tool schedules jobs with per-job toolset restriction |
| **Subagents** | `delegate-task` spawns leaf agents with `filterLeafTools()` |
| **Playwright** | Browser tools registered by `registerBrowserToolsIfAvailable()` |
| **Ops** | `secrets-audit` agent tool mirrors `carina secrets audit` CLI |
| **Skill packs** | `domain_lookup` and pack HTTP tools via `src/skills/index.ts` |
| **Extensions** | `src/extensions/tools.ts` registers bundle-defined HTTP tools |

## Toolsets

| Toolset | Tools | Purpose |
|---|---:|---|
| `terminal` | 2 | Shell execution and background process control |
| `file` | 4 | Read, write, patch, search local files |
| `web` | 2 | HTTP requests and web search |
| `browser` | 12 | Playwright automation (optional) |
| `search` | 2 | Web search and session full-text search |
| `skills` | 4 | List, view, manage, curate skills |
| `sync` | 2 | Agent sync and contacts lookup |
| `messaging` | 6 | Outbound messages, email, webhooks, PDF |
| `media` | 9 | Vision, video, TTS, STT, image/video generation, Spotify |
| `mcp` | 1 | External MCP server client |
| `orchestration` | 12 | Delegate, cron, kanban (combined + granular) |
| `debug` | 2 | Debug helpers and LSP queries |
| `checkpoint` | 1 | Workspace checkpoint snapshots |
| `integrations` | 17 | Home Assistant, X, Discord, Feishu, Yuanbao, platform |
| `ensemble` | 1 | Mixture-of-agents |
| `workspace` | 3 | Notes, documents, image gallery CRUD |
| `ops` | 2 | Secrets audit and debug helpers |

Default least-privilege install enables: `web`, `search`, `file`, `skills`. Web gateway also enables `workspace`.

## Tools by category

### Terminal and code (3)

| Tool | Purpose |
|---|---|
| `shell-exec` | Execute shell commands (foreground, background, optional PTY) |
| `process` | Poll, log, kill, and write to background processes |
| `code-exec` | Sandboxed script execution with bridged tool access |

### File (4)

| Tool | Purpose |
|---|---|
| `file-read` | Line-numbered file reads with pagination |
| `file-write` | Create or overwrite files |
| `patch` | Fuzzy find-and-replace edits |
| `search-files` | Ripgrep content and glob search |

### Web (2)

| Tool | Purpose |
|---|---|
| `http-request` | Outbound HTTP to APIs |
| `web-search` | Public web search |

### Memory (2)

| Tool | Purpose |
|---|---|
| `memory` | Persistent facts across sessions |
| `session-search` | Full-text search of past transcripts |

### Workspace (4)

| Tool | Purpose |
|---|---|
| `todo` | In-session task list synced to notes surface |
| `notes-manage` | CRUD notes, tasks, reminders (`/notes`) |
| `documents-manage` | CRUD workspace documents (`/documents`) |
| `images-gallery` | List, inspect, delete gallery images (`/images`) |

### Orchestration (12)

| Tool | Purpose |
|---|---|
| `delegate-task` | Parallel subagent spawning |
| `cronjob` | Scheduled and chained autonomous jobs |
| `kanban` | Combined kanban board tool |
| `kanban-show` | Board summary |
| `kanban-list` | List cards |
| `kanban-create` | Create cards |
| `kanban-complete` | Complete cards |
| `kanban-block` | Block cards |
| `kanban-unblock` | Unblock cards |
| `kanban-link` | Link related cards |
| `kanban-comment` | Add card comments |
| `kanban-heartbeat` | Stale card checks |

### Interaction (1)

| Tool | Purpose |
|---|---|
| `clarify` | Ask user multiple-choice or open questions |

### Messaging (6)

| Tool | Purpose |
|---|---|
| `send-message` | Unified outbound to enabled channels |
| `webhook` | Subscribe and emit webhook events |
| `email-send` | Send email via provider |
| `email-smtp-send` | Send email via SMTP |
| `email-list` | List inbound email activity |
| `generate-pdf` | Render PDF from HTML or markdown |

### Skills (4)

| Tool | Purpose |
|---|---|
| `skills-list` | List installed skills |
| `skill-view` | Load skill content |
| `skill-manage` | Create, update, delete skills |
| `skill-curator` | Curate and merge skills |

### Sync (2)

| Tool | Purpose |
|---|---|
| `agent-sync` | Remote agent state sync |
| `contacts` | Profile contact lookup |

### Media (9)

| Tool | Purpose |
|---|---|
| `vision-analyze` | Image understanding |
| `video-analyze` | Video understanding |
| `transcription` | Speech-to-text |
| `text-to-speech` | Text-to-speech audio |
| `image-generation` | DALL-E image generation (persists to gallery) |
| `video-generation` | Video generation when configured |
| `spotify-search` | Spotify catalog search |
| `spotify-now-playing` | Current playback |
| `spotify-play` | Playback control |

### MCP (1)

| Tool | Purpose |
|---|---|
| `mcp` | Connect to external MCP servers |

### Browser (12, optional Playwright)

| Tool | Purpose |
|---|---|
| `browser-navigate` | Open URL |
| `browser-click` | Click by ref |
| `browser-type` | Type into inputs |
| `browser-press` | Keyboard keys |
| `browser-scroll` | Scroll viewport |
| `browser-snapshot` | Accessibility tree snapshot |
| `browser-console` | Console output and JS eval |
| `browser-back` | History back |
| `browser-get-images` | List page images |
| `browser-vision` | Vision-assisted browsing |
| `browser-cdp` | Chrome DevTools Protocol control |
| `browser-dialog` | Handle alert/confirm/prompt |
| `computer-use` | Desktop automation (opt-in, Scout gated) |

### Integrations (17)

| Tool | Purpose |
|---|---|
| `homeassistant` | Legacy combined HA tool |
| `ha-list-entities` | List HA entities |
| `ha-get-state` | Read entity state |
| `ha-list-services` | List HA services |
| `ha-call-service` | Trigger HA services |
| `x-search` | Search X/Twitter |
| `x-post` | Post to X/Twitter |
| `discord` | Discord messaging |
| `discord-admin` | Discord admin actions |
| `feishu-doc` | Feishu documents |
| `feishu-drive` | Feishu drive |
| `feishu-chat-send` | Feishu chat |
| `feishu-user-lookup` | Feishu user lookup |
| `yuanbao` | Legacy Yuanbao tool |
| `yb-chat` | Yuanbao chat |
| `yb-search` | Yuanbao search |
| `platform-integrate` | macOS integrations (opt-in) |

### Debug, checkpoint, ensemble (4)

| Tool | Purpose |
|---|---|
| `debug-helpers` | Operator debug metadata |
| `lsp` | Language server queries |
| `checkpoint-manager` | Workspace checkpoints |
| `mixture-of-agents` | Multi-model ensemble |

### Ops (1)

| Tool | Purpose |
|---|---|
| `secrets-audit` | Read-only local secrets hygiene scan |

### Pack-specific (optional)

| Tool | Purpose |
|---|---|
| `domain_lookup` | Vertical pack domain lookup |

## Hermes reference parity

| Hermes core tool | Carina equivalent | Status |
|---|---|---|
| `terminal` | `shell-exec` + `process` | DONE |
| `read_file` / `write_file` | `file-read` / `file-write` | DONE |
| `patch` | `patch` | DONE |
| `search_files` | `search-files` | DONE |
| `execute_code` | `code-exec` | DONE |
| `browser_*` (9) | `browser-*` (12) | DONE + extras |
| `delegate_task` | `delegate-task` | DONE |
| `cronjob` | `cronjob` | DONE |
| `memory` | `memory` | DONE |
| `session_search` | `session-search` | DONE |
| `clarify` | `clarify` | DONE |
| `todo` | `todo` | DONE |
| `send_message` | `send-message` | DONE |
| `text_to_speech` | `text-to-speech` | DONE |
| `skill_view` / `skills_list` / `skill_manage` | `skill-view` / `skills-list` / `skill-manage` | DONE |
| Notes and tasks surface | `notes-manage` | NEW (2026-06-15) |
| Documents surface | `documents-manage` | NEW (2026-06-15) |
| Image gallery surface | `images-gallery` + `image-generation` | NEW (2026-06-15) |
| Secrets hygiene | `secrets-audit` | NEW (2026-06-15) |

**Skipped by policy:** gaming tools (minecraft, pokemon), cross-agent Hermes handoff.

## Validation

```bash
cd core.carinaai.uk
pnpm test src/tools/tool-surface-catalog.test.ts
pnpm test src/tools/tool-security-regression.test.ts
carina tools list
carina tools audit
carina tools audit --json
```

## Maintenance

When adding a tool:

1. Register in `src/tools/index.ts`
2. Add to `TOOLSET_MAP` in `src/tools/toolset.ts`
3. Classify in `src/tools/tool-risk-registry.ts`
4. Add `TOOL_META` entry in `src/tools/tool-surface-catalog.ts`
5. Add `*.test.ts` beside the implementation
6. Update this file and `docs.carinaai.uk/docs/user/capability-inventory.md` counts
