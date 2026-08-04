import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceTier } from '../tiers.js';
import { getCyberToolDef, getLegacyCyberToolDef } from '../cyber-tools-registry.js';
import { getCyberTool } from './index.js';
import {
  parseAircrackOutput,
  parseWifiteOutput,
  parseBettercapEvents,
  parseKismetDevices,
} from './wireless/phase5.js';

vi.mock('./exec.js', () => ({
  runBinary: vi.fn(async () => ({
    exitCode: 0,
    stdout: 'KEY FOUND! [ password123 ]\nBSSID: aa:bb:cc:dd:ee:ff\n',
    stderr: '',
  })),
}));

describe('phase 5 wireless parsers', () => {
  it('parses aircrack key found output', () => {
    expect(parseAircrackOutput('KEY FOUND! [ secretpass ]\nBSSID: aa:bb:cc:dd:ee:ff')).toMatchObject({
      keyFound: true,
      key: 'secretpass',
      bssid: 'aa:bb:cc:dd:ee:ff',
    });
  });

  it('parses wifite cracked and handshake lines', () => {
    const parsed = parseWifiteOutput('handshake captured\nESSID: OfficeWiFi\ncracked OfficeWiFi\nWPS PIN: 12345678');
    expect(parsed.handshakes).toContain('OfficeWiFi');
    expect(parsed.cracked.length).toBeGreaterThan(0);
    expect(parsed.wpsPins).toContain('12345678');
  });

  it('counts bettercap events', () => {
    const parsed = parseBettercapEvents('event one\nevent two\n');
    expect(parsed.events).toBe(2);
  });

  it('normalizes kismet device records', () => {
    const devices = parseKismetDevices([
      {
        'kismet.device.base.macaddr': 'aa:bb:cc:dd:ee:ff',
        'kismet.device.base.name': 'TestAP',
        'kismet.device.base.signal': -42,
        'kismet.device.base.channel': '6',
        'kismet.device.base.type': 'Wi-Fi AP',
      },
    ]);
    expect(devices[0]).toMatchObject({
      mac: 'aa:bb:cc:dd:ee:ff',
      name: 'TestAP',
      signal: -42,
      channel: '6',
    });
  });
});

describe('phase 5 monitor tier wireless tools', () => {
  beforeEach(() => {
    process.env.LABYRINTH_ENABLED = 'true';
    process.env.CARINA_ENABLE_LEGACY_CYBER_TOOLS = 'true';
    process.env.SCOUT_SUBSCRIPTION_PLAN = 'monitor';
  });

  afterEach(() => {
    delete process.env.LABYRINTH_ENABLED;
    delete process.env.CARINA_ENABLE_LEGACY_CYBER_TOOLS;
    delete process.env.SCOUT_SUBSCRIPTION_PLAN;
    vi.clearAllMocks();
  });

  it('registers all five wireless tools at monitor tier', () => {
    for (const name of [
      'aircrack-ng', 'bettercap', 'kismet', 'wifite', 'ettercap',
    ]) {
      expect((getLegacyCyberToolDef(name) ?? getCyberToolDef(name))?.requiredTier).toBe(WorkspaceTier.MONITOR);
      expect(getCyberTool(name)).toBeDefined();
    }
  });

  it('executes aircrack capture with structured output', async () => {
    const tool = getCyberTool('aircrack-ng');
    const result = await tool!.execute({ interface: 'wlan0mon', mode: 'capture' });
    expect(result).toMatchObject({
      tool: 'aircrack-ng',
      mode: 'capture',
      interface: 'wlan0mon',
      exitCode: 0,
    });
  });

  it('requires confirmation for aircrack deauth', () => {
    const tool = getCyberTool('aircrack-ng');
    expect(tool?.needsConfirmation?.({ interface: 'wlan0mon', mode: 'deauth', bssid: 'aa:bb:cc:dd:ee:ff' })).toBe(true);
    expect(tool?.needsConfirmation?.({ interface: 'wlan0mon', mode: 'capture' })).toBe(false);
  });

  it('requires confirmation for bettercap attack modules', () => {
    const tool = getCyberTool('bettercap');
    expect(tool?.needsConfirmation?.({ interface: 'eth0', modules: ['arp.spoof'] })).toBe(true);
    expect(tool?.needsConfirmation?.({ interface: 'eth0', modules: ['net.sniff'] })).toBe(false);
  });

  it('requires confirmation for wifite and ettercap mitm', () => {
    expect(getCyberTool('wifite')?.needsConfirmation?.({ interface: 'wlan0' })).toBe(true);
    expect(getCyberTool('ettercap')?.needsConfirmation?.({
      interface: 'eth0',
      target: '192.168.1.5',
      gateway: '192.168.1.1',
    })).toBe(true);
  });

  it('returns kismet API guidance when server is unavailable', async () => {
    const tool = getCyberTool('kismet');
    const result = await tool!.execute({ interface: 'wlan0mon' });
    expect(result).toMatchObject({
      tool: 'kismet',
      interface: 'wlan0mon',
    });
    expect(result).toHaveProperty('error');
  });
});
