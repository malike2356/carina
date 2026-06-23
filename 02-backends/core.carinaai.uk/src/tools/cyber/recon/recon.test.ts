import { describe, it, expect } from 'vitest';
import { parseNmapXml, SCAN_TYPE_FLAGS } from './nmap.js';
import { tokenizeOptions, sanitizeTarget, sanitizeDomain } from '../sanitize.js';
import { parseHarvesterOutput, parseSherlockCsv } from './phase1.js';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nmaprun>
  <host>
    <status state="up"/>
    <address addr="192.168.1.1" addrtype="ipv4"/>
    <ports>
      <port protocol="tcp" portid="22">
        <state state="open"/>
        <service name="ssh" product="OpenSSH" version="8.9p1"/>
      </port>
      <port protocol="tcp" portid="443">
        <state state="open"/>
        <service name="https" product="nginx" version="1.24.0"/>
      </port>
    </ports>
    <os>
      <osmatch name="Linux 5.15" accuracy="92"/>
    </os>
  </host>
  <runstats>
    <hosts up="12" down="244" total="256"/>
  </runstats>
</nmaprun>`;

describe('parseNmapXml', () => {
  it('extracts ports, hosts, and OS matches', () => {
    const parsed = parseNmapXml(SAMPLE_XML);
    expect(parsed.hosts).toEqual({ total: 256, up: 12, down: 244 });
    expect(parsed.ports).toHaveLength(2);
    expect(parsed.ports[0]).toMatchObject({
      port: 22,
      protocol: 'tcp',
      state: 'open',
      service: 'ssh',
      version: 'OpenSSH 8.9p1',
      host: '192.168.1.1',
    });
    expect(parsed.osMatches[0]).toEqual({ name: 'Linux 5.15', accuracy: 92 });
  });
});

describe('SCAN_TYPE_FLAGS', () => {
  it('defines all scan profiles from the prompt spec', () => {
    expect(Object.keys(SCAN_TYPE_FLAGS).sort()).toEqual(
      ['full', 'os', 'quick', 'service', 'stealth', 'vuln'].sort(),
    );
  });
});

describe('sanitize helpers', () => {
  it('rejects shell metacharacters in targets', () => {
    expect(sanitizeTarget('192.168.1.1; rm -rf /')).toEqual({ error: expect.any(String) });
  });

  it('accepts valid CIDR targets', () => {
    expect(sanitizeTarget('10.0.0.0/24')).toBe('10.0.0.0/24');
  });

  it('tokenizes quoted nmap options safely', () => {
    expect(tokenizeOptions('-T1 --randomize-hosts')).toEqual(['-T1', '--randomize-hosts']);
    expect(tokenizeOptions('"-p 80,443"')).toEqual(['-p 80,443']);
  });

  it('validates domain format', () => {
    expect(sanitizeDomain('example.com')).toBe('example.com');
    expect(sanitizeDomain('bad domain')).toEqual({ error: expect.any(String) });
  });
});

describe('parseHarvesterOutput', () => {
  it('extracts emails hosts and ips', () => {
    const parsed = parseHarvesterOutput(
      'admin@example.com\nmail.example.com\n203.0.113.10\n',
    );
    expect(parsed.emails).toContain('admin@example.com');
    expect(parsed.hosts).toContain('mail.example.com');
    expect(parsed.ips).toContain('203.0.113.10');
  });
});

describe('parseSherlockCsv', () => {
  it('parses found account rows', () => {
    const rows = parseSherlockCsv('site,url\nGitHub,https://github.com/user\n');
    expect(rows).toEqual([{ site: 'GitHub', url: 'https://github.com/user' }]);
  });
});
