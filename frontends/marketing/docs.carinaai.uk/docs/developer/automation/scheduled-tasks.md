# Scheduled tasks and cron

Carina runs recurring and one-shot jobs through the cron subsystem and cloud scheduled tasks UI.

## Self-hosted cron

Define jobs in `~/.carina/cron/` or via CLI:

```bash
carina cron list
carina cron add --schedule "0 9 * * *" --command "Summarize overnight logs"
```

Jobs spawn agent turns or shell commands depending on template. Scout policy applies to agent jobs.

## Cloud scheduled tasks

In [app.carinaai.uk](https://app.carinaai.uk), open **Tasks** or **Cron** from the workspace sidebar. Tasks store schedule, prompt, and last run status in the workspace database.

## Taskflow integration

Complex flows (multi-step with delivery queue) use taskflow runners when enabled (`taskflow/` modules in core).

## Monitoring

- Logs: see [Logging and monitoring](/docs/user/carina-ops/logging-and-monitoring)
- Failed runs surface in ops audit exports (Carina Ops)

## Source references

- `agents/cron*.ts` / gateway cron routes
- Cloud: `scheduledTasks` schema in app.carinaai.uk

## Related

- [Automation hooks](/docs/developer/automation/hooks)
- [Delegation](/docs/developer/architecture/delegation)
