# Phase 2.2 — Process Tool

## Task
Implement the `process` tool. This tool manages background processes started by the terminal tool — polling status, viewing logs, sending stdin, killing processes.

## Specification

### Actions
1. list: Show all active background processes
   - Returns: array of { session_id, pid, command, status, uptime }

2. poll: Check status and get new output since last poll
   - Returns: { session_id, status, pid, uptime, output_preview }

3. log: Get full output with pagination
   - Parameters: session_id, offset (default last 200 lines), limit
   - Returns: output lines with pagination

4. wait: Block until process completes or timeout
   - Parameters: session_id, timeout (seconds)
   - Returns: full output on completion, partial output on timeout

5. kill: Terminate a running process
   - Parameters: session_id
   - Sends SIGTERM, escalates to SIGKILL if needed

6. write: Send raw stdin data without newline
   - Parameters: session_id, data

7. submit: Send data + Enter (for answering prompts)
   - Parameters: session_id, data

8. close: Close stdin / send EOF

### Parameters
All actions except 'list' require session_id.

### Implementation notes
- Process registry: Map of session_id → process state
- Output buffer: circular buffer, last 1000 lines
- Status enum: running, exited, killed, error
- Auto-cleanup: exited processes removed from registry after 5 minutes
- Persistence: registry survives tool call boundaries (in-memory for session)

### Verification
```bash
# Start background process
terminal: sleep 120 (background=true)

# List processes
process: list
# Expected: shows sleep process

# Poll
process: poll {session_id}
# Expected: shows running status

# Send stdin
process: write {session_id, data: "hello"}

# Wait for completion
process: wait {session_id, timeout: 60}

# Kill
process: kill {session_id}
```
