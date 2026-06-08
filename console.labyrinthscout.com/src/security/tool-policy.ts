import type { Redis } from 'ioredis';
import { TokenBucket, type TokenBucketSnapshot } from './token-bucket.js';
import {
  canonicalToolName,
  resolveAllowlistForTier,
  type ToolTier,
} from './tool-tiers.js';

export interface ToolPolicy {
  tier: ToolTier;
  allowlist: string[];
  requireConfirmList: string[];
  blocklist: string[];
  dangerousCommands: RegExp[];
  rateLimit: {
    callsPerMinute: number;
    callsPerHour: number;
  };
}

export interface EnforceParams {
  command?: string;
  ip?: string;
  _confirmed?: boolean;
  [key: string]: unknown;
}

export interface SecurityEvent {
  instance_id: string;
  event_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  metadata: Record<string, unknown>;
}

export class ToolBlockedError extends Error {
  readonly code = 'TOOL_BLOCKED';
  constructor(toolName: string, message?: string) {
    super(message ?? `Tool '${toolName}' is blocked by Labyrinth Scout policy.`);
    this.name = 'ToolBlockedError';
  }
}

export class DangerousCommandError extends Error {
  readonly code = 'DANGEROUS_COMMAND';
  constructor(command: string, pattern: string) {
    super(
      `Command refused by Labyrinth Scout: matched dangerous pattern '${pattern}'. Command: ${command.slice(0, 100)}`,
    );
    this.name = 'DangerousCommandError';
  }
}

export class RateLimitError extends Error {
  readonly code = 'RATE_LIMIT';
  readonly retryAfter: number;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: Date;

  constructor(window: 'minute' | 'hour', limit: number, retryAfter = window === 'minute' ? 60 : 3600) {
    super(`Tool call rate limit exceeded: ${limit} calls per ${window} (Labyrinth Scout).`);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.limit = limit;
    this.remaining = 0;
    this.resetAt = new Date(Date.now() + retryAfter * 1000);
  }

  toJSON(): Record<string, unknown> {
    return {
      error: 'rate_limited',
      message: this.message,
      retry_after: this.retryAfter,
      limit: this.limit,
      remaining: this.remaining,
      reset_at: this.resetAt.toISOString(),
    };
  }
}

export class ConfirmationRequiredError extends Error {
  readonly code = 'CONFIRMATION_REQUIRED';
  constructor(toolName: string) {
    super(
      `Tool '${toolName}' requires user confirmation before executing. ` +
        'Re-submit the tool call with params._confirmed = true to proceed.',
    );
    this.name = 'ConfirmationRequiredError';
  }
}

const DEFAULT_DANGEROUS_COMMANDS = Object.freeze([
  /rm\s+(-rf?|--recursive)?\s*\//i,
  /dd\s+if=/,
  /:\(\)\s*\{\s*:|:&\s*\};:/,
  /chmod\s+777\s+\//,
  /curl.*\|\s*(bash|sh)/i,
  /wget.*\|\s*(bash|sh)/i,
  /base64\s+-d.*\|\s*(bash|sh)/i,
  /mkfs/i,
  />\s*\/dev\/(sda|hda|nvme)/i,
]);

export const DEFAULT_POLICY: ToolPolicy = Object.freeze({
  tier: 'ENTERPRISE',
  allowlist: ['web-search', 'file-read', 'http-request', 'email-list'],
  requireConfirmList: ['file-write', 'email-send'],
  blocklist: [] as string[],
  dangerousCommands: DEFAULT_DANGEROUS_COMMANDS as RegExp[],
  rateLimit: Object.freeze({
    callsPerMinute: 15,
    callsPerHour: 200,
  }),
});

export function loadPolicyFromEnv(base: ToolPolicy = DEFAULT_POLICY): ToolPolicy {
  const blocklist = process.env.SCOUT_BLOCKLIST
    ? process.env.SCOUT_BLOCKLIST.split(',').map((s) => s.trim()).filter(Boolean)
    : [...base.blocklist];

  const callsPerMinute = process.env.SCOUT_RATE_LIMIT_MINUTE
    ? parseInt(process.env.SCOUT_RATE_LIMIT_MINUTE, 10)
    : base.rateLimit.callsPerMinute;

  const callsPerHour = process.env.SCOUT_RATE_LIMIT_HOUR
    ? parseInt(process.env.SCOUT_RATE_LIMIT_HOUR, 10)
    : base.rateLimit.callsPerHour;

  return {
    ...base,
    tier: (process.env.SCOUT_TOOL_TIER as ToolTier | undefined) ?? base.tier,
    allowlist: [...base.allowlist],
    requireConfirmList: [...base.requireConfirmList],
    blocklist,
    dangerousCommands: [...base.dangerousCommands],
    rateLimit: { callsPerMinute, callsPerHour },
  };
}

const LOADED_POLICY = loadPolicyFromEnv();

export function getLoadedPolicy(): ToolPolicy {
  return LOADED_POLICY;
}

function validateSessionId(sessionId: string): void {
  if (!/^[a-zA-Z0-9-_]{1,128}$/.test(sessionId)) {
    throw new Error('Invalid sessionId for rate limit key');
  }
}

export class ToolPolicyEnforcer {
  private readonly policy: ToolPolicy;

  constructor(
    private readonly redis: Redis,
    private readonly reportFn: (event: SecurityEvent) => Promise<void>,
    policy?: ToolPolicy,
    private readonly instanceId: string = process.env.LABYRINTH_INSTANCE_ID ?? 'unknown',
  ) {
    this.policy = policy ?? LOADED_POLICY;
  }

