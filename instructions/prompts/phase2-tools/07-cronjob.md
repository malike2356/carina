# Phase 2.7 — cronjob Tool

## Task
Implement the `cronjob` tool. This allows Carina to schedule recurring tasks with cron syntax, run background watchdog scripts, chain jobs together, and deliver results to multiple channels.

## Specification

### Actions
- create: Schedule a new job
- list: Inspect all jobs
- update: Modify an existing job
- pause/resume: Toggle job active state
- remove: Delete a job
- run: Execute a job immediately

### Parameters (create action)
- schedule (string, required): Cron expression or shorthand
  - Formats: '30m', 'every 2h', '0 9 * * *', ISO timestamp '2026-06-01T09:00:00'
- prompt (string, required): Self-contained prompt (runs in fresh session, no chat context)
- name (string, optional): Human-friendly label
- repeat (int, optional): Repeat count (1 = once, unset = forever)
- deliver (string, optional): Where to send output
  - 'origin': back to current chat (default)
  - 'local': no delivery, save only
  - 'all': fan out to every connected channel
  - Specific: 'telegram:chat_id:thread_id', 'discord:#channel'
- skills (array, optional): Skill names to load before executing
- model (object, optional): Per-job model override { provider, model }
- script (string, optional): Path to script (.sh/.bash/.py)
  - Runs each tick, stdout injected into prompt as context
- no_agent (bool, default false): Run script-only, skip LLM
  - When true: script IS the job, stdout delivered verbatim
  - Empty stdout = silent (nothing delivered)
  - Non-zero exit = error alert
  - Use for: watchdogs, health checks, CI polling
- context_from (array, optional): Job IDs whose previous output is injected as context
  - Enables job chaining: Job A collects data, Job B processes it
- enabled_toolsets (array, optional): Restrict tools for this job
  - Reduces token overhead for focused jobs
- workdir (string, optional): Working directory for the job
- profile (string, optional): Hermes profile to run under
  - Uses that profile's config, env, skills

### List action
Returns array of all jobs with: job_id, name, schedule, status, last_run, next_run

### Implementation notes
- Jobs run in fresh sessions with no memory of chat history
- Prompts must be fully self-contained
- Cron run sessions cannot recursively schedule more cron jobs
- Scripts resolve relative paths under ~/.hermes/scripts/
- .sh/.bash extensions run via bash, everything else via Python

### Use cases
- Data collection: "Every hour, check the server disk usage and report if over 90%"
- Watchdog: "Every 5 minutes, check if nginx is running, restart if not"
- Daily briefing: "Every weekday at 8am, compile portfolio summary and send to Telegram"
- Cleanup: "Every Sunday at 4am, remove temp files older than 7 days"
- Chaining: Job 1 fetches emails -> Job 2 processes them -> Job 3 sends summary

### Verification
```bash
# Create a recurring job
cronjob: {
  action: "create",
  schedule: "every 30m",
  name: "Health check",
  prompt: "Check if nginx is running. Report status to user.",
  deliver: "origin"
}

# Create a one-shot reminder
cronjob: {
  action: "create",
  schedule: "2026-06-05T14:00:00",
  prompt: "Remind Laud about the meeting with Salim at 2pm.",
  repeat: 1
}

# List all jobs
cronjob: { action: "list" }

# Chain jobs
cronjob: {
  action: "create",
  schedule: "0 9 * * *",
  prompt: "Process the email data collected by job-abc and send a summary.",
  context_from: ["job-abc"]
}
```
