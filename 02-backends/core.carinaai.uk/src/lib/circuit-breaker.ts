/**
 * Generic in-process circuit breaker for upstream HTTP dependencies (LLM
 * providers, webhooks, third-party APIs). Each breaker is per-process and
 * keyed by name, which is sufficient here because LLM calls already fail
 * over across providers/profiles per process (see providers/provider-pool.ts
 * and brain/fallback-chain.ts); the breaker adds a fast-fail layer so a
 * provider that is clearly down does not eat request latency on every call
 * while it recovers.
 *
 * States:
 * - closed: normal operation, calls pass through.
 * - open: calls fail immediately with CircuitOpenError until resetTimeoutMs
 *   elapses, at which point the breaker moves to half-open.
 * - half-open: a limited number of trial calls are allowed through; enough
 *   consecutive successes closes the breaker again, a single failure reopens
 *   it (and restarts the reset timer).
 */

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  /** Consecutive failures in the closed state before the breaker opens. Default 5. */
  failureThreshold?: number;
  /** Time the breaker stays open before probing again, in ms. Default 30s. */
  resetTimeoutMs?: number;
  /** Consecutive successes in half-open needed to fully close. Default 2. */
  successThreshold?: number;
  /** Optional callback invoked whenever the state transitions, for logging/metrics. */
  onStateChange?: (from: CircuitState, to: CircuitState, key: string) => void;
}

export class CircuitOpenError extends Error {
  constructor(public readonly key: string, public readonly retryAfterMs: number) {
    super(`Circuit breaker for "${key}" is open; retry in ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = 'CircuitOpenError';
  }
}

interface BreakerRecord {
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  openedAt: number;
  nextProbeAt: number;
}

const DEFAULT_OPTIONS: Required<Omit<CircuitBreakerOptions, 'onStateChange'>> = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  successThreshold: 2,
};

export class CircuitBreaker {
  private readonly key: string;
  private readonly opts: Required<Omit<CircuitBreakerOptions, 'onStateChange'>>;
  private readonly onStateChange?: CircuitBreakerOptions['onStateChange'];
  private record: BreakerRecord;

  constructor(key: string, options: CircuitBreakerOptions = {}) {
    this.key = key;
    this.opts = { ...DEFAULT_OPTIONS, ...options };
    this.onStateChange = options.onStateChange;
    this.record = {
      state: 'closed',
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      openedAt: 0,
      nextProbeAt: 0,
    };
  }

  getState(): CircuitState {
    this.maybeTransitionToHalfOpen();
    return this.record.state;
  }

  snapshot(): { state: CircuitState; consecutiveFailures: number; nextProbeAt: number } {
    this.maybeTransitionToHalfOpen();
    return {
      state: this.record.state,
      consecutiveFailures: this.record.consecutiveFailures,
      nextProbeAt: this.record.nextProbeAt,
    };
  }

  private maybeTransitionToHalfOpen(): void {
    if (this.record.state === 'open' && Date.now() >= this.record.nextProbeAt) {
      this.transition('half_open');
      this.record.consecutiveSuccesses = 0;
    }
  }

  private transition(to: CircuitState): void {
    const from = this.record.state;
    if (from === to) return;
    this.record.state = to;
    if (to === 'open') {
      this.record.openedAt = Date.now();
      this.record.nextProbeAt = Date.now() + this.opts.resetTimeoutMs;
    }
    this.onStateChange?.(from, to, this.key);
  }

  private onSuccess(): void {
    if (this.record.state === 'half_open') {
      this.record.consecutiveSuccesses += 1;
      if (this.record.consecutiveSuccesses >= this.opts.successThreshold) {
        this.record.consecutiveFailures = 0;
        this.transition('closed');
      }
      return;
    }
    this.record.consecutiveFailures = 0;
  }

  private onFailure(): void {
    if (this.record.state === 'half_open') {
      this.transition('open');
      return;
    }
    this.record.consecutiveFailures += 1;
    if (this.record.consecutiveFailures >= this.opts.failureThreshold) {
      this.transition('open');
    }
  }

  /** Runs fn through the breaker; throws CircuitOpenError without calling fn if open. */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeTransitionToHalfOpen();
    if (this.record.state === 'open') {
      throw new CircuitOpenError(this.key, this.record.nextProbeAt - Date.now());
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  /** Resets the breaker to closed, clearing all counters. Intended for tests/ops tooling. */
  reset(): void {
    this.record = {
      state: 'closed',
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      openedAt: 0,
      nextProbeAt: 0,
    };
  }
}

const registry = new Map<string, CircuitBreaker>();

/**
 * Returns the shared breaker for a given key (for example, an LLM provider
 * name), creating it on first use. Options are only applied when the
 * breaker is first created.
 */
export function getCircuitBreaker(key: string, options?: CircuitBreakerOptions): CircuitBreaker {
  let breaker = registry.get(key);
  if (!breaker) {
    breaker = new CircuitBreaker(key, options);
    registry.set(key, breaker);
  }
  return breaker;
}

export function listCircuitBreakers(): Array<{ key: string } & ReturnType<CircuitBreaker['snapshot']>> {
  return Array.from(registry.entries()).map(([key, breaker]) => ({ key, ...breaker.snapshot() }));
}

/** Test/ops helper to clear the registry between test files or after a manual recovery. */
export function resetAllCircuitBreakers(): void {
  registry.clear();
}
