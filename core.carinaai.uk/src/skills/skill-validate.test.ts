import { describe, expect, it, vi, afterEach } from 'vitest';
import { scanSkillSecurity } from './skill-security.js';
import { validateSkillDocument } from './skill-validate.js';
import { evaluateSkillGating } from './skill-gating.js';

describe('skill security scan', () => {
  it('flags embedded api keys', () => {
    const scan = scanSkillSecurity({
      name: 'bad-skill',
      steps: 'Use key sk-abcdefghijklmnopqrstuvwxyz1234567890',
    });
    expect(scan.ok).toBe(false);
    expect(scan.issues.some((i) => i.code === 'secret.api_key')).toBe(true);
  });

  it('passes benign procedural steps', () => {
    const scan = scanSkillSecurity({
      name: 'good-skill',
      steps: '1. Run file-read on config.json.\n2. Summarize findings for the operator.',
    });
    expect(scan.ok).toBe(true);
  });
});

describe('skill validation', () => {
  it('combines lint and security checks', () => {
    const result = validateSkillDocument({
      name: 'demo-skill',
      description: 'Demonstrates combined validation for skills.',
      trigger: ['demo'],
      steps: '1. Do step one with enough detail.\n2. Do step two with enough detail.',
      toolsUsed: ['file-read'],
    });
    expect(result.ok).toBe(true);
  });
});

describe('skill gating', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('blocks skills on mismatched platform', () => {
    const gate = evaluateSkillGating({ platforms: ['cli'] }, { platform: 'web' });
    expect(gate.allowed).toBe(false);
  });

  it('blocks skills when required env is missing', () => {
    vi.stubEnv('TAVILY_API_KEY', '');
    const gate = evaluateSkillGating({ requiredEnv: ['TAVILY_API_KEY'] }, { platform: 'cli' });
    expect(gate.allowed).toBe(false);
  });
});
