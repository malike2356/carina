import { describe, expect, it } from 'vitest';
import {
  createPkcePair,
  storePkceVerifier,
  takePkceVerifier,
} from './propreneur-oauth-bridge.js';

describe('propreneur oauth PKCE', () => {
  it('creates S256 verifier/challenge pairs', () => {
    const pair = createPkcePair();
    expect(pair.method).toBe('S256');
    expect(pair.verifier.length).toBeGreaterThanOrEqual(43);
    expect(pair.challenge.length).toBeGreaterThanOrEqual(43);
    expect(pair.challenge).not.toBe(pair.verifier);
  });

  it('stores and consumes verifiers once', () => {
    const state = 'state-abc';
    const { verifier } = createPkcePair();
    storePkceVerifier(state, verifier);
    expect(takePkceVerifier(state)).toBe(verifier);
    expect(takePkceVerifier(state)).toBeNull();
  });
});
