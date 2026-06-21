# Prompt 04: Expand CLI to 150+ Commands


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

As of 2026-06-10, `bin/carina.ts` has 49 CLI commands. The platform has 71 tools, 16 skill
packs, 18 channel adapters, and full Scout integration. Many capabilities are not exposed
as CLI commands. Operators need all platform capabilities accessible from the shell.

## Target Command Categories

### Memory commands (add ~10 commands)
```bash
carina memory list [--project <id>] [--limit <n>]
carina memory search "<query>" [--semantic]
carina memory show <id>
carina memory edit <id>
carina memory delete <id>
carina memory export [--format json|csv] [--output file.json]
carina memory import <file.json>
carina memory prune [--older-than <days>]
carina memory stats
carina memory link <memory-id> <project-id>
```

### Project commands (add ~8 commands)
```bash
carina project list
carina project create "<name>" [--description "..."]
carina project show <id>
carina project archive <id>
carina project delete <id>
carina project switch <id>
carina project export <id> [--output dir/]
carina project members add <email>
```

### Channel commands (add ~10 commands)
```bash
carina channel list
carina channel connect <adapter> [--config key=value...]
carina channel test <adapter>
carina channel disconnect <adapter>
carina channel send <adapter> "<message>"
carina channel history <adapter> [--limit 20]
carina channel enable <adapter>
carina channel disable <adapter>
carina channel status
carina channel logs <adapter>
```

### Scout commands (add ~10 commands)
```bash
carina scout status
carina scout score
carina scout events [--limit 20] [--severity critical|high|medium|low]
carina scout alerts
carina scout suppress <event-id>
carina scout policies list
carina scout policies set <policy> <value>
carina scout kill-switch enable
carina scout kill-switch disable
carina scout report [--format pdf|json] [--output report.pdf]
```

### Skills commands (add ~8 commands, expand existing)
```bash
carina skills list [--installed] [--available]
carina skills show <name>
carina skills install <name>
carina skills uninstall <name>
carina skills run <name> [--args key=value...]
carina skills update [<name>]
carina skills publish <name>
carina skills validate <name>
```

### Tools commands (add ~6 commands)
```bash
carina tools list [--category <cat>]
carina tools show <name>
carina tools run <name> [--args key=value...]
carina tools test <name>
carina tools enable <name>
carina tools disable <name>
```

### Distro commands (add ~10 commands - from workspace platform design)
```bash
carina distro create <name>
carina distro list
carina distro dev
carina distro build
carina distro deploy [--target docker|cloud]
carina distro validate
carina distro doctor
carina distro add module <module>
carina distro add skill <skill>
carina distro publish
```

### System commands (add ~10 commands)
```bash
carina doctor
carina config list
carina config get <key>
carina config set <key> <value>
carina config reset
carina update [--channel stable|beta]
carina version
carina logs [--service core|ops|scout] [--tail <n>]
carina restart <service>
carina health
```

### Session management (add ~6 commands)
```bash
carina session list
carina session show <id>
carina session export <id> [--format md|json]
carina session delete <id>
carina session archive <id>
carina session search "<query>"
```

## Implementation Pattern

Each command group goes in its own file under `src/cli/`:
```
src/cli/
├── memory.ts
├── project.ts
├── channel.ts
├── scout.ts
├── skills.ts
├── tools.ts
├── distro.ts
├── system.ts
└── session.ts
```

Each file exports a `registerCommands(program: Command): void` function.
`bin/carina.ts` imports and calls each register function.

## Verification Checklist

- [ ] `carina --help` shows all command categories
- [ ] `carina memory list` returns sessions with memory entries
- [ ] `carina scout status` shows current Scout connection and score
- [ ] `carina channel list` lists all 18 channel adapters with status
- [ ] `carina distro create test-distro` creates scaffold directory
- [ ] `carina --version` shows current version from package.json

## Files to Create or Modify

- CREATE `src/cli/memory.ts`
- CREATE `src/cli/project.ts`
- CREATE `src/cli/channel.ts`
- CREATE `src/cli/scout.ts`
- CREATE `src/cli/tools.ts`
- CREATE `src/cli/distro.ts`
- CREATE `src/cli/system.ts`
- CREATE `src/cli/session.ts`
- MODIFY `bin/carina.ts` - import and register all command groups
