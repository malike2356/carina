export type FlagLevel = 'safe' | 'warn' | 'danger' | 'critical';

export interface CommandFlag {
  level: FlagLevel;
  command: string;
  whatItDoes: string;
  riskDetail: string;
}

type FlagPattern = {
  test: (command: string) => boolean;
  whatItDoes: string;
  riskDetail: string;
};

const CRITICAL_PATTERNS: FlagPattern[] = [
  {
    test: (cmd) => /rm\s+(?:-[a-zA-Z]*[rf][a-zA-Z]*[rf][a-zA-Z]*|--recursive)\s+(\/|~|\$HOME\b)/i.test(cmd),
    whatItDoes: 'Deletes the entire root filesystem or home directory permanently.',
    riskDetail: 'Targets root (/) or home directory with recursive force delete.',
  },
  {
    test: (cmd) => /dd\s+.*\bif=/.test(cmd) && /of=\/dev\/(?:sd|nvme)/i.test(cmd),
    whatItDoes: 'Overwrites a raw disk device. Permanent data loss.',
    riskDetail: 'dd writes directly to a block device.',
  },
  {
    test: (cmd) => /:\(\)\s*\{[^}]*:|:&[^}]*\};:/.test(cmd),
    whatItDoes: 'Fork bomb. Will crash the machine.',
    riskDetail: 'Recursive process fork exhausts system resources.',
  },
  {
    test: (cmd) => /\bmkfs\.\w+\s+.*\/dev\//i.test(cmd),
    whatItDoes: 'Formats a disk partition. All data on it will be lost.',
    riskDetail: 'mkfs rewrites the filesystem on a device.',
  },
  {
    test: (cmd) => /chmod\s+(?:-R\s+)?777\s+\//i.test(cmd),
    whatItDoes: 'Grants world-write permission to the entire filesystem.',
    riskDetail: 'chmod 777 on / removes filesystem permission boundaries.',
  },
];

const DANGER_PATTERNS: FlagPattern[] = [
  {
    test: (cmd) => /rm\s+(?:-[a-zA-Z]*[rf][a-zA-Z]*[rf][a-zA-Z]*|--recursive)/i.test(cmd),
    whatItDoes: 'Recursively deletes the target directory and all its contents. Cannot be undone.',
    riskDetail: 'The -rf flags suppress errors and remove directories recursively.',
  },
  {
    test: (cmd) => /(?:curl|wget)\b[^\n|]*\|\s*(?:bash|sh)\b/i.test(cmd),
    whatItDoes: 'Downloads and immediately executes code from the network without review.',
    riskDetail: 'Piped shell execution runs remote code without inspection.',
  },
  {
    test: (cmd) => />>?\s*\/etc\//i.test(cmd),
    whatItDoes: 'Writes to a system configuration file.',
    riskDetail: 'Changes under /etc/ can break system services.',
  },
  {
    test: (cmd) => /\bkill\s+-9\s+1\b/i.test(cmd) || /\bkillall\s+-9\b/i.test(cmd),
    whatItDoes: 'Force-terminates processes. May leave the system in an inconsistent state.',
    riskDetail: 'SIGKILL cannot be caught or cleaned up gracefully.',
  },
  {
    test: (cmd) => /\bcrontab\s+-r\b/i.test(cmd),
    whatItDoes: 'Removes all scheduled cron jobs without backup.',
    riskDetail: 'All user crontab entries are deleted immediately.',
  },
  {
    test: (cmd) => /\bdrop\s+database\b/i.test(cmd),
    whatItDoes: 'Permanently deletes a database and all its tables.',
    riskDetail: 'DROP DATABASE cannot be rolled back without a backup.',
  },
  {
    test: (cmd) => /\btruncate\s+--size=0\b/i.test(cmd),
    whatItDoes: 'Empties the target file completely.',
    riskDetail: 'truncate --size=0 removes all file contents.',
  },
  {
    test: (cmd) => /\bgit\s+push\b.*(?:--force|-f)\b.*\b(?:origin\s+)?(main|master|prod)\b/i.test(cmd)
      || /\bgit\s+push\b.*\b(?:origin\s+)?(main|master|prod)\b.*(?:--force|-f)\b/i.test(cmd),
    whatItDoes: 'Force-pushes to a protected branch. Rewrites shared history.',
    riskDetail: 'Force push overwrites remote branch history for collaborators.',
  },
  {
    test: (cmd) => /\bgit\s+reset\s+--hard\b/i.test(cmd),
    whatItDoes: 'Discards all uncommitted changes. Cannot be undone.',
    riskDetail: 'git reset --hard drops working tree and index changes.',
  },
];

