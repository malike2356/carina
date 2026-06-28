import { pool } from '../memory/db.js';
import { getRedis } from '../memory/redis.js';
import { logSelfModEvent } from './self-mod-logger.js';

const RAPID_GEN_THRESHOLD = 3;
const RAPID_GEN_WINDOW_SECS = 10 * 60;
const MAX_PENDING_TOOLS = 10;
const MAX_FAILED_GENERATIONS = 5;

const REDIS_GEN_COUNTER_KEY = 'carina:self_mod:gen_count';
const REDIS_FAIL_COUNTER_KEY = 'carina:self_mod:fail_count';

/**
 * Increment the generation counter in Redis and check for rapid generation.
 * Called immediately after each successful auth in generate-and-run.ts.
 */
export async function trackAndCheckRapidGeneration(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  const count = await redis.incr(REDIS_GEN_COUNTER_KEY);
  if (count === 1) {
    await redis.expire(REDIS_GEN_COUNTER_KEY, RAPID_GEN_WINDOW_SECS);
  }

  if (count >= RAPID_GEN_THRESHOLD) {
    await logSelfModEvent('TOOL_RAPID_GENERATION', {
      generation_count: count,
      window_minutes: RAPID_GEN_WINDOW_SECS / 60,
      action_taken: 'All recently-generated tools auto-quarantined. Operator alerted.',
    });
    await quarantineAllRecentPendingTools();
    return true;
  }

  return false;
}

export async function trackFailedGeneration(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const count = await redis.incr(REDIS_FAIL_COUNTER_KEY);
  if (count === 1) {
    await redis.expire(REDIS_FAIL_COUNTER_KEY, 60 * 60); // 1 hour window
  }

  if (count >= MAX_FAILED_GENERATIONS) {
    await logSelfModEvent('TOOL_GEN_SANDBOX_FAIL', {
      failed_count: count,
      window_minutes: 60,
      action_taken: 'High failure rate detected. Operator alerted.',
      reason: `${count} failed generations in the last hour.`,
    });
  }
}

/**
 * High-risk code pattern detection, run during static scan phase.
 */
export function detectHighRiskPatterns(code: string): string[] {
  const patterns: Array<{ name: string; pattern: RegExp; reason: string }> = [
    { name: 'credential_extraction', pattern: /process\.env\.[A-Z_]{3,}/, reason: 'Attempts to read environment variables' },
    { name: 'file_exfiltration', pattern: /fetch\(.*btoa\(/, reason: 'Encodes data before sending - possible exfiltration' },
    { name: 'command_execution', pattern: /child_process|exec\s*\(|spawn\s*\(/, reason: 'Attempts to execute system commands' },
    { name: 'crypto_loop', pattern: /while\s*\(\s*true\s*\)|for\s*\(\s*;/, reason: 'Infinite loop - potential CPU exhaustion or mining' },
    { name: 'large_data_upload', pattern: /fetch\s*\([^)]*JSON\.stringify\s*\(\s*params/, reason: 'Uploads all input params - possible data leak' },
    { name: 'encoded_payload', pattern: /atob\s*\(|Buffer\.from\s*\([^,)]+,\s*['"]base64['"]/, reason: 'Decodes base64 payload - possible obfuscated code' },
    { name: 'eval_attempt', pattern: /eval\s*\(|new\s+Function\s*\(/, reason: 'Dynamic code execution attempt' },
  ];

  const detected: string[] = [];
  for (const { name, pattern, reason } of patterns) {
    if (pattern.test(code)) {
      detected.push(`${name}: ${reason}`);
    }
  }

  return detected;
}

async function quarantineAllRecentPendingTools(): Promise<void> {
  try {
    await pool.query(
      `UPDATE runtime_tools SET status = 'disabled', updated_at = NOW()
       WHERE status IN ('pending', 'active')
       AND created_at > NOW() - INTERVAL '1 hour'`,
    );
  } catch {
    // Non-fatal - Scout may not have DB access
  }
}

export async function checkPendingToolBloat(): Promise<void> {
  try {
    const result = await pool.query<{ c: string }>(
      `SELECT COUNT(*) AS c FROM runtime_tools WHERE status = 'pending'`,
    );
    const count = +(result.rows[0]?.c ?? 0);
    if (count > MAX_PENDING_TOOLS) {
      await logSelfModEvent('TOOL_PERSIST_SAVED', {
        pending_count: count,
        threshold: MAX_PENDING_TOOLS,
        reason: `${count} tools pending approval. Review and approve or reject.`,
        action_taken: 'Operator alerted via Telegram.',
      });
    }
  } catch {
    // Non-fatal
  }
}

export async function checkFailedGenerationRate(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const count = await redis.get(REDIS_FAIL_COUNTER_KEY).then((v) => +(v ?? 0));
  if (count >= MAX_FAILED_GENERATIONS) {
    await logSelfModEvent('TOOL_GEN_SANDBOX_FAIL', {
      failed_count: count,
      window_minutes: 60,
      reason: `${count} failed generations in the past hour.`,
    });
  }
}
