import { describe, expect, it } from 'vitest';
import { parseAllowedIps } from '../middleware/ip-allowlist.js';

function clientIpFromHeaders(headers: Record<string, string | undefined>): string {
  const cf = headers['cf-connecting-ip']?.trim();
  if (cf) return cf.startsWith('::ffff:') ? cf.slice(7) : cf;
  const forwarded = headers['x-forwarded-for']?.split(',')[0]?.trim();
  if (forwarded) return forwarded.startsWith('::ffff:') ? forwarded.slice(7) : forwarded;
  return '';
}

describe('ops IP allowlist', () => {
  it('parses comma-separated allowlist entries', () => {
    expect(parseAllowedIps('127.0.0.1, 10.0.0.5 ,')).toEqual(['127.0.0.1', '10.0.0.5']);
  });

  it('returns empty list when unset', () => {
    expect(parseAllowedIps(undefined)).toEqual([]);
    expect(parseAllowedIps('   ')).toEqual([]);
  });

  it('normalizes IPv4-mapped IPv6 addresses in allowlist', () => {
    expect(parseAllowedIps('::ffff:86.185.131.191')).toEqual(['86.185.131.191']);
  });

  it('prefers cf-connecting-ip for client detection', () => {
    const ip = clientIpFromHeaders({
      'cf-connecting-ip': '2a00:23c8:f111:3b01:2130:dac5:b849:53ae',
      'x-forwarded-for': '172.69.195.233',
    });
    expect(ip).toBe('2a00:23c8:f111:3b01:2130:dac5:b849:53ae');
  });
});