const WARN_PATTERNS: FlagPattern[] = [
  {
    test: (cmd) => /\brm\b/i.test(cmd) && !/rm\s+(?:-[a-zA-Z]*[rf][a-zA-Z]*[rf][a-zA-Z]*|--recursive)/i.test(cmd),
    whatItDoes: 'Removes the specified file(s). Standard delete, not recursive.',
    riskDetail: 'Deleted files may not be recoverable without backups.',
  },
  {
    test: (cmd) => /^(?:sudo\s+)+/i.test(cmd) && !isWriteOperation(stripSudo(cmd)),
    whatItDoes: 'Runs a command as root.',
    riskDetail: 'Elevated privileges increase blast radius if the command misbehaves.',
  },
  {
    test: (cmd) => /\b(chmod|chown)\b/i.test(cmd) && !/chmod\s+(?:-R\s+)?777\s+\//i.test(cmd),
    whatItDoes: 'Changes file permissions or ownership.',
    riskDetail: 'Permission changes can expose or lock out files unexpectedly.',
  },
  {
    test: (cmd) => /\b(kill|pkill)\b/i.test(cmd) && !/\bkill\s+-9\b/i.test(cmd) && !/\bkillall\s+-9\b/i.test(cmd),
    whatItDoes: 'Sends a termination signal to a process.',
    riskDetail: 'Stopping processes can interrupt active work.',
  },
  {
    test: (cmd) => /\bsystemctl\s+(stop|disable)\b/i.test(cmd),
    whatItDoes: 'Stops or disables a system service.',
    riskDetail: 'Disabled services stay off across reboots until re-enabled.',
  },
  {
    test: (cmd) => /\bmv\b[^\n]*\/dev\/null\b/i.test(cmd),
    whatItDoes: 'Moves a file to /dev/null, effectively deleting it.',
    riskDetail: 'Files moved to /dev/null are not recoverable.',
  },
  {
    test: (cmd) => /\b(truncate|shred)\b/i.test(cmd) && !/\btruncate\s+--size=0\b/i.test(cmd),
    whatItDoes: 'Overwrites or empties a file.',
    riskDetail: 'File contents may be destroyed without backup.',
  },
  {
    test: (cmd) => /\bexport\s+\w*(?:KEY|SECRET|TOKEN|PASSWORD)\w*\s*=/i.test(cmd),
    whatItDoes: 'Echoes a credential name to the terminal.',
    riskDetail: 'Credential-related exports can leak secrets into shell history.',
  },
];

function stripSudo(command: string): string {
  return command.replace(/^(?:sudo\s+)+/i, '').trim();
}

function isWriteOperation(command: string): boolean {
  const cmd = command.trim();
  if (!cmd) return false;
  if (/>>?\s*\S/.test(cmd)) return true;
  if (/\b(rm|mv|chmod|chown|truncate|shred|tee|mkfs|dd)\b/i.test(cmd)) return true;
  if (/\bgit\s+(reset|push)\b/i.test(cmd)) return true;
  if (/\bdrop\s+database\b/i.test(cmd)) return true;
  if (/\bcrontab\s+-r\b/i.test(cmd)) return true;
  if (/\b(kill\s+-9\s+1|killall\s+-9)\b/i.test(cmd)) return true;
  if (/\bsystemctl\s+(stop|disable)\b/i.test(cmd)) return true;
  if (/>\s*\/etc\//i.test(cmd)) return true;
  if (/\b(apt|yum|dnf|brew)\s+(install|remove|purge|uninstall)\b/i.test(cmd)) return true;
  if (/\b(npm|pnpm|yarn)\s+(install|uninstall|remove|add)\b/i.test(cmd)) return true;
  if (/\bpip\s+install\b/i.test(cmd)) return true;
  return false;
}

function matchPattern(patterns: FlagPattern[], command: string): CommandFlag | null {
  for (const pattern of patterns) {
    if (pattern.test(command)) {
      return {
        level: 'safe',
        command,
        whatItDoes: pattern.whatItDoes,
        riskDetail: pattern.riskDetail,
      };
    }
  }
  return null;
}

function sudoWriteDanger(command: string): CommandFlag | null {
  if (!/^(?:sudo\s+)+/i.test(command)) return null;
  const inner = stripSudo(command);
  if (!isWriteOperation(inner)) return null;
  return {
    level: 'danger',
    command,
    whatItDoes: 'Runs a write command with root privileges.',
    riskDetail: 'sudo combined with a write operation can damage the system irreversibly.',
  };
}

export function commandFlaggingEnabled(): boolean {
  const raw = (process.env.CARINA_COMMAND_FLAG ?? 'on').trim().toLowerCase();
  return raw !== 'off' && raw !== 'false' && raw !== '0';
}

export function criticalOverrideEnabled(): boolean {
  return process.env.CARINA_COMMAND_FLAG_OVERRIDE === '1';
}

export function classifyCommand(command: string): CommandFlag {
  const trimmed = command.trim();
  if (!trimmed) {
    return { level: 'safe', command: trimmed, whatItDoes: '', riskDetail: '' };
  }

  const critical = matchPattern(CRITICAL_PATTERNS, trimmed);
  if (critical) {
    return { ...critical, level: 'critical' };
  }

  const sudoDanger = sudoWriteDanger(trimmed);
  if (sudoDanger) return sudoDanger;

  const danger = matchPattern(DANGER_PATTERNS, trimmed);
  if (danger) {
    return { ...danger, level: 'danger' };
  }

  const warn = matchPattern(WARN_PATTERNS, trimmed);
  if (warn) {
    return { ...warn, level: 'warn' };
  }

  return { level: 'safe', command: trimmed, whatItDoes: '', riskDetail: '' };
}
