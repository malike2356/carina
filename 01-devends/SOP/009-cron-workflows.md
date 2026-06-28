# SOP 009: Cron Workflows
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** Migrated from planning/operations/CRON_WORKFLOWS.md
**Last reviewed:** 2026-06-25

---

# Cron Workflows

Carina cron supports single scheduled jobs and multi-step workflows with retries, scoped context handoff, and multi-channel delivery.

## When to use what

| Feature | Single job (`cronjob` tool) | Workflow (`carina cron workflow`) |
|---|---|---|
| One prompt on a schedule | Yes | Yes (1-step workflow) |
| Linear multi-step chain | `chain_after` on jobs | `steps` with `needs` |
| Retries per step | No | `retries` per step |
| Persisted run state | `scheduled_task_runs` | `cron_workflow_runs` |
| Scoped context | `context_from` (job IDs) | `context_from` / `needs` (step IDs) |
| Failure delivery | Manual | `on_failure` block |

## Declarative workflow format (YAML)

```yaml
name: morning-briefing
schedule: "0 9 * * *"
deliver: origin
deliver_on: last          # last | each | failed
max_step_output_chars: 8000

steps:
  - id: inbox
    prompt: Summarize unread email and flag urgent items
    deliver: false

  - id: brief
    prompt: Write a 3-bullet morning brief for the operator
    needs: [inbox]
    context_from: [inbox]
    retries: 2
    retry_delay_ms: 5000
    deliver: false

  - id: notify
    prompt: Format the brief for chat delivery
    needs: [brief]
    deliver:
      - origin
      - telegram:12345

on_failure:
  deliver: origin
  message: "Workflow failed at step {{step}}"
```

### Step fields

| Field | Description |
|---|---|
| `id` | Stable step name (`a-z`, digits, `_`, `-`) |
| `prompt` | Agent task (required unless `no_agent` + script) |
| `script_path` | Script under `data/scripts/` |
| `no_agent` | Script-only step |
| `needs` | Step IDs that must succeed first |
| `context_from` | Step outputs injected into prompt (defaults to `needs`) |
| `retries` | Retry count after failure (default 0) |
| `retry_delay_ms` | Delay between retries (default 2000) |
| `deliver` | `false`, channel spec, or list of channel targets |
| `enabled_toolsets` | Restrict tools for this step |
| `workdir` | Override workflow workdir for this step |

### Delivery modes

- `deliver_on: last` (default): deliver after the final step only
- `deliver_on: each`: deliver after every step that has delivery configured
- `deliver_on: failed`: deliver only when the workflow fails (with `on_failure`)
- Per-step `deliver: false` suppresses intermediate noise

Channel targets use the same syntax as single jobs: `origin`, `telegram:chat_id`, `discord:channel`, comma-separated lists.

## Operator commands

```bash
# Workflows
carina cron workflow list
carina cron workflow import workflows/morning-briefing.yaml
carina cron workflow run <workflow-id>
carina cron workflow runs <workflow-id>
carina cron workflow retry <run-id>
carina cron workflow pause|resume|remove <workflow-id>

# Single jobs (unchanged)
carina cron list
carina cron pause|resume|remove <job-id>
```

## Context isolation

Workflow runs store step outputs in a per-run context bag keyed by step ID. Each step only receives outputs listed in `context_from` (or `needs` when `context_from` is omitted). Unrelated step output is never injected.

Chained single jobs (`chain_after`) pass only the immediate parent output via `chainedFrom`; use workflows when you need retries, persisted state, or explicit dependency graphs.

## Recovery

- Failed workflow runs are recorded in `cron_workflow_runs` with per-step `step_states`
- Retry with `carina cron workflow retry <run-id>` (resumes from failed step, skips succeeded steps)
- Webhook event `cron.complete` includes `workflow_id`, `run_id`, and `success`

## Schedule formats

Same as single jobs: `30m`, `every 2h`, `0 9 * * *`, or ISO timestamp for one-shot.

## Trial warning cron (Aiva platform)

The platform runs a daily cron at 08:00 UTC that sends trial warning emails to tenants at days 12, 13, and 14 of their 15-day trial. This is a platform-level cron in the Carina core, not a user-created workflow.

## Agent tool

Use the `cronjob` tool for single jobs. For multi-step workflows, prefer `carina cron workflow import` or ops automation; workflows are operator-scoped to reduce accidental complex chains from casual agent turns.
