interface ScanResult {
  safe: boolean;
  blocked: string[];
}

const BANNED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brequire\s*\(/, reason: 'require() - no module loading' },
  { pattern: /\bimport\s+/, reason: 'import statement - no ES module loading' },
  { pattern: /\bimport\s*\(/, reason: 'import() - no dynamic imports' },
  { pattern: /\bfs\./, reason: 'fs module - no filesystem access' },
  { pattern: /\bpath\./, reason: 'path module - no filesystem access' },
  { pattern: /\b__dirname\b/, reason: '__dirname - no filesystem context' },
  { pattern: /\b__filename\b/, reason: '__filename - no filesystem context' },
  { pattern: /\bprocess\.env\b/, reason: 'process.env - no environment access' },
  { pattern: /\bprocess\.exit\b/, reason: 'process.exit() - cannot kill host' },
  { pattern: /\bprocess\b/, reason: 'process - no host process access' },
  { pattern: /\beval\s*\(/, reason: 'eval() - no dynamic code execution' },
  { pattern: /\bnew\s+Function\s*\(/, reason: 'new Function() - no dynamic code execution' },
  { pattern: /\bsetTimeout\s*\(/, reason: 'setTimeout - controlled via sandbox timeout' },
  { pattern: /\bsetInterval\s*\(/, reason: 'setInterval - controlled via sandbox timeout' },
  { pattern: /\bchild_process\b/, reason: 'child_process - no subprocess spawning' },
  { pattern: /\bexecSync\b/, reason: 'execSync - no command execution' },
  { pattern: /\bspawn\s*\(/, reason: 'spawn() - no process spawning' },
  { pattern: /\bnet\./, reason: 'net module - use fetch() for HTTP' },
  { pattern: /\bhttp\s*\.(?!s)/, reason: 'http module - use fetch() for HTTP' },
  { pattern: /\bdgram\./, reason: 'dgram - no raw sockets' },
  { pattern: /\btls\./, reason: 'tls - no raw TLS' },
  { pattern: /\bWorker\b/, reason: 'Worker - no thread spawning' },
  { pattern: /\bworker_threads\b/, reason: 'worker_threads - no thread spawning' },
  { pattern: /\bglobalThis\b/, reason: 'globalThis - no host global access' },
  { pattern: /\b__SANDBOX_RESULT__/, reason: '__SANDBOX_RESULT__ - reserved marker' },
  { pattern: /while\s*\(\s*true\s*\)/, reason: 'while(true) - potential infinite loop' },
  { pattern: /for\s*\(\s*;\s*;\s*\)/, reason: 'for(;) - potential infinite loop' },
];

export function scanGeneratedCode(code: string): ScanResult {
  const blocked: string[] = [];
  for (const { pattern, reason } of BANNED_PATTERNS) {
    if (pattern.test(code)) {
      blocked.push(reason);
    }
  }
  return { safe: blocked.length === 0, blocked };
}
