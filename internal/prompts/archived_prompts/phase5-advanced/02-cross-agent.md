# Phase 5.2; Cross-Agent Collaboration

## Task
Implement cross-agent collaboration. Carina, Hermes, and OpenClaw share knowledge, hand off tasks, and operate as a team rather than isolated agents.

## Specification

### Shared knowledge protocol
- Unified memory namespace across agents
- 5-minute sync cycle between agents
- Conflict resolution: latest write wins, with merge for non-conflicting fields
- Memory categories: shared (all agents), agent-specific (one agent)

### Knowledge sync format
```json
{
  "agent": "carina",
  "timestamp": "2026-06-05T14:30:00Z",
  "entries": [
    { "key": "project.tuinapp.status", "value": "deployed", "ttl": 3600 },
    { "key": "user.preference.audio", "value": true, "ttl": null }
  ]
}
```

### Task handoff
Agents delegate to each other based on strengths:
- Hermes: heavy automation, DevOps, server management, complex scripting
- Carina: property domain, security monitoring, user-facing interactions, briefings
- OpenClaw: workspace organization, journaling, proactive checking, file management

### Handoff protocol
```
Carina: "I need to deploy the updated email pipeline to production."
        -> handoff to Hermes: "Deploy propreneur-v2 email pipeline to VPS"

Hermes: [Runs deploy, verifies] "Deployed. All tests pass. Nginx reloaded."
        -> handoff result back to Carina

Carina: [Records in shared memory] "Email pipeline v1.2 deployed to production."
```

### Agent discovery
- Auto-detect other agents on the system
- Check for: .hermes/, .openclaw/, carina config directories
- Register capabilities: each agent declares what it can do
- Negotiate task assignment: "who is best suited for X?"

### Capability registry
```json
{
  "carina": {
    "strengths": ["property", "security", "briefings", "user-interaction"],
    "tools": ["browser", "cron", "delegate_task", "messaging"],
    "models": ["local", "cloud", "vision"]
  },
  "hermes": {
    "strengths": ["automation", "devops", "scripting", "server-management"],
    "tools": ["terminal", "browser", "cron", "delegate_task", "execute_code"],
    "models": ["cloud"]
  },
  "openclaw": {
    "strengths": ["workspace", "journaling", "proactive-checks", "file-management"],
    "tools": ["terminal", "file", "heartbeat"],
    "models": ["cloud"]
  }
}
```

### Implementation notes
- Shared memory: SQLite database in a shared location (~/.carina/shared/memory.db)
- Sync daemon: lightweight process that syncs every 5 minutes
- Handoff queue: file-based or Redis pub/sub for simplicity
- Agent discovery: scan known paths, register in shared DB

## Verification
```bash
# Test knowledge sync
echo "project.status=testing" > shared memory entry
# Wait 5 minutes
# Check: all agents see the update

# Test task handoff
carina: "Hermes, check disk usage on the VPS"
# Expected: Hermes receives task, executes, returns result

# Test agent discovery
carina agent list
# Expected: shows carina, hermes, openclaw with capabilities
```
