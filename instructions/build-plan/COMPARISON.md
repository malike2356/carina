# COMPARISON.md; Carina vs Hermes vs OpenClaw

## Architecture

| | Hermes | OpenClaw | Carina (target) |
|---|---|---|---|
| Type | Full autonomous agent | Workspace-scoped agent | Full autonomous agent |
| Scope | System-wide | Single workspace folder | System-wide |
| Config | config.yaml | Markdown workspace files | config.yaml + workspace files |
| License | MIT | MIT | MIT |
| Install | CLI binary | Git clone + markdown | npm install + config |

## Tools

| | Hermes | OpenClaw | Carina (target) |
|---|---|---|---|
| Terminal | Full shell (fg, bg, PTY) | Basic | Full shell |
| Browser | Full automation | None | Full automation |
| Subagents | 3 parallel, isolated | None | 3 parallel, isolated |
| Cron | Scheduled + chaining | None | Scheduled + chaining |
| File ops | read, write, patch, search | Basic read/write | read, write, patch, search |
| Python | execute_code scripts | None | execute_code scripts |
| Messaging | Telegram, Discord, Slack, Signal, Matrix, SMS | None | All Hermes channels |
| Audio | TTS with native delivery | None | TTS with native delivery |

## Memory

| | Hermes | OpenClaw | Carina (target) |
|---|---|---|---|
| Persistent | SQLite DB, injected every turn | Markdown files in workspace | Both SQLite + markdown |
| Search | session_search FTS5 | Agent re-reads daily files | session_search FTS5 |
| Daily logs | Not native | memory/YYYY-MM-DD.md | memory/YYYY-MM-DD.md |
| Long-term | memory tool | MEMORY.md curated | Both memory tool + MEMORY.md |
| Human-readable | No (opaque SQLite) | Yes (plain markdown) | Yes (both formats) |

## Learning

| | Hermes | OpenClaw | Carina (target) |
|---|---|---|---|
| Skills | 70+ pre-built, self-writing | None | 70+ pre-built, self-writing |
| Domain packs | None | None | User-extensible system |
| Self-improvement | Creates skills from workflows | Updates markdown files | Creates skills + updates workspace |

## Proactivity

| | Hermes | OpenClaw | Carina (target) |
|---|---|---|---|
| Scheduled | cronjob with exact timing | Heartbeat ~every 30 min | cronjob + heartbeat both |
| Background | process with notifications | None | process with notifications |
| Event-driven | Webhook subscriptions | None | DB triggers + webhooks |
| Alerting | Via cron | Via heartbeat | Native alerting from DB state |

## Security

| | Hermes | OpenClaw | Carina (target) |
|---|---|---|---|
| Prompt injection | Partial | None | Scout 3-layer shield |
| Kill switch | None | None | Scout kill switch |
| Audit logging | None | None | Scout full audit |
| Egress filtering | None | None | Scout DLP |
| Honeypots | None | None | Scout deception layer |
| Rate limiting | None | None | Scout per-tool/user |

## Unique features (Carina only)

| | Hermes | OpenClaw | Carina (target) |
|---|---|---|---|
| Domain knowledge (framework level) | No | No | Yes |
| Local model routing | No | No | Yes |
| Tool result caching (TTL) | No | No | Yes |
| Event-driven alerting | No | No | Yes |
| Model cost optimization | No | No | Yes |
| Group chat awareness | No | Yes | Yes |
| Workspace files | No | Yes | Yes |
| npm install | No | No | Yes |

## Pricing

| | Hermes | OpenClaw | Carina |
|---|---|---|---|
| Core agent | Free (MIT) | Free (MIT) | Free (MIT) |
| Security | N/A | N/A | Scout: £79-99/mo |
| API costs | $0.50-2/session | Varies | 70-80% less (local models) |

## When to use which

- Hermes: heavy automation, DevOps, complex multi-step tasks, remote server work
- OpenClaw: personal workspace, journaling, lightweight assistant
- Carina: production deployment with security, domain-specific work, cost-sensitive operations

## The Carina comparison table on carinaai.uk

The website comparison table is mostly accurate except:

1. "Self-writing skills: Hermes; No" → FALSE. Hermes has skill_manage with create/patch/edit/delete.
2. "Memory transparency: Hermes; No" → FALSE. Memory is injected every turn, fully viewable and editable.
3. "Switch LLM mid-session: Hermes; No" → DEBATABLE. Multiple providers supported, profile switching possible.
4. "npm install: Hermes; No" → IRRELEVANT. Different packaging, not a capability metric.

The Scout security features are accurately represented. Hermes has partial injection protection; Carina + Scout has full 3-layer protection.
