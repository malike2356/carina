# Gap 27 - Prompt 02: Multi-Agent Routing & System Prompt Docs

**Gap:** 27 Documentation: Agent Architecture
**Prompt number:** 02 of 03
**Name:** Write multi-agent-routing.md and system-prompt.md
**Primary agent:** Claude Code (docs writing)
**Estimated hours:** 2 h
**Depends on:** Nothing (can run parallel with prompt 01)

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

1. `internal/servers/core.carinaai.uk/src/workspaces/agent-routing.ts` -- routing
2. `internal/servers/core.carinaai.uk/src/agents/system-prompt.ts` -- prompt assembly
3. `internal/servers/core.carinaai.uk/src/platform/platform-knowledge.md` -- runtime knowledge

---

## Goal: Write 2 architecture pages

### 1. `docs/developer/architecture/multi-agent-routing.md`

```markdown
# Multi-Agent Routing

## Overview
Carina's Gateway can host multiple isolated agents, each with its own
workspace, session store, skill packs, and model configuration. Messages
are routed to the correct agent based on a deterministic binding system.

## Agent Isolation
Each agent has:
- **Workspace**: separate working directory with AGENTS.md, SOUL.md
- **Sessions**: per-agent session store with isolation modes
- **Skills**: per-agent skill allowlist
- **Models**: per-agent model override
- **Tools**: per-agent tool allowlist/blocklist
- **Sandbox**: per-agent sandbox mode (off, Docker, SSH, OpenShell)

## Routing Bindings

Messages are matched to agents by specificity, most-specific-first:

| Binding | Priority | Example |
|---------|----------|---------|
| Contact | 105 | Specific phone number or user ID |
| Peer | 100 | Specific channel peer |
| Guild | 60 | Discord server, Slack workspace |
| Team | 50 | Microsoft Teams team |
| Account | 40 | Channel account |
| Channel | 30 | Telegram, Discord, WhatsApp |
| Default | 10 | Fallback agent |

## Routing Example

```yaml
agents:
  - id: default
    name: Main Assistant
    models: [anthropic/claude-sonnet-4-6]

  - id: code-reviewer
    name: Code Review Agent
    models: [anthropic/claude-opus-4-6]
    bindings:
      - channel: telegram
        peer: "+44123456789"  # routes Laud's Telegram to this agent

  - id: family-assistant
    name: Family Agent
    models: [openai/gpt-5.5]
    bindings:
      - channel: whatsapp
        group: "Family Group"
```

## DM Isolation Modes

| Mode | Behaviour |
|------|-----------|
| `shared` | All DMs share one session (default) |
| `per-peer` | Each peer gets their own session |
| `per-channel-peer` | Separate session per channel+peer combo |
| `per-account-channel-peer` | Fully isolated per account, channel, and peer |

## Cross-Agent Memory
Agents can share memory via `extraCollections` in the memory config.
A family agent can search the main agent's memory for shared context.

## Where to find it in source
- `workspaces/agent-routing.ts` -- routing engine
- `gateway/router.ts` -- GatewayRouter binding resolution
- `config/schema.ts` -- agent configuration schema
```

### 2. `docs/developer/architecture/system-prompt.md`

```markdown
# System Prompt Assembly

## Overview
Carina builds a fresh system prompt for every turn. The prompt is
assembled from multiple sections, each owned by a different subsystem.
No runtime default exists -- the prompt is always custom-built.

## Prompt Assembly Order

1. **Identity** (SOUL.md) -- agent persona, boundaries, voice
2. **Workspace Context** (AGENTS.md, TOOLS.md) -- repository instructions
3. **Tool Definitions** -- available tools filtered by allowlist + tier
4. **Skill Pack Instructions** -- loaded skill pack procedures
5. **Memory Context** -- MEMORY.md facts, daily notes, REM promotions
6. **Standing Orders** -- persistent user directives
7. **Session Context** -- current transcript, linked channel context
8. **Channel Context** -- channel-specific routing, reply destination
9. **Security Posture** -- sandbox mode, Scout threat level, approval policy
10. **Runtime Metadata** -- current time, model, provider, workspace path
11. **Output Directives** -- channel format constraints, thinking level

## Cache Boundary

The first 7 sections are stable across turns and cached. Sections 8-11
are volatile and rebuilt each turn. This optimises token usage while
keeping context fresh.

## Bootstrap Files

On first turn in a workspace, Carina injects bootstrap files:

| File | Purpose | Required |
|------|---------|----------|
| AGENTS.md | Operating instructions for this repository | No |
| SOUL.md | Agent persona and behavioural boundaries | No |
| TOOLS.md | Tool-specific notes and conventions | No |
| MEMORY.md | Long-term durable facts and preferences | No |
| HEARTBEAT.md | Scheduled check-in guidance | No |

Missing files get a marker in the prompt. BOOTSTRAP.md (one-time
ritual) is injected only once and deleted after completion.

## Prompt Modes

| Mode | Use Case |
|------|----------|
| `full` | Normal conversation (default) |
| `minimal` | Sub-agents, quick commands |
| `none` | Identity only (raw LLM passthrough) |

## Where to find it in source
- `agents/system-prompt.ts` -- prompt assembly engine
- `platform/platform-knowledge.md` -- runtime knowledge
- `agents/bootstrap.ts` -- bootstrap file handling
```

---

## Sidebar update

Add both pages under the "Architecture" category in `sidebars.ts`.

---

## Existing Carina files to reference

- `internal/servers/core.carinaai.uk/src/workspaces/agent-routing.ts`
- `internal/servers/core.carinaai.uk/src/agents/system-prompt.ts`
- `internal/servers/core.carinaai.uk/src/agents/bootstrap.ts`
