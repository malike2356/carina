# Gap 07 - Prompt 04: CLI Command Expansion

**Agent:** Claude Code (fallback: Codex)
**Estimated hours:** 5-6 hrs
**Depends on:** Existing CLI registry (`src/cli/registry.ts` and `src/cli/commands/`)

---

## Read First

```
core.carinaai.uk/src/cli/registry.ts        (24KB - existing command registry)
core.carinaai.uk/src/cli/commands/          (existing command implementations)
core.carinaai.uk/bin/carina.ts              (CLI entry point)
core.carinaai.uk/src/cli/completion-metadata.ts  (shell completion scaffold - EXISTS)
core.carinaai.uk/src/agents/
core.carinaai.uk/src/memory/
core.carinaai.uk/src/skills/
core.carinaai.uk/src/channels/
```

---

## Goal

Expand the Carina CLI from its current set to 150+ commands organized into named command groups. Add `--json` output mode to every command. Add command aliases. The spec below defines every new command group and lists commands within each group.

Do NOT invent new backend functionality. Every command maps to existing core backend capabilities.

---

## Architecture

All commands follow the same pattern:

```typescript
// src/cli/commands/{group}/{name}.ts
import { Command } from '../types';
import { getGatewayClient } from '../../gateway/client';

export const command: Command = {
  name: 'workspace list',
  aliases: ['ws ls'],
  description: 'List all workspaces',
  options: [
    { name: '--json', type: 'boolean', description: 'Output as JSON' },
  ],
  async run(args, opts) {
    const client = getGatewayClient();
    const workspaces = await client.getWorkspaces();
    if (opts.json) {
      console.log(JSON.stringify(workspaces, null, 2));
    } else {
      for (const ws of workspaces) {
        console.log(`${ws.id}  ${ws.name}  (${ws.sessionCount} sessions)`);
      }
    }
  },
};
```

Register all commands in `src/cli/registry.ts` using the existing registration pattern.

---

## Command Groups to Add

### Group 1: `workspace` (ws)

```
workspace list         (ws ls)       List all workspaces
workspace create       (ws new)      Create a workspace
workspace switch       (ws use)      Switch to a workspace
workspace rename       (ws mv)       Rename a workspace
workspace delete       (ws rm)       Delete a workspace
workspace current      (ws .)        Show current workspace
workspace export       (ws export)   Export workspace sessions to JSON
```

### Group 2: `session` (s)

```
session list           (s ls)        List sessions (paginated)
session new            (s new)       Create and enter a new session
session resume         (s r)         Resume a session by ID or fuzzy name
session rename         (s mv)        Rename a session
session delete         (s rm)        Delete a session
session export         (s export)    Export session to markdown or JSON
session share          (s share)     Generate shareable link (if feature enabled)
session search         (s find)      Search sessions by content
session stats          (s stats)     Show token usage stats for a session
```

### Group 3: `model` (m)

```
model list             (m ls)        List available models per provider
model use              (m use)       Set active model
model current          (m .)         Show current model
model test             (m test)      Send a test prompt to the current model
model cost             (m cost)      Show cost per 1K tokens for all models
model benchmark        (m bench)     Run latency benchmark across providers
```

### Group 4: `memory` (mem)

```
memory list            (mem ls)      List recent memories
memory add             (mem add)     Manually add a memory
memory search          (mem find)    Fuzzy search memories
memory delete          (mem rm)      Delete a memory by ID
memory clear           (mem clear)   Clear all memories (with confirmation)
memory export          (mem export)  Export all memories to JSON
memory stats           (mem stats)   Count memories by type and date
memory sync            (mem sync)    Force sync memories to/from gateway
```

### Group 5: `task` (t)

```
task list              (t ls)        List active and recent tasks
task create            (t new)       Create a task
task status            (t s)         Show task status by ID
task cancel            (t rm)        Cancel a running task
task watch             (t w)         Stream task output in real time
task export            (t export)    Export task list to JSON
```

### Group 6: `skill` (sk)

```
skill list             (sk ls)       List installed skill packs
skill search           (sk find)     Search the CarinaHub for skills
skill install          (sk i)        Install a skill pack
skill uninstall        (sk rm)       Uninstall a skill pack
skill enable           (sk on)       Enable a skill pack
skill disable          (sk off)      Disable a skill pack
skill info             (sk info)     Show detail for an installed skill
skill update           (sk up)       Update all installed skills
skill publish          (sk pub)      Publish a local skill to the hub
```

### Group 7: `agent` (a)

```
agent list             (a ls)        List active subagents
agent status           (a s)         Show status of a subagent by ID
agent cancel           (a rm)        Cancel a running subagent
agent logs             (a logs)      Stream a subagent's output
agent spawn            (a run)       Manually spawn a subagent with a task
agent history          (a hist)      List completed/failed agents (last 50)
```

### Group 8: `webhook` (wh)

```
webhook list           (wh ls)       List configured webhooks
webhook create         (wh new)      Create a webhook endpoint
webhook delete         (wh rm)       Delete a webhook
webhook test           (wh test)     Send a test payload to a webhook
webhook logs           (wh logs)     Show recent webhook delivery logs
```

### Group 9: `mcp` 

```
mcp list                             List installed MCP servers
mcp add                              Add an MCP server
mcp remove                           Remove an MCP server
mcp test                             Test connection to an MCP server
mcp tools                            List tools exposed by an MCP server
```

### Group 10: `scout` (sec)

