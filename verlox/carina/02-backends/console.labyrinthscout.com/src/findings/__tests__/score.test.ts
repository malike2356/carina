import { describe, it, expect } from 'vitest';
import { calculateScoutScore } from '../score.js';

describe('calculateScoutScore', () => {
  it('starts at 100 with no open findings', () => {
    expect(calculateScoutScore({
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      openPorts: 0,
    })).toBe(100);
  });

  it('deducts 10 per critical finding', () => {
    expect(calculateScoutScore({
      critical: 2,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      openPorts: 0,
    })).toBe(80);
  });

  it('deducts 5 per high finding', () => {
    expect(calculateScoutScore({
      critical: 0,
      high: 3,
      medium: 0,
      low: 0,
      info: 0,
      openPorts: 0,
    })).toBe(85);
  });

  it('deducts 2 per medium finding', () => {
    expect(calculateScoutScore({
      critical: 0,
      high: 0,
      medium: 4,
      low: 0,
      info: 0,
      openPorts: 0,
    })).toBe(92);
  });

  it('deducts 1 per open port without vuln', () => {
    expect(calculateScoutScore({
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      openPorts: 5,
    })).toBe(95);
  });

  it('clamps score at 0', () => {
    expect(calculateScoutScore({
      critical: 20,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      openPorts: 0,
    })).toBe(0);
  });

  it('combines deductions from multiple severities', () => {
    expect(calculateScoutScore({
      critical: 1,
      high: 2,
      medium: 1,
      low: 0,
      info: 0,
      openPorts: 3,
    })).toBe(75);
  });
});
