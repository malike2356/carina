# Phase 2.6; delegate_task Tool (Subagents)

## Task
Implement the `delegate_task` tool. This allows Carina to spawn parallel subagents that work on tasks in isolated contexts. The parent agent only receives the final summary; intermediate results never enter the parent's context window.

## Specification

### Two modes

1. Single task mode: Provide 'goal' (+ optional context, toolsets)
   - One subagent works on one task
   - Returns summary when complete

2. Batch/parallel mode: Provide 'tasks' array (up to 3 concurrent)
   - Multiple subagents work in parallel
   - All results returned together
   - Configurable max concurrency

### Parameters
- goal (string): What the subagent should accomplish (single task mode)
- context (string): Background info; file paths, error messages, constraints
- toolsets (array of strings): Tools to enable for this subagent
  - Available: terminal, file, web, browser, search, skills, session_search, vision
  - Default: inherits parent's enabled toolsets
- tasks (array): Batch mode; array of { goal, context, toolsets }

### Subagent constraints (leaf role, default)
- CAN use: terminal, file, read, write, search, web, browser
- CANNOT use: delegate_task, clarify, memory, send_message, execute_code
- CANNOT interact with user (no clarify tool)
- Fresh context: no memory of parent conversation
- Fresh terminal: separate working directory and shell state
- Synchronous: runs inside parent turn; if parent is interrupted, child is cancelled

### When to use
- Reasoning-heavy subtasks (debugging, code review, research synthesis)
- Tasks that would flood parent context with intermediate data
- Parallel independent workstreams (research A and B simultaneously)

### When NOT to use
- Mechanical multi-step work (use execute_code instead)
- Single tool call (just call the tool directly)
- Tasks needing user interaction (subagents cannot use clarify)
- Durable long-running work (use cronjob instead)

### Implementation notes
- Subagents are spawned as separate Carina agent instances
- Each gets a fresh context window
- Results are self-reports; parent should verify critical outputs
- For operations with external side-effects (HTTP POST, file writes): subagent returns verifiable handle (URL, ID, path), parent verifies
- Max spawn depth configurable (default 1; leaf only)

### Verification
```bash
# Single task
delegate_task: {
  goal: "Find all TODO comments in the src/ directory",
  context: "Project at /opt/lampp/htdocs/propreneur-v2",
  toolsets: ["terminal", "file"]
}

# Parallel batch
delegate_task: {
  tasks: [
    { goal: "Check disk usage on /var", toolsets: ["terminal"] },
    { goal: "Check disk usage on /home", toolsets: ["terminal"] }
  ]
}
```
