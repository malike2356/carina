# Operator TUI

Carina ships a terminal operator UI for serious daily use: sessions, scheduled tasks, background processes, tools, logs, and chat in one screen.

## Start

```bash
carina tui
carina tui --simple    # line-oriented fallback when full TTY UI is unavailable
```

Tabs: **Sessions**, **Tasks**, **Processes**, **Tools**, **Logs**, **Chat** (keys `1`-`6` or Tab).

## Chat controls

| Input | Action |
|---|---|
| `/help` | List slash commands |
| `/new`, `/reset` | Fresh chat session |
| `/retry` | Resend last user message |
| `/stop`, Esc, Ctrl+C while busy | Interrupt current turn |
| `/tasks`, `/cron` | Jump to Tasks tab |
| `/model`, `/provider` | Switch LLM (gateway commands) |
| `/memories`, `/usage --month` | Memory and cost summaries |
| `:q` | Quit |

Delegation: ask Carina to use **delegate-task** for parallel subagent work. Completed subagents appear on the Tasks tab.

## Tasks tab

Lists cron jobs, taskflow runs, delivery queue rows, background processes, and recent subagent telemetry.

On a selected **cron** row:

- `:pause` pause schedule
- `:resume` resume schedule
- `:run` execute now

On a selected **taskflow** row:

- `:run` trigger the flow (retries failed runs when applicable)

## Scheduled jobs (CLI)

Create jobs without opening the agent:

```bash
carina cron list
carina cron add --schedule "0 9 * * *" --prompt "Summarize overnight alerts" --name morning-digest
carina cron pause <job-id>
carina cron resume <job-id>
carina cron history deploy
carina cron workflow list
```

In chat, the **cronjob** tool also creates schedules with delivery back to the originating session or channel.

## Subagents

Carina already supports isolated subagents via **delegate-task** (worker threads, reduced toolsets, push wake on completion). The TUI does not replace that tool; it surfaces outcomes on the Tasks tab and keeps chat summaries clean.

## Related

- Surfaces decision: [surfaces-decision.md](./surfaces-decision.md)
- CLI gateway chat: [gateways/cli.md](./gateways/cli.md)
- Learning loop recap: [learning-loop.md](./learning-loop.md)
