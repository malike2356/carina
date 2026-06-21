import { describe, it, expect } from 'vitest';
import {
  ENGINE_REGISTRY,
  SCOUT_ENGINE_NAMES,
  defaultEnginesForTier,
  isKnownEngine,
  scheduleIntervalMs,
} from '../registry.js';

describe('ENGINE_REGISTRY', () => {
  it('registers all 25 scout automated tools plus composites', () => {
    const automated = [
      'nmap', 'amass', 'theHarvester', 'spiderfoot', 'sherlock',
      'nuclei', 'nikto', 'wpscan', 'whatweb', 'arjun',
      'dirsearch', 'feroxbuster', 'gobuster', 'ffuf', 'snort',
      'bloodhound', 'log2timeline', 'timesketch', 'yara', 'stix', 'cyberchef',
    ];
    for (const name of automated) {
      expect(ENGINE_REGISTRY[name], `missing ${name}`).toBeDefined();
    }
    expect(SCOUT_ENGINE_NAMES).toContain('quick-scan');
  });

  it('identifies known engines', () => {
    expect(isKnownEngine('nmap')).toBe(true);
    expect(isKnownEngine('metasploit')).toBe(false);
  });

  it('returns monitor-tier defaults without govern-only tools', () => {
    const monitor = defaultEnginesForTier('monitor');
    expect(monitor).toContain('nmap');
    expect(monitor).toContain('nuclei');
    expect(monitor).not.toContain('spiderfoot');
    expect(monitor).not.toContain('bloodhound');
  });

  it('includes govern tools for govern tier', () => {
    const govern = defaultEnginesForTier('govern');
    expect(govern).toContain('spiderfoot');
    expect(govern).toContain('feroxbuster');
    expect(govern).toContain('snort');
  });

  it('maps schedules to intervals', () => {
    expect(scheduleIntervalMs('daily')).toBe(86_400_000);
    expect(scheduleIntervalMs('on-demand')).toBeNull();
  });
});
