import { describe, it, expect, vi } from 'vitest';
import {
  EgressFilter,
  EgressBlockedError,
  DataLeakError,
} from '../egress-filter.js';

function makeFilter(reportFn = vi.fn().mockResolvedValue(undefined)): EgressFilter {
  return new EgressFilter({
    scoutBaseUrl: null,
    reportFn,
  });
}

const OPENAI_KEY = 'sk-' + 'A'.repeat(48);
const ANTHROPIC_KEY = 'sk-ant-api' + 'x'.repeat(95);
const GITHUB_TOKEN = 'ghp_' + 'a'.repeat(36);

describe('EgressFilter.isAllowed', () => {
  it('allows exact match: api.openai.com', () => {
    const filter = makeFilter();
    expect(filter.isAllowed('https://api.openai.com/v1/chat')).toBe(true);
  });

  it('blocks unlisted domain: evil.com', () => {
    const filter = makeFilter();
    expect(filter.isAllowed('https://evil.com/steal')).toBe(false);
  });

  it('allows explicit carinaai.uk subdomain: hub.carinaai.uk', () => {
    const filter = makeFilter();
    expect(filter.isAllowed('https://hub.carinaai.uk/api')).toBe(true);
  });

  it('blocks unlisted carinaai.uk subdomain: attacker.carinaai.uk', () => {
    const filter = makeFilter();
    expect(filter.isAllowed('https://attacker.carinaai.uk/payload')).toBe(false);
  });

  it('blocks github.io pages: attacker.github.io', () => {
    const filter = makeFilter();
    expect(filter.isAllowed('https://attacker.github.io/payload')).toBe(false);
  });

  it('allows api.github.com hostname', () => {
    const filter = makeFilter();
    expect(filter.isAllowed('https://api.github.com/user')).toBe(true);
  });
});

describe('EgressFilter.scanForSensitiveData', () => {
  it('detects OpenAI key pattern', async () => {
    const filter = makeFilter();
    const result = await filter.scanForSensitiveData(`key=${OPENAI_KEY}`);
    expect(result).toEqual({ found: true, patternName: 'openai_key' });
  });

  it('detects Anthropic key pattern', async () => {
    const filter = makeFilter();
    const result = await filter.scanForSensitiveData(`token=${ANTHROPIC_KEY}`);
    expect(result).toEqual({ found: true, patternName: 'anthropic_key' });
  });

  it('detects GitHub token pattern', async () => {
    const filter = makeFilter();
    const result = await filter.scanForSensitiveData(`gh=${GITHUB_TOKEN}`);
    expect(result).toEqual({ found: true, patternName: 'github_pat' });
  });

  it('returns found=false for clean content', async () => {
    const filter = makeFilter();
    const result = await filter.scanForSensitiveData('hello world');
    expect(result).toEqual({ found: false });
  });
});

describe('EgressFilter.checkRequest', () => {
  it('throws EgressBlockedError for blocked domain', async () => {
    const reportFn = vi.fn().mockResolvedValue(undefined);
    const filter = makeFilter(reportFn);

    await expect(filter.checkRequest('https://evil.com/path')).rejects.toBeInstanceOf(EgressBlockedError);
    expect(reportFn).toHaveBeenCalledWith(
      'egress_blocked',
      'critical',
      expect.objectContaining({ hostname: 'evil.com' }),
    );
  });

  it('throws EgressBlockedError for disallowed GitHub path', async () => {
    const reportFn = vi.fn().mockResolvedValue(undefined);
    const filter = makeFilter(reportFn);

    await expect(
      filter.checkRequest('https://api.github.com/attacker/payload'),
    ).rejects.toBeInstanceOf(EgressBlockedError);
  });

  it('allows malike2356 raw.githubusercontent.com path', async () => {
    const reportFn = vi.fn().mockResolvedValue(undefined);
    const filter = makeFilter(reportFn);

    await expect(
      filter.checkRequest('https://raw.githubusercontent.com/malike2356/carina-aiva/main/README.md'),
    ).resolves.toBeUndefined();
  });

  it('blocks arbitrary raw.githubusercontent.com path', async () => {
    const reportFn = vi.fn().mockResolvedValue(undefined);
    const filter = makeFilter(reportFn);

    await expect(
      filter.checkRequest('https://raw.githubusercontent.com/attacker/payload/main/evil.txt'),
    ).rejects.toBeInstanceOf(EgressBlockedError);
  });

  it('throws DataLeakError when body contains API key', async () => {
    const reportFn = vi.fn().mockResolvedValue(undefined);
    const filter = makeFilter(reportFn);

    await expect(
      filter.checkRequest('https://api.openai.com/v1/chat', JSON.stringify({ key: OPENAI_KEY })),
    ).rejects.toBeInstanceOf(DataLeakError);
    expect(reportFn).toHaveBeenCalledWith(
      'data_leak_outbound',
      'critical',
      expect.objectContaining({ patternName: 'openai_key' }),
    );
  });

  it('resolves without error for allowed domain and clean body', async () => {
    const reportFn = vi.fn().mockResolvedValue(undefined);
    const filter = makeFilter(reportFn);

    await expect(
      filter.checkRequest('https://api.openai.com/v1/chat', '{"prompt":"hello"}'),
    ).resolves.toBeUndefined();
    expect(reportFn).not.toHaveBeenCalled();
  });
});

describe('EgressFilter.checkResponse', () => {
  it('does not throw even when private key found in response', async () => {
    const reportFn = vi.fn().mockResolvedValue(undefined);
    const filter = makeFilter(reportFn);
    const body = '-----BEGIN RSA PRIVATE KEY-----\nMIIE...';

    await expect(
      filter.checkResponse('https://api.openai.com/v1/chat', body),
    ).resolves.toBeUndefined();
    expect(reportFn).toHaveBeenCalledWith(
      'data_leak_inbound',
      'critical',
      expect.objectContaining({ patternName: 'private_key_pem' }),
    );
  });
});

describe('loadPolicyFromEnv domains', () => {
  it('merges CARINA_EGRESS_EXTRA_DOMAINS with defaults', () => {
    const prevExtra = process.env.CARINA_EGRESS_EXTRA_DOMAINS;
    const prevScout = process.env.SCOUT_ALLOWED_DOMAINS;
    process.env.CARINA_EGRESS_EXTRA_DOMAINS = 'custom.example.com';
    delete process.env.SCOUT_ALLOWED_DOMAINS;
    const filter = new EgressFilter({ scoutBaseUrl: null, reportFn: vi.fn() });
    expect(filter.isAllowed('https://custom.example.com/path')).toBe(true);
    process.env.CARINA_EGRESS_EXTRA_DOMAINS = prevExtra;
    process.env.SCOUT_ALLOWED_DOMAINS = prevScout;
  });

  it('falls back to SCOUT_ALLOWED_DOMAINS when CARINA_EGRESS_EXTRA_DOMAINS is unset', () => {
    const prevExtra = process.env.CARINA_EGRESS_EXTRA_DOMAINS;
    const prevScout = process.env.SCOUT_ALLOWED_DOMAINS;
    delete process.env.CARINA_EGRESS_EXTRA_DOMAINS;
    process.env.SCOUT_ALLOWED_DOMAINS = 'legacy.example.com';
    const filter = new EgressFilter({ scoutBaseUrl: null, reportFn: vi.fn() });
    expect(filter.isAllowed('https://legacy.example.com/path')).toBe(true);
    process.env.CARINA_EGRESS_EXTRA_DOMAINS = prevExtra;
    process.env.SCOUT_ALLOWED_DOMAINS = prevScout;
  });
});