```
scout status           (sec s)       Show current trust score and kill switch status
scout events           (sec ev)      List recent security events
scout report           (sec rep)     Generate full shield report
scout kill             (sec kill)    Trigger kill switch (emergency)
scout reset            (sec reset)   Reset kill switch after review
scout policy           (sec pol)     Show current security policy
```

### Group 11: `hub`

```
hub status                           Show CarinaHub connection status
hub featured                         List featured skills on the hub
hub search                           Search hub skills
hub stats                            Show hub usage stats (installs, ratings)
hub auth                             Authenticate with the hub
```

### Group 12: `channel` (ch)

```
channel list           (ch ls)       List configured channels
channel add            (ch new)      Add a channel (wizard)
channel remove         (ch rm)       Remove a channel
channel test           (ch test)     Send a test message via a channel
channel status         (ch s)        Show connection status of all channels
```

### Group 13: `cert`

```
cert status                          Show Built-on-Carina certification status
cert generate                        Generate certification token for embedding
cert verify                          Verify a certification token
cert revoke                          Revoke a certification token
```

### Group 14: `config` (cfg)

```
config list            (cfg ls)      List all config keys and current values
config get             (cfg get)     Get a config value
config set             (cfg set)     Set a config value
config reset           (cfg reset)   Reset a config key to default
config export          (cfg export)  Export full config as JSON
config import          (cfg import)  Import config from JSON file
```

### Group 15: `doctor`

```
doctor                               Run full diagnostics (provider keys, gateway, DB, permissions)
doctor --fix                         Attempt to auto-fix common issues
```

---

## JSON Output Mode

Every command that produces list or structured output must support `--json`:

```typescript
// Pattern for every list command:
if (opts.json) {
  console.log(JSON.stringify(result, null, 2));
  return;
}
// Otherwise: human-readable table/list
```

The JSON output must be parseable by tools like `jq`:
```bash
carina session list --json | jq '.[].id'
carina skill list --json | jq '.[] | select(.enabled == true) | .name'
```

---

## Aliases

Register aliases in the registry so `carina ws ls` works the same as `carina workspace list`:

```typescript
// In registry.ts, for each alias:
registry.alias('ws', 'workspace');
registry.alias('ws ls', 'workspace list');
registry.alias('mem', 'memory');
// etc.
```

---

## Help Output

Each group must have a group-level help:

```bash
$ carina workspace --help
Usage: carina workspace <command>

Commands:
  list     List all workspaces
  create   Create a workspace
  switch   Switch to a workspace
  ...

Aliases: ws
```

And each command's `--help` shows options and an example:

```bash
$ carina session list --help
Usage: carina session list [options]

Options:
  --json         Output as JSON
  --limit <n>    Number of sessions to show (default: 20)
  --since <date> Show sessions since date
  -h, --help     Show this help

Examples:
  carina session list
  carina s ls --json | jq '.[0].id'
  carina session list --since "2026-01-01"
```

---

## Files to Create

```
core.carinaai.uk/src/cli/commands/
├── workspace/
│   ├── list.ts, create.ts, switch.ts, rename.ts, delete.ts, current.ts, export.ts
├── session/
│   ├── list.ts, new.ts, resume.ts, rename.ts, delete.ts, export.ts, search.ts, stats.ts
├── model/
│   ├── list.ts, use.ts, current.ts, test.ts, cost.ts, benchmark.ts
├── memory/
│   ├── list.ts, add.ts, search.ts, delete.ts, clear.ts, export.ts, stats.ts, sync.ts
├── task/
│   ├── list.ts, create.ts, status.ts, cancel.ts, watch.ts, export.ts
├── skill/
│   ├── list.ts, search.ts, install.ts, uninstall.ts, enable.ts, disable.ts, info.ts, update.ts, publish.ts
├── agent/
│   ├── list.ts, status.ts, cancel.ts, logs.ts, spawn.ts, history.ts
├── webhook/
│   ├── list.ts, create.ts, delete.ts, test.ts, logs.ts
├── mcp/
│   ├── list.ts, add.ts, remove.ts, test.ts, tools.ts
├── scout/
│   ├── status.ts, events.ts, report.ts, kill.ts, reset.ts, policy.ts
├── hub/
│   ├── status.ts, featured.ts, search.ts, stats.ts, auth.ts
├── channel/
│   ├── list.ts, add.ts, remove.ts, test.ts, status.ts
├── cert/
│   ├── status.ts, generate.ts, verify.ts, revoke.ts
├── config/
│   ├── list.ts, get.ts, set.ts, reset.ts, export.ts, import.ts
└── doctor/
    └── index.ts
```

## Files to Modify

```
src/cli/registry.ts          → register all new commands and their aliases
src/cli/completion-metadata.ts → update with all new command names/flags for shell completion
```

---

## Done When

- [ ] `carina workspace list` lists workspaces; `carina ws ls` also works
- [ ] `carina session list --json | jq '.[0]'` outputs valid JSON for the first session
- [ ] `carina model list` shows all providers and their available models
- [ ] `carina skill install property-uk` installs the skill from the hub
- [ ] `carina scout status` shows trust score and kill switch state
- [ ] `carina doctor` runs all checks and reports pass/fail per check
- [ ] `carina --help` shows all command groups
- [ ] `carina workspace --help` shows all workspace subcommands
- [ ] All aliases work (test at least: `carina ws ls`, `carina s ls`, `carina mem ls`, `carina sk ls`)
- [ ] `carina completion-metadata.ts` is updated so shell completion covers all new commands
