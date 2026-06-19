import { describe, expect, it } from 'vitest';
import { parseCronYamlEntry } from './cron-yaml-parser.js';

describe('cron-yaml-import', () => {
  it('parses scriptConfig, contextFrom, and noAgent fields', () => {
    const entry = parseCronYamlEntry({
      id: 'market-fetch',
      name: 'Market Data Fetch',
      schedule: '0 7 * * 1-5',
      noAgent: true,
      scriptConfig: {
        script: 'echo market-data',
        timeoutMs: 15000,
      },
      contextFrom: 'other-job:2',
    });

    expect(entry.id).toBe('market-fetch');
    expect(entry.noAgent).toBe(true);
    expect(entry.scriptConfig?.script).toBe('echo market-data');
    expect(entry.scriptConfig?.timeoutMs).toBe(15000);
    expect(entry.contextFrom).toBe('other-job:2');
  });

  it('accepts inline script field as shorthand', () => {
    const entry = parseCronYamlEntry({
      name: 'backup',
      schedule: '0 2 * * *',
      script: 'tar -czf backup.tar.gz data/',
      noAgent: true,
    });

    expect(entry.script).toBe('tar -czf backup.tar.gz data/');
  });
});
