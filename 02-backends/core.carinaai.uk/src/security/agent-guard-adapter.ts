import { spawn } from 'child_process';

export interface AgentGuardResult {
  flagged: boolean;
  score: number;
  skipped: boolean;
  reason?: string;
}

const DEFAULT_THRESHOLD = 0.4;

const PYTHON_PROBE = `
import json, sys
try:
    from agent_guard_plugins import guard
except ImportError:
    print(json.dumps({"available": False}))
    sys.exit(0)
text = sys.stdin.read()
result = guard(text)
print(json.dumps({
    "available": True,
    "flagged": bool(getattr(result, "flagged", False)),
    "score": float(getattr(result, "score", 0.0)),
}))
`;

export function isAgentGuardEnabled(): boolean {
  return process.env.AGENT_GUARD_ENABLED === 'true';
}

export function agentGuardThreshold(): number {
  const raw = parseFloat(process.env.AGENT_GUARD_THRESHOLD ?? String(DEFAULT_THRESHOLD));
  return Number.isFinite(raw) ? raw : DEFAULT_THRESHOLD;
}

export async function scanWithAgentGuard(text: string): Promise<AgentGuardResult> {
  if (!isAgentGuardEnabled()) {
    return { flagged: false, score: 0, skipped: true, reason: 'disabled' };
  }

  const python = process.env.AGENT_GUARD_PYTHON ?? 'python3';
  const timeoutMs = parseInt(process.env.AGENT_GUARD_TIMEOUT_MS ?? '3000', 10);

  return new Promise((resolve) => {
    const child = spawn(python, ['-c', PYTHON_PROBE], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ flagged: false, score: 0, skipped: true, reason: 'timeout' });
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ flagged: false, score: 0, skipped: true, reason: 'spawn_failed' });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ flagged: false, score: 0, skipped: true, reason: stderr.trim() || `exit_${code}` });
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim()) as {
          available?: boolean;
          flagged?: boolean;
          score?: number;
        };
        if (!parsed.available) {
          resolve({ flagged: false, score: 0, skipped: true, reason: 'package_not_installed' });
          return;
        }
        const score = parsed.score ?? 0;
        const threshold = agentGuardThreshold();
        const flagged = parsed.flagged === true || score >= threshold;
        resolve({ flagged, score, skipped: false });
      } catch {
        resolve({ flagged: false, score: 0, skipped: true, reason: 'invalid_output' });
      }
    });

    child.stdin.write(text);
    child.stdin.end();
  });
}
