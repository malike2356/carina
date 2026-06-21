# Gap 28 - Prompt 02: Automation Documentation (Cron, Tasks, Hooks)

**Gap:** 28 Documentation: Plugin System & Automation
**Prompt number:** 02 of 02
**Name:** Write scheduled-tasks and hooks reference docs
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

1. `internal/servers/core.carinaai.uk/src/agents/cron-scheduler.ts` -- cron
2. `internal/servers/core.carinaai.uk/src/agents/scheduled-tasks.ts` -- task scheduler
3. `internal/servers/core.carinaai.uk/src/ops/taskflows/` -- taskflow engine

---

## Goal

### 1. `docs/developer/automation/scheduled-tasks.md`

```markdown
# Scheduled Tasks & Automation

## Overview
Carina can run tasks on a schedule without user interaction. Three
scheduling mechanisms are available: cron jobs, interval tasks, and
taskflows.

## Cron Jobs

Cron jobs run at fixed times using standard cron syntax.

### Creating a Cron Job

```bash
carina cron add "Morning briefing" \
  --schedule "0 8 * * *" \
  --prompt "Summarise today's calendar, weather, and top news"
```

### Cron Syntax
| Field | Values |
|-------|--------|
| Minute | 0-59 |
| Hour | 0-23 |
| Day of month | 1-31 |
| Month | 1-12 |
| Day of week | 0-7 (0 and 7 are Sunday) |

### Job Types

| Type | Description |
|------|-------------|
| `prompt` | Run an LLM prompt on schedule |
| `script` | Execute a shell script or Python file |
| `no-agent` | Run script only, skip LLM (watchdog pattern) |
| `chained` | Run after another job completes |

### Delivery

Cron results can be delivered to:
- The originating channel (`--deliver origin`)
- All connected channels (`--deliver all`)
- A specific channel (`--deliver telegram`)
- Local only, no delivery (`--deliver local`)

### Management

```bash
carina cron list                    # List all jobs
carina cron pause <job-id>          # Pause a job
carina cron resume <job-id>         # Resume a job
carina cron remove <job-id>         # Delete a job
carina cron history <job-id>        # View run history
carina cron run <job-id>            # Run immediately (manual trigger)
```

## Interval Tasks

Tasks that run every N minutes (simpler than cron):

```bash
carina task add "Health check" \
  --interval 30m \
  --script ~/.carina/scripts/health-check.sh
```

## Taskflows

Multi-step workflows defined in YAML:

```yaml
# ~/.carina/taskflows/deploy-check.yaml
name: Deploy Verification
steps:
  - name: Check Docker
    run: docker ps --format '{{.Names}}'
  - name: Check endpoints
    run: curl -s -o /dev/null -w '%{http_code}' http://localhost:3333/health
  - name: Notify on failure
    if: failure
    run: carina notify "Deploy verification failed"
```

```bash
carina taskflow run deploy-check
```

## Where to find it in source
- `agents/cron-scheduler.ts` -- cron engine
- `agents/scheduled-tasks.ts` -- interval task runner
- `ops/taskflows/engine.ts` -- taskflow engine
```

### 2. `docs/developer/automation/hooks.md`

```markdown
# Lifecycle Hooks Reference

## Overview
Hooks are interception points in Carina's runtime. Plugins and
extensions register handlers that fire at specific lifecycle events.

## Hook Reference

### Agent Hooks
| Hook | Fires | Can Block? |
|------|-------|-----------|
| `agent:start` | Agent turn begins | Yes |
| `agent:end` | Agent turn completes | No |
| `before:model-resolve` | Before model selection | Yes |
| `before:prompt-build` | Before system prompt assembly | No |
| `before:tool-call` | Before each tool execution | Yes |
| `after:tool-call` | After each tool execution | No |
| `before:compaction` | Before context compaction | No |
| `after:compaction` | After context compaction | No |

### Session Hooks
| Hook | Fires | Can Block? |
|------|-------|-----------|
| `session:start` | New session created | No |
| `session:end` | Session closing | No |

### Message Hooks
| Hook | Fires | Can Block? |
|------|-------|-----------|
| `message:received` | Inbound message arrives | Yes |
| `message:sending` | Before sending response | Yes |
| `message:sent` | After response delivered | No |

### Gateway Hooks
| Hook | Fires | Can Block? |
|------|-------|-----------|
| `gateway:start` | Gateway process starts | No |
| `gateway:stop` | Gateway shutting down | No |

### Installation Hooks
| Hook | Fires | Can Block? |
|------|-------|-----------|
| `before:install` | Before plugin install | Yes |

## Blocking Semantics
- Returning `{ block: true }` from a hook prevents the action
- Multiple hooks can fire for the same event
- Block decisions are resolved: if any hook blocks, the action is cancelled
- Terminal hooks (`agent:start`, `session:start`) stop further processing
  when blocked

## Hook Registration

### Via Plugin (plugin.json)
```json
{
  "name": "my-plugin",
  "hooks": ["agent:start", "before:tool-call"]
}
```

### Via Extension
```javascript
// ~/.carina/extensions/hooks/agent-start.js
export default async function(params) {
  // Your hook logic
}
```

## Where to find it in source
- `plugins/registry.ts` -- hook registration and dispatch
- `extensions/hooks-loader.js` -- extension hook loader
```

---

## Sidebar update

Add an "Automation" category in `sidebars.ts` under developer docs.

---

## Existing Carina files to reference

- `internal/servers/core.carinaai.uk/src/agents/cron-scheduler.ts`
- `internal/servers/core.carinaai.uk/src/agents/scheduled-tasks.ts`
- `internal/servers/core.carinaai.uk/src/ops/taskflows/`
- `internal/servers/core.carinaai.uk/src/plugins/registry.ts`
