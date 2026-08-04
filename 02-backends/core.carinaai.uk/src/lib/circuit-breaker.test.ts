import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitOpenError,
  getCircuitBreaker,
  listCircuitBreakers,
  resetAllCircuitBreakers,
} from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  it('starts closed and allows calls through', async () => {
    const breaker = new CircuitBreaker('test-closed');
    expect(breaker.getState()).toBe('closed');
    const result = await breaker.execute(async () => 'ok');
    expect(result).toBe('ok');
    expect(breaker.getState()).toBe('closed');
  });

  it('opens after reaching the failure threshold', async () => {
    const breaker = new CircuitBreaker('test-opens', { failureThreshold: 3, resetTimeoutMs: 50_000 });
    const failingCall = () => Promise.reject(new Error('upstream down'));

    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failingCall)).rejects.toThrow('upstream down');
    }

    expect(breaker.getState()).toBe('open');
  });

  it('fails fast with CircuitOpenError while open, without invoking fn', async () => {
    const breaker = new CircuitBreaker('test-fail-fast', { failureThreshold: 1, resetTimeoutMs: 50_000 });
    await expect(breaker.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(breaker.getState()).toBe('open');

    const fn = vi.fn().mockResolvedValue('should not run');
    await expect(breaker.execute(fn)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('transitions to half-open after the reset timeout and closes on success', async () => {
    const breaker = new CircuitBreaker('test-half-open', {
      failureThreshold: 1,
      resetTimeoutMs: 10,
      successThreshold: 1,
    });
    await expect(breaker.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(breaker.getState()).toBe('open');

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(breaker.getState()).toBe('half_open');

    const result = await breaker.execute(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(breaker.getState()).toBe('closed');
  });

  it('reopens immediately on a failure while half-open', async () => {
    const breaker = new CircuitBreaker('test-half-open-reopen', {
      failureThreshold: 1,
      resetTimeoutMs: 10,
      successThreshold: 2,
    });
    await expect(breaker.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(breaker.getState()).toBe('half_open');

    await expect(breaker.execute(() => Promise.reject(new Error('still down')))).rejects.toThrow('still down');
    expect(breaker.getState()).toBe('open');
  });

  it('requires successThreshold consecutive successes before fully closing', async () => {
    const breaker = new CircuitBreaker('test-success-threshold', {
      failureThreshold: 1,
      resetTimeoutMs: 10,
      successThreshold: 2,
    });
    await expect(breaker.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await new Promise((resolve) => setTimeout(resolve, 20));

    await breaker.execute(async () => 'ok-1');
    expect(breaker.getState()).toBe('half_open');

    await breaker.execute(async () => 'ok-2');
    expect(breaker.getState()).toBe('closed');
  });

  it('resets counters and state via reset()', async () => {
    const breaker = new CircuitBreaker('test-reset', { failureThreshold: 1 });
    await expect(breaker.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(breaker.getState()).toBe('open');
    breaker.reset();
    expect(breaker.getState()).toBe('closed');
  });

  it('invokes onStateChange when transitioning', async () => {
    const onStateChange = vi.fn();
    const breaker = new CircuitBreaker('test-callback', { failureThreshold: 1, onStateChange });
    await expect(breaker.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(onStateChange).toHaveBeenCalledWith('closed', 'open', 'test-callback');
  });
});

describe('circuit breaker registry', () => {
  afterEach(() => {
    resetAllCircuitBreakers();
  });

  it('returns the same breaker instance for the same key', () => {
    const a = getCircuitBreaker('registry-key');
    const b = getCircuitBreaker('registry-key');
    expect(a).toBe(b);
  });

  it('lists all registered breakers with their state', async () => {
    const breaker = getCircuitBreaker('registry-list', { failureThreshold: 1 });
    await expect(breaker.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');

    const snapshots = listCircuitBreakers();
    const entry = snapshots.find((s) => s.key === 'registry-list');
    expect(entry).toBeDefined();
    expect(entry?.state).toBe('open');
  });
});
