# Phase 4.1 — Workspace System (AGENTS.md, SOUL.md, USER.md, etc.)

## Task
Port OpenClaw's workspace file system. Carina auto-loads workspace context files on session start and maintains daily memory journals.

## Files to implement

### AGENTS.md — Workspace rules
Auto-loaded from current working directory on session start.
Contains: workspace description, rules, conventions, red lines, tool notes.

Format:
```markdown
# AGENTS.md - Workspace Name

## Session Startup
Use runtime-provided startup context first.

## Memory
Daily notes: memory/YYYY-MM-DD.md
Long-term: MEMORY.md

## Red Lines
- Don't exfiltrate private data
- Don't run destructive commands without asking
```

### SOUL.md — Agent personality
Loaded at session start. Defines tone, style, constraints.
Format: Free text. "You are a warm, professional assistant."

### IDENTITY.md — Agent identity
Loaded at session start. Defines who the agent IS in this workspace.
Format: Name, role, capabilities, limitations.

### USER.md — User profile
Loaded at session start. Defines who the user is.
Format: Name, preferences, communication style, background.

### TOOLS.md — Tool configuration
Tool-specific notes, API keys, configuration.
Format: Per-tool sections with config values.

### BOOTSTRAP.md — First-run setup
Read on first run in a new workspace. Agent follows instructions to self-configure.
Deleted after successful bootstrap.

Example:
```markdown
# BOOTSTRAP.md
1. Create memory/ directory if it doesn't exist
2. Read the project README.md
3. Create MEMORY.md with initial project context
4. Delete this file when done
```

### MEMORY.md — Curated long-term memory
Agent maintains this over time. Contains distilled learnings, not raw logs.
Updated during heartbeat maintenance cycles.

### Daily memory files (memory/YYYY-MM-DD.md)
Created automatically at end of session or during heartbeats.
Raw logs of what happened each day.
Agent reviews these to update MEMORY.md.

## Session startup flow
1. Check for AGENTS.md in cwd → load it
2. Check for SOUL.md → load it (personality)
3. Check for IDENTITY.md → load it (role)
4. Check for USER.md → load it (preferences)
5. Check for TOOLS.md → load it (config)
6. Check for BOOTSTRAP.md → run bootstrap, delete file
7. Check memory/ for today's daily file → load if exists
8. Check MEMORY.md → load it (main session only)

## Implementation notes
- Files are plain markdown in the workspace directory
- No database needed for workspace files
- Auto-load is additive (each file adds context)
- Main session vs shared context distinction (MEMORY.md only in private sessions)

## Verification
```bash
# Create a test workspace
mkdir /tmp/test-workspace
echo "# AGENTS.md" > /tmp/test-workspace/AGENTS.md
echo "You are a helpful assistant." > /tmp/test-workspace/SOUL.md

# Start Carina in this workspace
# Verify AGENTS.md and SOUL.md are loaded as context
# Verify agent follows SOUL.md personality
```
