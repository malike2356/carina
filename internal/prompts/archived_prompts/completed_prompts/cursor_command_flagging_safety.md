# Build: Command Flagging Safety Layer

## Context

Carina already has an approval-policy system (`src/security/approval-policy.ts`) with a `needs_confirm` decision type, and tool risk tiers (`src/security/tool-risk.ts`) with `critical`, `high`, `medium`, `low`. The approval policy can be turned OFF via `CARINA_APPROVAL_POLICY=off` and has complex rule/grant mechanics.

The command flagging feature is separate and simpler. It is always-on by default, user-facing, and focused on a single thing: before Carina runs a shell command, it shows the user what the command will do in plain English and a risk label. It does not block WARN-level commands; it flags them and proceeds. It requires confirmation for DANGER-level commands. It logs every flagged command to the audit log.

This is the "Carina with a conscience" differentiator vs. Hermes/OpenClaw/Odysseus. Those tools silently execute. Carina tells you first.

---

## Deliverables

### 1. `src/security/command-flag.ts`

Export types and functions:

```typescript
export type FlagLevel = 'safe' | 'warn' | 'danger' | 'critical';

export interface CommandFlag {
  level: FlagLevel;
  command: string;
  whatItDoes: string; // plain English, one sentence
  riskDetail: string; // why it is risky, one sentence (empty string if safe)
}

export function classifyCommand(command: string): CommandFlag
export function commandFlaggingEnabled(): boolean  // CARINA_COMMAND_FLAG !== 'off'
```

**`classifyCommand` logic:**

The function analyses the raw shell command string and returns a `CommandFlag`. Pattern matching in priority order:

CRITICAL (flag + refuse without explicit override):
- `rm -rf /` or `rm -rf ~` or `rm -rf $HOME` - "Deletes the entire root filesystem or home directory permanently."
- `dd if=` combined with `of=/dev/sd` or `of=/dev/nvme` - "Overwrites a raw disk device. Permanent data loss."
- `: () { :|: & };:` or fork bomb variants - "Fork bomb. Will crash the machine."
- `mkfs.` on `/dev/` - "Formats a disk partition. All data on it will be lost."
- `chmod -R 777 /` - "Grants world-write permission to the entire filesystem."

DANGER (flag + require `y` confirmation before proceeding):
- `rm -rf` without the root/home targets above - "Recursively deletes the target directory and all its contents. Cannot be undone."
- `sudo` combined with any write operation - "Runs a write command with root privileges."
- `curl ... | bash` or `wget ... | sh` or `curl ... | sh` - "Downloads and immediately executes code from the network without review."
- `> /etc/` or `>> /etc/` - "Writes to a system configuration file."
- `kill -9 1` or `killall -9` - "Force-terminates processes. May leave the system in an inconsistent state."
- `crontab -r` - "Removes all scheduled cron jobs without backup."
- `drop database` (case-insensitive) - "Permanently deletes a database and all its tables."
- `truncate --size=0` - "Empties the target file completely."
- `git push --force` to a remote matching `main|master|prod` - "Force-pushes to a protected branch. Rewrites shared history."
- `git reset --hard` - "Discards all uncommitted changes. Cannot be undone."

WARN (flag + log, but proceed without asking):
- `rm` without `-rf` - "Removes the specified file(s). Standard delete, not recursive."
- `sudo` without a write operation - "Runs a command as root."
- `chmod` or `chown` on non-root paths - "Changes file permissions or ownership."
- `kill` or `pkill` without `-9` - "Sends a termination signal to a process."
- `systemctl stop` or `systemctl disable` - "Stops or disables a system service."
- `mv` to `/dev/null` - "Moves a file to /dev/null, effectively deleting it."
- `truncate` or `shred` - "Overwrites or empties a file."
- `export` of a variable containing `KEY`, `SECRET`, `TOKEN`, or `PASSWORD` to stdout - "Echoes a credential name to the terminal."

SAFE: anything that does not match any of the above.

The function should be pure: no I/O, no side effects, just pattern matching and string returns. Keep each pattern in a typed array so they are easy to extend.

---

### 2. `src/security/command-flag-presenter.ts`

Formats the flag for display in the CLI/TUI. Export:

