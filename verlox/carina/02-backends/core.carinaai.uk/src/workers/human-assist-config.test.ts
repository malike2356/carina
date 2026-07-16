import { describe, expect, it } from 'vitest';
import { humanAssistEnabled, humanAssistFairUsePerMonth } from './human-assist-config.js';

describe('humanAssistEnabled', () => {
  it('defaults to enabled', () => {
    const prev = process.env.AIVA_HUMAN_ASSIST_ENABLED;
    delete process.env.AIVA_HUMAN_ASSIST_ENABLED;
    expect(humanAssistEnabled()).toBe(true);
    if (prev !== undefined) process.env.AIVA_HUMAN_ASSIST_ENABLED = prev;
  });

  it('respects false', () => {
    const prev = process.env.AIVA_HUMAN_ASSIST_ENABLED;
    process.env.AIVA_HUMAN_ASSIST_ENABLED = 'false';
    expect(humanAssistEnabled()).toBe(false);
    if (prev !== undefined) process.env.AIVA_HUMAN_ASSIST_ENABLED = prev;
    else delete process.env.AIVA_HUMAN_ASSIST_ENABLED;
  });
});

describe('humanAssistFairUsePerMonth', () => {
  it('defaults to 5', () => {
    const prev = process.env.AIVA_HUMAN_ASSIST_FAIR_USE_PER_MONTH;
    delete process.env.AIVA_HUMAN_ASSIST_FAIR_USE_PER_MONTH;
    expect(humanAssistFairUsePerMonth()).toBe(5);
    if (prev !== undefined) process.env.AIVA_HUMAN_ASSIST_FAIR_USE_PER_MONTH = prev;
  });
});
