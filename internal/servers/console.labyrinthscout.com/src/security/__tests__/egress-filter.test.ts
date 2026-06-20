import { describe, it, expect, vi } from 'vitest';
import {
  EgressFilter,
  EgressBlockedError,
  DataLeakError,
} from '../egress-filter.js';

const DEFAULT_DOMAINS = [
  'api.search.brave.com',
  'api.openai.com',
  'api.anthropic.com',
  'api.deepseek.com',
  'api.resend.com',
  'api.telegram.org',
  'api.twilio.com',
  'api.propertydata.co.uk',
  'generativelanguage.googleapis.com',
  '*.carinaai.uk',
  '*.github.com',
  'github.com',
];

function makeFilter(reportFn = vi.fn().mockResolvedValue(undefined)): EgressFilter {
  return new EgressFilter({
    allowedDomains: [...DEFAULT_DOMAINS],
    scoutBaseUrl: null,
    reportFn,
  });
}

const OPENAI_KEY = 'sk-' + 'A'.repeat(48);
const ANTHROPIC_KEY = 'sk-ant-api' + 'x'.repeat(100);
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

  it('allows wildcard subdomain: sub.carinaai.uk matches *.carinaai.uk', () => {
    const filter = makeFilter();
    expect(filter.isAllowed('https://sub.carinaai.uk/api')).toBe(true);
  });

  it('does not allow bare wildcard root: carinaai.uk does not match *.carinaai.uk', () => {
    const filter = makeFilter();
    expect(filter.isAllowed('https://carinaai.uk/api')).toBe(false);
  });

  it('allows github.com exact match', () => {
    const filter = makeFilter();
    expect(filter.isAllowed('https://github.com/repos')).toBe(true);
  });

  it('allows sub.github.com via *.github.com wildcard', () => {
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
    expect(result).toEqual({ found: true, patternName: 'github_token' });
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
      expect.objectContaining({ patternName: 'private_key' }),
    );
  });
});

describe('loadPolicyFromEnv domains', () => {
  it('merges SCOUT_ALLOWED_DOMAINS with defaults', () => {
    const prev = process.env.SCOUT_ALLOWED_DOMAINS;
    process.env.SCOUT_ALLOWED_DOMAINS = 'custom.example.com';
    const filter = new EgressFilter({ scoutBaseUrl: null, reportFn: vi.fn() });
    expect(filter.isAllowed('https://custom.example.com/path')).toBe(true);
    process.env.SCOUT_ALLOWED_DOMAINS = prev;
  });
});