```typescript
export function formatCommandFlag(flag: CommandFlag): string
export function formatFlaggedAuditEntry(flag: CommandFlag, decision: 'approved' | 'declined' | 'auto'): string
```

`formatCommandFlag` output format (plain ASCII, no emojis, no em-dashes):

```
  CARINA SAFETY FLAG
  ------------------
  Command : rm -rf ./old-logs
  Risk    : DANGER
  Action  : Recursively deletes the target directory and all its contents. Cannot be undone.
  Detail  : The -rf flags suppress errors and remove directories recursively.

  Run? [y/N]
```

For WARN level, the last line is: `  Flagging logged. Proceeding.`
For CRITICAL level, the last line is: `  BLOCKED. Set CARINA_COMMAND_FLAG_OVERRIDE=1 to force. This is not recommended.`

Colors (use chalk): CRITICAL = red bold, DANGER = yellow bold, WARN = yellow, header line = dim.

`formatFlaggedAuditEntry` returns a single log line:
```
[2026-06-19T14:23:01Z] FLAGGED command=<command> level=DANGER decision=approved session=<sessionId>
```

---

### 3. Integration into tool execution

Hook into the shell-exec tool execution path. The right place is `src/tools/session-tool-resolution.ts` or wherever `shell-exec` parameters are resolved before the tool runs.

Find where `shell-exec` tool calls land just before execution. At that point:

```typescript
import { classifyCommand, commandFlaggingEnabled } from '../security/command-flag.js';
import { formatCommandFlag, formatFlaggedAuditEntry } from '../security/command-flag-presenter.js';

if (commandFlaggingEnabled() && toolName === 'shell-exec' && typeof params.command === 'string') {
  const flag = classifyCommand(params.command);
  if (flag.level !== 'safe') {
    // emit the formatted flag to the active output stream
    // for CRITICAL: throw FlaggedCriticalError (blocked)
    // for DANGER: pause execution, prompt y/N, proceed or abort based on response
    // for WARN: emit flag, log, continue automatically
    // in all non-safe cases: append to audit log via appendApprovalAudit or a new appendFlagAudit
  }
}
```

The pause-and-prompt for DANGER must work in both interactive CLI mode (readline) and non-interactive mode (where no TTY is available). In non-interactive mode, DANGER level commands should decline and log `decision=auto-declined`.

---

### 4. `src/security/command-flag.test.ts`

Unit tests for `classifyCommand`. Cover at minimum:
- `rm -rf /` returns CRITICAL
- `rm -rf ./tmp` returns DANGER
- `curl https://example.com/install.sh | bash` returns DANGER
- `rm ./file.txt` returns WARN
- `ls -la` returns SAFE
- `sudo apt update` returns WARN (sudo without write)
- `sudo rm -rf ./node_modules` returns DANGER (sudo + recursive delete)
- `git push --force origin main` returns DANGER

---

### 5. Configuration

Add to `.env.example` and `.env.production.example`:

```
# Command flagging: Carina flags risky shell commands before executing.
# Default: on. Set to 'off' to disable (not recommended for production).
CARINA_COMMAND_FLAG=on
```

Add `CARINA_COMMAND_FLAG_OVERRIDE=1` support for CRITICAL-level bypass (logs the override).

---

### 6. Audit log

Flagged commands are written to `.carina/audit.log` (or append to the existing `data/logs/shell.log` if that is the active log path). Every flagged command regardless of level gets one line. Format from `formatFlaggedAuditEntry`.

---

## What this is NOT

- Not a replacement for `approval-policy.ts`. That system handles tool-level governance. This handles command-level visibility. Both can run simultaneously.
- Not a firewall. CRITICAL level blocks the worst patterns. DANGER asks. WARN informs. SAFE is silent.
- Not async-heavy. The classifier is synchronous pattern matching. The prompt for DANGER uses readline, which is already available in the CLI path.

---

## Definition of done

1. `pnpm test` passes with new tests in `command-flag.test.ts`.
2. Running `carina run "delete the old-logs folder"` in a workspace with an old-logs folder shows the DANGER flag and waits for confirmation before proceeding.
3. Running a safe command like `ls -la` shows nothing extra.
4. `CARINA_COMMAND_FLAG=off` suppresses all flagging.
5. Every flagged command appears in the audit log with the correct decision field.
6. `pnpm build` is clean with no TypeScript errors.
