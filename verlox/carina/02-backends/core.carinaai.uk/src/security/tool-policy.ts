import type { Redis } from 'ioredis';
import { getSessionRateLimit, isAllowlistEnforced } from './kill-switch-listener.js';

export interface ToolPolicy {
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
  constructor(toolName: string) {
    super(`Tool '${toolName}' is blocked by Labyrinth Scout policy.`);
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
  constructor(window: 'minute' | 'hour', limit: number) {
    super(`Tool call rate limit exceeded: ${limit} calls per ${window} (Labyrinth Scout).`);
    this.name = 'RateLimitError';
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
  // Profile-scoped sessions use `profile:<name>:<id>`; operator sessions use `op:<name>`.
  if (!/^[a-zA-Z0-9._:-]{1,192}$/.test(sessionId)) {
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
    if (isAllowlistEnforced() && !this.policy.allowlist.includes(toolName)) {
      await this.report(toolName, 'tool_blocked', 'critical', {
        tool: toolName,
        session: sessionId,
        reason: 'allowlist_enforced',
      });
      throw new ToolBlockedError(toolName);
    }

    if (this.policy.blocklist.includes(toolName)) {
      await this.report(toolName, 'tool_blocked', 'critical', {
        tool: toolName,
        session: sessionId,
        reason: 'blocklist',
      });
      throw new ToolBlockedError(toolName);
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

    await this.enforceRateLimit(sessionId);

    if (this.policy.requireConfirmList.includes(toolName) && params._confirmed !== true) {
      throw new ConfirmationRequiredError(toolName);
    }

    return true;
  }

  private async enforceRateLimit(sessionId: string): Promise<void> {
    validateSessionId(sessionId);

    const minuteKey = `scout:rate:${sessionId}:minute`;
    const hourKey = `scout:rate:${sessionId}:hour`;

    const pipeline = this.redis.pipeline();
    pipeline.incr(minuteKey);
    pipeline.expire(minuteKey, 60, 'NX');
    pipeline.incr(hourKey);
    pipeline.expire(hourKey, 3600, 'NX');
    const results = await pipeline.exec();

    const minuteCount = Number(results?.[0]?.[1] ?? 0);
    const hourCount = Number(results?.[2]?.[1] ?? 0);

    const effectiveCpm = getSessionRateLimit(sessionId) ?? this.policy.rateLimit.callsPerMinute;
    if (minuteCount > effectiveCpm) {
      await this.report('rate-limit', 'rate_limit_exceeded', 'warning', {
        window: 'minute',
        count: minuteCount,
        limit: effectiveCpm,
        session: sessionId,
        source: getSessionRateLimit(sessionId) !== null ? 'operator_override' : 'default',
      });
      throw new RateLimitError('minute', effectiveCpm);
    }

    if (hourCount > this.policy.rateLimit.callsPerHour) {
      await this.report('rate-limit', 'rate_limit_exceeded', 'warning', {
        window: 'hour',
        count: hourCount,
        limit: this.policy.rateLimit.callsPerHour,
        session: sessionId,
      });
      throw new RateLimitError('hour', this.policy.rateLimit.callsPerHour);
    }
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
