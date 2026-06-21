# Carina Build Status

Last updated after process tool, dashboard, and audit closure.

**Full comparison and Hermes gap tracker:** [`../BUILD_NEXT_CHECKLIST.md`](../BUILD_NEXT_CHECKLIST.md)

## Capability comparison (current)

| Capability | Carina | Hermes | OpenClaw |
|---|---|---|---|
| Chat interface | Web UI + Telegram + Discord + Slack + SMS | Terminal | Terminal |
| CLI | npm install -g carina | Binary | Folder-based |
| Security (Scout) | 10-layer shield, kill switch, audit | Partial | None |
| Domain packs | property, healthcare, finance + 4 general packs (all optional) | 70+ skills | None |
| User skill upload | Yes (JSON in CARINA_RESOURCES_DIR/skills/) | No | Markdown files |
| Resource directory | CARINA_RESOURCES_DIR (knowledge + skills + packs) | No | Workspace folder |
| Multi-channel | Telegram, Discord, Slack, SMS, WhatsApp, Web | Same | None |
| Browser automation | 9 Playwright tools | 9 tools | No |
| Parallel subagents | delegate-task (batch, depth=1, cancel on parent end) | delegate_task | No |
| Background processes | process tool + shell-exec background=true | process | No |
| Python scripting | code-exec | execute_code | No |
| Cron/scheduling | cronjob tool | cronjob | Heartbeat |
| Session search | Postgres FTS | SQLite FTS5 | No |
| Persistent memory | memory tool + Postgres | memory tool | MEMORY.md |
| TTS | text-to-speech + Telegram /speak | TTS native | No |
| Workspace files | AGENTS.md, SOUL.md, USER.md, MEMORY.md | No | Yes |
| Proactive check-in | CheckInScheduler (email, weather, git) | Cron | Heartbeat |
| Gaming skills | Excluded by policy | Included | No |

## All skill packs (optional; enable via ACTIVE_SKILL_PACKS)

| Pack | Category | Skills | Enable |
|---|---|---|---|
| property-uk | property | 6 | ACTIVE_SKILL_PACKS=property-uk |
| healthcare | healthcare | 5 | ACTIVE_SKILL_PACKS=healthcare |
| finance | finance | 5 | ACTIVE_SKILL_PACKS=finance |
| core-engineering | engineering | 18 | ACTIVE_SKILL_PACKS=core-engineering |
| creative-basics | creative | 7 | ACTIVE_SKILL_PACKS=creative-basics |
| productivity | productivity | 8 | ACTIVE_SKILL_PACKS=productivity |
| research-basics | research | 5 | ACTIVE_SKILL_PACKS=research-basics |

Multiple packs: `ACTIVE_SKILL_PACKS=property-uk,finance,healthcare`

No pack active by default. Carina runs as a general-purpose agent until packs are opted in. Base system prompt, skill matching, and RAG retrieval all respect this boundary.

## User resources

```
~/.carina/resources/          (or CARINA_RESOURCES_DIR)
  skills/                     Drop .json skill files here
  knowledge/                  Drop .md docs for RAG ingestion
  packs/                      Custom pack directories (pack.json + skills.ts)
```

Point the agent at resources: use `@resources/path/to/file.md` in file-read/write paths.

Import a skill file: place JSON at `resources/skills/my-skill.json`

## Action prompt status (46 total)

### Built and deployed

- Phase 1 (6): email, telegram (+ TTS /speak), briefing, TTS module, floor plan, scout
- Phase 2 tools (8): terminal (+ workdir/timeout/background), process (list/poll/log/wait/kill/stdin), file-system, execute-code, browser, delegate-task, cronjob, memory-session
- Phase 2 gap-closure (17): all deployed
- Phase 3 skills (6): all packs ported (gaming excluded only)
- Phase 4 (3): workspace files, proactive check-in, group chat
- Phase 5 (3): model routing, packs marketplace API, unique features
- Scout dashboard: `public/dashboard/` in Carina (proxied to Scout API); full SOC UI at `console.labyrinthscout.com`
- FINAL_AUDIT: Carina 236 tests green, Scout 238 tests green

### Still pending

| Prompt | What remains |
|---|---|
| phase5-advanced/02-cross-agent | Not needed; Carina is self-contained. Use internal tools instead |

### Explicitly excluded (policy)

- Gaming skills only: minecraft-bot, pokemon-tcg-pocket, and all gaming category skills
- obliteratus (safety removal technique)
- Hermes/OpenClaw cross-agent handoff (no external agent runtime)

## Quick validation

```bash
cd core.carinaai.uk
pnpm test          # 236 tests
pnpm build
ACTIVE_SKILL_PACKS=property-uk,finance pnpm cli
```
