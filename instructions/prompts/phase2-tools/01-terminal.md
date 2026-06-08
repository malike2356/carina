# Phase 2.1 — Terminal Tool

## Task
Implement the `terminal` tool. This tool gives Carina the ability to execute shell commands on the host system with foreground, background, and interactive PTY modes.

## Specification

### Modes
1. Foreground (default): Command runs, blocks until complete, returns output
   - Timeout configurable (default 180s, max 600s)
   - Returns output + exit code when command finishes
   - Use for: short commands, installs, git, builds under 10 minutes

2. Background: Command runs asynchronously, returns session_id
   - Always pair with notify_on_complete=true for bounded tasks
   - For servers/watchers: background=true without notify (never exits)
   - For long-running bounded tasks (tests, builds, deploys): MUST set notify_on_complete=true
   - Watch patterns: optional strings to watch for in output (rate limit: 1 notification per 15s)

3. PTY (pseudo-terminal): Interactive CLI tools
   - Use for: Claude Code, Codex, Python REPL, any ncurses app
   - Provides proper terminal emulation for interactive programs
   - Do NOT use vim/nano without pty=true

### Parameters
- command (string, required): The shell command to execute
- background (bool, default false): Run in background
- timeout (int, default 180, max 600): Max seconds to wait
- workdir (string, optional): Working directory override
- pty (bool, default false): Pseudo-terminal mode
- notify_on_complete (bool, default false): Get notified when background process finishes
- watch_patterns (array of strings, optional): Strings to watch for in output

### Returns
Foreground: { output: string, exit_code: int }
Background: { session_id: string, pid: int }

### Implementation notes
- Use Node.js child_process for execution
- PTY mode uses node-pty package
- Background processes tracked in a process registry
- Working directory defaults to session working directory
- Signal handling: SIGTERM for graceful shutdown, SIGKILL for force kill
- Output capped at 50KB to prevent context flooding

### Security considerations
- No sudo by default
- Whitelist allowed commands per workspace
- Log all commands to Scout audit trail
- Block: rm -rf /, fork bombs, curl to internal IPs
- Timeout prevents runaway processes

### Verification
```bash
# Foreground test
terminal: echo "hello world"
# Expected: { output: "hello world\n", exit_code: 0 }

# Background test
terminal: sleep 30 (background=true, notify_on_complete=true)
# Expected: returns session_id immediately, notification when done

# PTY test
terminal: python3 (pty=true)
# Expected: interactive Python REPL
```
