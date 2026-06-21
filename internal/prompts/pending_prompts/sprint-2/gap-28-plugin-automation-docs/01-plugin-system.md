# Gap 28 - Prompt 01: Plugin System Documentation

**Gap:** 28 Documentation: Plugin System & Automation
**Prompt number:** 01 of 02
**Name:** Write plugin overview and building-plugins docs
**Primary agent:** Claude Code (docs writing)
**Estimated hours:** 2 h
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

1. `internal/servers/core.carinaai.uk/src/plugins/registry.ts` -- plugin registry
2. `internal/servers/core.carinaai.uk/src/plugins/loader.ts` -- provider plugin loader
3. `internal/servers/core.carinaai.uk/src/plugins/types.ts` -- plugin types

---

## Goal

### 1. `docs/developer/plugins/overview.md`

```markdown
# Plugin System

## Overview
Carina plugins extend the Gateway with new capabilities: channel adapters,
model providers, tools, and runtime hooks. Plugins are loaded at Gateway
start and can be managed via CLI without restarting.

## Plugin Types

| Type | What it adds | Example |
|------|-------------|---------|
| Channel plugin | New messaging platform | WhatsApp, Discord, LINE |
| Provider plugin | New LLM provider | vLLM, Ollama, custom endpoint |
| Tool plugin | New agent tools | Database query, calendar, IoT |
| Hook plugin | Lifecycle interceptors | Logging, audit, notifications |

## Plugin Structure
~/.carina/plugins/
  my-plugin/
    plugin.json       # manifest (name, version, hooks)
    hooks/
      agent-start.js  # lifecycle hook
      tool-call.js    # tool interception
    tools/
      my-tool.ts      # tool definition
    skills/
      my-skill.md     # bundled skill pack

## Plugin Lifecycle
1. **Discovery**: Carina scans ~/.carina/plugins/ for plugin.json files
2. **Validation**: plugin.json schema checked, dependencies verified
3. **Loading**: hooks registered, tools added to registry, skills loaded
4. **Enable**: plugin active, hooks fire on events
5. **Disable**: hooks unregistered, tools removed
6. **Remove**: plugin directory deleted, state cleaned up

## CLI Commands
carina plugins list              Show installed plugins
carina plugins install <path>    Install from local path or URL
carina plugins enable <name>     Enable a plugin
carina plugins disable <name>    Disable a plugin
carina plugins remove <name>     Uninstall a plugin
carina plugins validate <name>   Check plugin.json and hook schemas
carina hooks list                Show registered hooks

## Where to find it in source
- `plugins/registry.ts` -- plugin registry and lifecycle
- `plugins/loader.ts` -- provider plugin loader
- `plugins/types.ts` -- type definitions
```

### 2. `docs/developer/plugins/building-plugins.md`

```markdown
# Building a Carina Plugin

## Quickstart

Create a plugin skeleton:

```bash
mkdir -p ~/.carina/plugins/my-plugin/hooks
cat > ~/.carina/plugins/my-plugin/plugin.json << 'EOF'
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My first Carina plugin",
  "author": "Your Name",
  "hooks": ["agent-start", "tool-call"]
}
EOF
```

## plugin.json Reference

| Field | Required | Description |
|-------|----------|-------------|
| name | yes | Unique plugin identifier |
| version | yes | Semver version |
| description | no | Human-readable description |
| author | no | Plugin author |
| homepage | no | Plugin website |
| hooks | no | Array of hook names to register |
| tools | no | Array of tool file paths |
| skills | no | Array of skill pack paths |
| requires | no | Minimum Carina version |

## Writing Hooks

A hook is a JavaScript/TypeScript file that exports a handler function:

```typescript
// hooks/agent-start.ts
export default async function(params: {
  sessionId: string;
  agentId: string;
  workspace: string;
}): Promise<void> {
  console.log(`Agent started: ${params.agentId} in ${params.workspace}`);
}
```

### Available Hooks

| Hook | Fires when | Params |
|------|-----------|--------|
| `agent-start` | Agent turn begins | sessionId, agentId, workspace |
| `agent-end` | Agent turn completes | sessionId, agentId, response |
| `tool-call` | Before tool execution | toolName, params, sessionId |
| `tool-result` | After tool execution | toolName, result, duration |
| `session-create` | New session created | sessionId, channelId, userId |
| `session-close` | Session ends | sessionId, reason |
| `gateway-start` | Gateway starts | port, version |
| `gateway-stop` | Gateway shutting down | reason |

### Hook Return Values
- Return `{ block: true }` to prevent the action
- Throwing an error logs it but does not block the action
- Return `undefined` or `{}` to continue normally

## Publishing to Carina Hub

Once your plugin works, publish it to Carina Hub:

```bash
carina hub publish-plugin ./my-plugin \
  --name "My Plugin" \
  --description "Does something useful" \
  --tags "tools, productivity"
```

See [Publishing a Pack](/docs/developer/publishing-a-pack) for details.

## Where to find it in source
- `plugins/registry.ts` -- plugin lifecycle
- `plugins/loader.ts` -- loading mechanism
- `plugins/types.ts` -- type definitions
- `extensions/hooks-loader.js` -- extension hook loader
```

---

## Sidebar update

Add a "Plugins" category in `sidebars.ts` under developer docs with both pages.

---

## Existing Carina files to reference

- `internal/servers/core.carinaai.uk/src/plugins/`
- `internal/servers/core.carinaai.uk/src/extensions/`