  async enforce(toolName: string, params: EnforceParams, sessionId: string): Promise<true> {
    const canonical = canonicalToolName(toolName);
    const tierAllowlist = resolveAllowlistForTier(
      this.policy.tier,
      this.policy.allowlist.map(canonicalToolName),
      this.policy.blocklist.map(canonicalToolName),
    );

    if (this.policy.blocklist.includes(toolName)) {
      await this.report(toolName, 'tool_blocked', 'critical', { tool: toolName, session: sessionId });
      throw new ToolBlockedError(toolName);
    }

    if (tierAllowlist.denied.includes(canonical)) {
      await this.report(toolName, 'tool_blocked', 'critical', { tool: toolName, session: sessionId });
      throw new ToolBlockedError(toolName);
    }

    if (!tierAllowlist.wildcards.includes('*') && !tierAllowlist.allowed.includes(canonical)) {
      const upgrade = this.policy.tier === 'FREE' ? ' Upgrade to PRO.' : '';
      throw new ToolBlockedError(
        toolName,
        `Tool '${canonical}' is not available on your plan.${upgrade}`,
      );
    }

    if (toolName === 'shell-exec' && typeof params.command === 'string') {
      const matched = this.policy.dangerousCommands.find((re) => re.test(params.command as string));
      if (matched) {
        await this.report(toolName, 'dangerous_command_blocked', 'critical', {
          command_preview: (params.command as string).slice(0, 100),
          pattern: matched.toString(),
          session: sessionId,
        });
        throw new DangerousCommandError(params.command as string, matched.toString());
      }
    }

    await this.enforceRateLimit(toolName, params, sessionId);

    if (this.policy.requireConfirmList.includes(toolName) && params._confirmed !== true) {
      throw new ConfirmationRequiredError(toolName);
    }

    return true;
  }

  private async enforceRateLimit(
    toolName: string,
    params: EnforceParams,
    sessionId: string,
  ): Promise<void> {
    validateSessionId(sessionId);

    const ip = typeof params.ip === 'string' ? params.ip : 'unknown';
    const baseKey = `scout:bucket:${this.instanceId}:${sessionId}:${canonicalToolName(toolName)}:${ip}`;
    const minuteResult = await this.consumeBucket(
      `${baseKey}:minute`,
      this.policy.rateLimit.callsPerMinute,
      this.policy.rateLimit.callsPerMinute / 60,
    );
    if (!minuteResult.allowed) {
      await this.reportRateLimit(toolName, sessionId, 'minute', this.policy.rateLimit.callsPerMinute);
      throw new RateLimitError('minute', this.policy.rateLimit.callsPerMinute, minuteResult.retryAfter);
    }

    const hourResult = await this.consumeBucket(
      `${baseKey}:hour`,
      this.policy.rateLimit.callsPerHour,
      this.policy.rateLimit.callsPerHour / 3600,
    );
    if (!hourResult.allowed) {
      await this.reportRateLimit(toolName, sessionId, 'hour', this.policy.rateLimit.callsPerHour);
      throw new RateLimitError('hour', this.policy.rateLimit.callsPerHour, hourResult.retryAfter);
    }
  }

  private async consumeBucket(
    key: string,
    capacity: number,
    refillRate: number,
  ): Promise<{ allowed: boolean; retryAfter: number }> {
    const raw = await this.redis.get(key);
    const snapshot = raw ? JSON.parse(raw) as TokenBucketSnapshot : null;
    const bucket = snapshot
      ? TokenBucket.fromSnapshot(snapshot)
      : new TokenBucket(capacity, refillRate);
    const allowed = bucket.consume();
    await this.redis.set(key, JSON.stringify(bucket.toSnapshot()), 'EX', 3600);
    return { allowed, retryAfter: bucket.retryAfterSeconds() };
  }

  private async reportRateLimit(
    toolName: string,
    sessionId: string,
    window: 'minute' | 'hour',
    limit: number,
  ): Promise<void> {
    const violationKey = `scout:rate-violations:${this.instanceId}:${sessionId}`;
    const count = await this.redis.incr(violationKey);
    if (count === 1) await this.redis.expire(violationKey, 3600);

    let cooldownSeconds = 0;
    let severity: SecurityEvent['severity'] = 'warning';
    if (count >= 20) {
      cooldownSeconds = 1800;
      severity = 'critical';
    } else if (count >= 10) {
      cooldownSeconds = 300;
    } else if (count >= 5) {
      cooldownSeconds = 60;
    }

    if (cooldownSeconds > 0) {
      await this.redis.set(
        `scout:rate-cooldown:${this.instanceId}:${sessionId}`,
        String(cooldownSeconds),
        'EX',
        cooldownSeconds,
      );
    }

    await this.report('rate-limit', 'rate_limit_exceeded', severity, {
      window,
      limit,
      session: sessionId,
      tool: toolName,
      violation_count: count,
      cooldown_seconds: cooldownSeconds,
    });
  }

  private async report(
    toolName: string,
    eventType: string,
    severity: SecurityEvent['severity'],
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.reportFn({
        instance_id: this.instanceId,
        event_type: eventType,
        severity,
        metadata: { tool: toolName, ...metadata },
      });
    } catch {
      /* reporting failure must not block enforcement */
    }
  }
}
